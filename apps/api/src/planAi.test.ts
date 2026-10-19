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
const DAYS = [
  { day: 'Mon', name: 'Upper body', tasks: [{ exercise: 'Bench press', dose: '3 sets of 8' }, { exercise: 'Seated row', dose: '3 sets of 8' }, { exercise: 'Plank', dose: '3 holds of 20 seconds' }] },
  { day: 'Wed', name: 'Lower body', tasks: [{ exercise: 'Leg press', dose: '3 sets of 10' }, { exercise: 'Hip thrust', dose: '3 sets of 10' }] },
];
const OUTLINE = [
  { focus: 'Learn the moves', note: 'Light, easy form' },
  { focus: 'Add reps', note: 'A third set' },
];
const PROGRAM = JSON.stringify({ title: 'Build strength and muscle', description: 'Gentle and steady.', outline: OUTLINE, week: DAYS });
const WEEK = JSON.stringify({ days: DAYS });
const FREE_WEEK = JSON.stringify({
  days: [{ day: 'Mon', name: 'Job search', tasks: [{ text: 'Apply to 3 roles', steps: ['Pick roles that match', 'Change the first 2 lines', 'Send and note the date'] }, { text: 'Tidy your CV' }] }],
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
const WEEK_PICK = { days: ['Mon', 'Wed'], minutes: null, months: 3 };
const MENU = ['Bench press', 'Seated row', 'Plank', 'Leg press', 'Hip thrust'];
const MAKE = { ...ASK, niche: 'Fitness', stage: 'program', week: WEEK_PICK, menu: MENU };
const LATER = { ...MAKE, stage: 'week', weekNumber: 2, totalWeeks: 12, outline: OUTLINE, last: { done: ['Bench press: 3 sets of 8'], skipped: ['Plank: 3 holds'] } };

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

  it('returns an outline and a full first week', async () => {
    const { client, asked } = scripted([PROGRAM]);
    const { server, call } = boot(client);
    servers.push(server);
    const res = await call('alice', MAKE);
    assert.equal(res.status, 200);
    assert.equal(res.body.program.outline.length, 2);
    assert.deepEqual(res.body.program.week.map((d: { day: string }) => d.day), ['Mon', 'Wed']);
    assert.equal(res.body.program.week[0].tasks[0].text, 'Bench press: 3 sets of 8');
    assert.equal(res.body.program.week[0].tasks[0].exercise, 'Bench press');
    assert.match(asked[0].user, /EVERY WEEK IS NEW/);
    assert.match(asked[0].user, /Bench press \| Seated row/);
    assert.match(asked[0].user, /Fitness: every session is its own workout/);
  });

  it('writes a later week from the outline and how the last week went', async () => {
    const { client, asked } = scripted([WEEK]);
    const { server, call } = boot(client);
    servers.push(server);
    const res = await call('alice', LATER);
    assert.equal(res.status, 200);
    assert.equal(res.body.days.length, 2);
    assert.match(asked[0].user, /week 2 of 12/);
    assert.match(asked[0].user, /Add reps/);
    assert.match(asked[0].user, /skipped or missed: Plank: 3 holds/);
  });

  it('needs the week for a program, and the week number for a later week', async () => {
    const { server, call } = boot(scripted([PROGRAM]).client);
    servers.push(server);
    assert.equal((await call('alice', { ...MAKE, week: undefined })).status, 400);
    assert.equal((await call('alice', { ...LATER, weekNumber: undefined })).status, 400);
  });

  it('never trusts an exercise that is not on the menu, or a day that was not picked', async () => {
    const days = [
      { day: 'Mon', name: 'Upper', tasks: [{ exercise: 'Bench press', dose: '3 sets of 8' }, { exercise: 'Invented lift', dose: '9 sets' }, { exercise: 'plank', dose: '2 holds' }] },
      { day: 'Fri', name: 'Not picked', tasks: [{ exercise: 'Leg press', dose: '3 sets' }, { exercise: 'Hip thrust', dose: '3 sets' }] },
      { day: 'Mon', name: 'Twice', tasks: [{ exercise: 'Leg press', dose: '3 sets' }, { exercise: 'Hip thrust', dose: '3 sets' }] },
      { day: 'Wed', name: 'Too thin', tasks: [{ exercise: 'Invented lift', dose: '1' }, { exercise: 'Leg press', dose: '3 sets' }] },
    ];
    const { server, call } = boot(scripted([JSON.stringify({ title: 'T', description: 'D', outline: OUTLINE, week: days })]).client);
    servers.push(server);
    const res = await call('alice', MAKE);
    assert.equal(res.status, 200);
    assert.equal(res.body.program.week.length, 1);
    assert.deepEqual(
      res.body.program.week[0].tasks.map((t: { exercise: string }) => t.exercise),
      ['Bench press', 'Plank'],
      'a real menu exercise matched by name; the invented one is dropped; the match is not case-sensitive',
    );
  });

  it('keeps free tasks and their steps when there is no menu', async () => {
    const { server, call } = boot(scripted([FREE_WEEK]).client);
    servers.push(server);
    const res = await call('alice', { stage: 'week', niche: 'Career', answers: [], week: { days: ['Mon'], minutes: 30, months: 3 }, weekNumber: 2, totalWeeks: 4 });
    assert.equal(res.status, 200);
    assert.equal(res.body.days[0].tasks[0].steps.length, 3);
    assert.equal(res.body.days[0].tasks[1].steps, undefined);
  });

  it('accepts the AI wrapping its JSON in a code fence', async () => {
    const { server, call } = boot(scripted(['```json\n' + PROGRAM + '\n```']).client);
    servers.push(server);
    assert.equal((await call('alice', MAKE)).status, 200);
  });

  it('throws away an answer that is the wrong shape', async () => {
    const { server, call } = boot(scripted([JSON.stringify({ questions: [{ title: 'x', options: ['only one'] }] }), 'not json at all', JSON.stringify({ title: 'T', description: 'D', outline: OUTLINE, week: [] })]).client);
    servers.push(server);
    assert.equal((await call('alice', ASK)).status, 502);
    assert.equal((await call('alice', ASK)).status, 502);
    assert.equal((await call('alice', MAKE)).status, 502);
  });

  it('turns odd characters and long text from the AI into safe text', async () => {
    const free = JSON.stringify({ days: [{ day: 'Mon', name: '  Run\u0000\n  well  ', tasks: [{ text: 'b\u0007c' }, { text: 'ok' }] }] });
    const { server, call } = boot(scripted([free]).client);
    servers.push(server);
    const res = await call('alice', { stage: 'week', niche: 'Career', answers: [], week: { days: ['Mon'], minutes: null, months: 1 }, weekNumber: 2, totalWeeks: 4 });
    assert.equal(res.body.days[0].name, 'Run well');
    assert.equal(res.body.days[0].tasks[0].text, 'b c');
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
    assert.equal((await call('alice', { ...MAKE, stage: 'plan' })).status, 400);
    assert.equal((await call('alice', { ...ASK, answers: Array.from({ length: 31 }, () => ({ q: 'q', a: 'a' })) })).status, 400);
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
