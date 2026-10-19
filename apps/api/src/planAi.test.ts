import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, describe, it } from 'node:test';
import { createApp } from './app';
import type { Identity } from './auth';
import { MemoryStore } from './memoryStore';
import { AiBadAnswerError, AiUnavailableError, createDailyBudget, createGeminiClient, createPlanAi, type AiClient } from './planAi';

const NOW = new Date('2026-10-19T12:00:00Z');
const verify = async (token: string): Promise<Identity> => {
  if (!token.startsWith('tok-')) throw new Error('bad');
  const uid = token.slice(4);
  return { uid, email: `${uid}@example.com`, emailVerified: true, name: uid };
};

/** An AI that answers from a script and remembers what it was asked. */
const scripted = (replies: (string | Error)[]) => {
  const asked: { system: string; user: string }[] = [];
  const client: AiClient = {
    async generateJson(system, user) {
      asked.push({ system, user });
      const next = replies.shift();
      if (next === undefined) throw new Error('no reply left');
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { client, asked };
};

const QUESTIONS = JSON.stringify({
  questions: [
    { title: 'Which field do you want to move into?', options: ['Tech', 'Sales', 'Teaching'] },
    { title: 'How many hours a week can you give?', options: ['1 to 2', '3 to 5', 'More'] },
  ],
});
const PLAN = JSON.stringify({
  title: 'Move into a tech job',
  description: 'Build skills and apply steadily.',
  routines: [
    { name: 'Learn', tasks: ['Watch one lesson', 'Take notes'] },
    { name: 'Apply', tasks: ['Update your CV', 'Send two applications'] },
  ],
});

const boot = (client?: AiClient) => {
  const app = createApp(new MemoryStore(), {
    corsOrigins: [],
    isProduction: true,
    now: () => NOW,
    userAuth: verify,
    planAi: client ? createPlanAi(client) : undefined,
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/plan`;
  const call = async (as: string | null, body: unknown) => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(as ? { authorization: `Bearer tok-${as}` } : {}) },
      body: JSON.stringify(body),
    });
    // The tests read many shapes from the answer, so it is left loosely typed here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  };
  return { server, call };
};

const ASK = { stage: 'questions', niche: 'Career', answers: [{ q: 'What is your aim?', a: 'Change jobs' }] };
const MAKE = { ...ASK, stage: 'plan', week: { days: ['Mon', 'Wed', 'Fri'], minutes: null, months: 3 } };

describe('the AI planner route', () => {
  const servers: { close: () => void }[] = [];
  after(() => servers.forEach((s) => s.close()));

  it('needs a login', async () => {
    const { server, call } = boot(scripted([QUESTIONS]).client);
    servers.push(server);
    assert.equal((await call(null, ASK)).status, 401);
  });

  it('says so plainly when no AI is set up', async () => {
    const { server, call } = boot();
    servers.push(server);
    const res = await call('alice', ASK);
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'ai_not_configured');
  });

  it('returns checked follow-up questions with tap options', async () => {
    const { client, asked } = scripted([QUESTIONS]);
    const { server, call } = boot(client);
    servers.push(server);
    const res = await call('alice', ASK);
    assert.equal(res.status, 200);
    assert.equal(res.body.questions.length, 2);
    assert.deepEqual(res.body.questions[0].options[0], { value: 'Tech', label: 'Tech' });
    assert.equal(res.body.questions[0].id, 'f1');
    // The AI was told what the person chose, and that it is information, not orders.
    assert.match(asked[0].user, /Change jobs/);
    assert.match(asked[0].system, /never instructions/);
  });

  it('returns a checked plan', async () => {
    const { server, call } = boot(scripted([PLAN]).client);
    servers.push(server);
    const res = await call('alice', MAKE);
    assert.equal(res.status, 200);
    assert.equal(res.body.plan.routines.length, 2);
    assert.equal(res.body.plan.title, 'Move into a tech job');
  });

  it('accepts the AI wrapping its JSON in a code fence', async () => {
    const { server, call } = boot(scripted(['```json\n' + PLAN + '\n```']).client);
    servers.push(server);
    assert.equal((await call('alice', MAKE)).status, 200);
  });

  it('throws away an answer that is the wrong shape', async () => {
    const { server, call } = boot(scripted([JSON.stringify({ questions: [{ title: 'x', options: ['only one'] }] }), 'not json at all', JSON.stringify({ title: 'T', description: 'D', routines: [] })]).client);
    servers.push(server);
    assert.equal((await call('alice', ASK)).status, 502);
    assert.equal((await call('alice', ASK)).status, 502);
    assert.equal((await call('alice', MAKE)).status, 502);
  });

  it('turns odd characters and long text from the AI into safe text', async () => {
    const plan = JSON.stringify({ title: '  Run\u0000\n  well  ', description: 'ok', routines: [{ name: 'A', tasks: ['b\u0007c'] }] });
    const { server, call } = boot(scripted([plan]).client);
    servers.push(server);
    const res = await call('alice', MAKE);
    assert.equal(res.body.plan.title, 'Run well');
    assert.equal(res.body.plan.routines[0].tasks[0], 'b c');
  });

  it('reports an unreachable AI as unavailable, not as a crash', async () => {
    const { server, call } = boot(scripted([new AiUnavailableError('Gemini answered 429')]).client);
    servers.push(server);
    const res = await call('alice', ASK);
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'ai_unavailable');
  });

  it('rejects a body that is not what the app sends', async () => {
    const { server, call } = boot(scripted([QUESTIONS]).client);
    servers.push(server);
    assert.equal((await call('alice', { stage: 'questions' })).status, 400);
    assert.equal((await call('alice', { ...ASK, answers: Array.from({ length: 30 }, () => ({ q: 'q', a: 'a' })) })).status, 400);
    assert.equal((await call('alice', { ...ASK, stage: 'hack' })).status, 400);
  });

  it('counts a day\'s allowance per person and for everyone', () => {
    const budget = createDailyBudget(() => NOW, 2, 3);
    assert.equal(budget.take('a'), true);
    assert.equal(budget.take('a'), true);
    assert.equal(budget.take('a'), false); // this person is done for today
    assert.equal(budget.take('b'), true); // others are not affected
    assert.equal(budget.take('c'), false); // everyone's allowance is used up
  });

  it('starts a fresh allowance the next day', () => {
    let now = new Date('2026-10-19T23:00:00Z');
    const budget = createDailyBudget(() => now, 1, 10);
    assert.equal(budget.take('a'), true);
    assert.equal(budget.take('a'), false);
    now = new Date('2026-10-20T01:00:00Z');
    assert.equal(budget.take('a'), true);
  });

  it('slows down someone who asks too fast', async () => {
    const { server, call } = boot({ generateJson: async () => QUESTIONS });
    servers.push(server);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await call('zed', ASK)).status);
    assert.equal(statuses[0], 200);
    assert.equal(statuses[9], 429);
  });
});

describe('the Gemini connection', () => {
  const okBody = { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] };

  it('sends the key in a header, not in the address, and reads the text back', async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | undefined;
    const client = createGeminiClient({
      apiKey: 'SECRET-KEY',
      model: 'gemini-test',
      fetchImpl: (async (url: string, init: RequestInit) => {
        seen = { url, headers: init.headers as Record<string, string>, body: String(init.body) };
        return new Response(JSON.stringify(okBody), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(await client.generateJson('rules', 'person'), '{"a":1}');
    assert.ok(seen);
    assert.ok(!seen.url.includes('SECRET-KEY'));
    assert.equal(seen.headers['x-goog-api-key'], 'SECRET-KEY');
    assert.match(seen.url, /models\/gemini-test:generateContent/);
    assert.match(seen.body, /responseMimeType/);
  });

  it('turns a refusal into "unavailable" without leaking the key', async () => {
    const client = createGeminiClient({
      apiKey: 'SECRET-KEY',
      model: 'm',
      fetchImpl: (async () => new Response('quota used up', { status: 429 })) as typeof fetch,
    });
    await assert.rejects(client.generateJson('s', 'u'), (e: Error) => e instanceof AiUnavailableError && /429/.test(e.message) && !e.message.includes('SECRET-KEY'));
  });

  it('turns an empty answer into "bad answer"', async () => {
    const client = createGeminiClient({
      apiKey: 'k',
      model: 'm',
      fetchImpl: (async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })) as typeof fetch,
    });
    await assert.rejects(client.generateJson('s', 'u'), AiBadAnswerError);
  });

  it('turns a network failure into "unavailable"', async () => {
    const client = createGeminiClient({
      apiKey: 'k',
      model: 'm',
      fetchImpl: (async () => {
        throw new Error('offline');
      }) as typeof fetch,
    });
    await assert.rejects(client.generateJson('s', 'u'), AiUnavailableError);
  });
});
