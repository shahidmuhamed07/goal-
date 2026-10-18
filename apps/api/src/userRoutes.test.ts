import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { AccessRequest, ChatMessage, ChatThread, Goal, UserProfile } from '@goalpath/shared';
import { createApp } from './app';
import type { Identity } from './auth';
import { MemoryStore } from './memoryStore';
import { DuplicateError } from './store';

/**
 * These tests are the security rules for people's data: who can see a goal, who
 * can change it, who can connect with whom, who can read a chat. Each sentence is
 * something a person must never be able to get wrong.
 */

const NOW = new Date('2026-10-14T12:00:00Z');

const PEOPLE: Record<string, Identity> = {
  'tok-alice': { uid: 'alice', email: 'alice@example.com', emailVerified: true, name: 'Alice Client' },
  'tok-bob': { uid: 'bob', email: 'bob@example.com', emailVerified: true, name: 'Bob Trainer' },
  'tok-carol': { uid: 'carol', email: 'carol@example.com', emailVerified: true, name: 'Carol Stranger' },
  'tok-dan': { uid: 'dan', email: 'dan@example.com', emailVerified: true, name: 'Dan Doctor' },
};

async function verify(token: string): Promise<Identity> {
  const who = PEOPLE[token];
  if (!who) throw new Error('bad token');
  return who;
}

function start(options: { withVerifier?: boolean } = {}) {
  const store = new MemoryStore();
  const app = createApp(store, {
    corsOrigins: ['http://localhost:3000'],
    isProduction: true,
    now: () => NOW,
    userAuth: options.withVerifier === false ? undefined : verify,
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const call = async (as: string | null, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(as ? { authorization: `Bearer tok-${as}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { store, server, call };
}

type Call = ReturnType<typeof start>['call'];

const newGoal = (over: Record<string, unknown> = {}) => ({
  title: 'Run a half marathon',
  category: 'Fitness',
  description: '',
  createdAt: '2026-10-14',
  targetDate: '2027-01',
  milestones: [{ id: 'm1', monthKey: '2026-10', title: 'Checkpoint', completed: false }],
  ...over,
});

/** Everyone signs in once so they have an account and a code. */
async function signInAll(call: Call) {
  const codes: Record<string, string> = {};
  for (const who of ['alice', 'bob', 'carol', 'dan']) {
    const res = await call(who, 'POST', '/me/sync');
    codes[who] = (res.body as UserProfile).code!;
  }
  return codes;
}

/** Alice (client) has a goal, and Bob (trainer) is connected with the given access. */
async function connect(call: Call, codes: Record<string, string>, access: 'none' | 'view' | 'edit') {
  const goal = (await call('alice', 'POST', '/goals', newGoal())).body as Goal;
  await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' });
  await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: access === 'none' ? {} : { [goal.id]: access } });
  return goal;
}

describe('signing in', () => {
  const { server, call } = start();
  after(() => server.close());

  it('refuses everything without a valid login', async () => {
    assert.equal((await call(null, 'GET', '/me')).status, 401);
    assert.equal((await call('nobody', 'GET', '/me')).status, 401);
    assert.equal((await call(null, 'GET', '/goals')).status, 401);
    assert.equal((await call(null, 'GET', '/chats')).status, 401);
  });

  it('creates an account with a 6-character code, and keeps the same code next time', async () => {
    const first = (await call('alice', 'POST', '/me/sync')).body as UserProfile;
    assert.match(first.code!, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(first.id, 'alice');
    assert.equal(first.displayName, 'Alice Client');
    assert.deepEqual(first.collaborators, []);
    const second = (await call('alice', 'POST', '/me/sync')).body as UserProfile;
    assert.equal(second.code, first.code);
    assert.equal(second.createdAt, first.createdAt);
  });

  it('gives different people different codes', async () => {
    const a = (await call('alice', 'GET', '/me')).body as UserProfile;
    const b = (await call('bob', 'POST', '/me/sync')).body as UserProfile;
    assert.notEqual(a.code, b.code);
  });

  it('changes only the fields a person may change about themselves', async () => {
    const ok = await call('alice', 'PATCH', '/me', { persona: 'client', personaChosenAt: '2026-10-14T00:00:00Z' });
    assert.equal(ok.status, 200);
    assert.equal((ok.body as UserProfile).persona, 'client');
    // Nobody can add themselves to their own roster, change their code or write someone else's field.
    for (const sneaky of [{ collaborators: [{ uid: 'carol', role: 'Trainer', addedAt: 'x' }] }, { collaboratorUids: ['carol'] }, { code: 'AAAAAA' }, { id: 'bob' }]) {
      assert.equal((await call('alice', 'PATCH', '/me', sneaky)).status, 400, JSON.stringify(sneaky));
    }
    assert.deepEqual(((await call('alice', 'GET', '/me')).body as UserProfile).collaboratorUids, []);
  });

  it('the store refuses two accounts with one code', async () => {
    const store = new MemoryStore();
    await store.upsert('users', { id: 'a', code: 'ABCDEF' });
    await assert.rejects(store.upsert('users', { id: 'b', code: 'ABCDEF' }), DuplicateError);
    await store.upsert('users', { id: 'a', code: 'ABCDEF' }); // the same account may save itself again
  });
});

describe('login not configured', () => {
  const { server, call } = start({ withVerifier: false });
  after(() => server.close());
  it('answers 503 rather than letting anyone in', async () => {
    assert.equal((await call('alice', 'GET', '/me')).status, 503);
  });
});

describe('goals of my own', () => {
  const { server, call } = start();
  before(async () => {
    await signInAll(call);
  });
  after(() => server.close());

  it('creates a goal that belongs to the person asking, whatever the request claims', async () => {
    const res = await call('alice', 'POST', '/goals', newGoal({ userId: 'carol', viewerUids: ['carol'], editorUids: ['carol'], id: 'hijack' }));
    assert.equal(res.status, 201);
    const goal = res.body as Goal;
    assert.equal(goal.userId, 'alice');
    assert.deepEqual(goal.viewerUids, []);
    assert.deepEqual(goal.editorUids, []);
    assert.notEqual(goal.id, 'hijack');
  });

  it('lists only my own goals', async () => {
    await call('bob', 'POST', '/goals', newGoal({ title: 'Bobs goal' }));
    const mine = (await call('alice', 'GET', '/goals')).body as Goal[];
    assert.ok(mine.length >= 1 && mine.every((g) => g.userId === 'alice'));
  });

  it('shows nothing to someone who asks for another person’s workspace', async () => {
    assert.deepEqual((await call('carol', 'GET', '/goals?workspace=alice')).body, []);
    assert.deepEqual((await call('carol', 'GET', '/goals/shared')).body, []);
  });

  it('lets the owner change every part of a goal', async () => {
    const goal = (await call('alice', 'POST', '/goals', newGoal())).body as Goal;
    const res = await call('alice', 'PATCH', `/goals/${goal.id}`, {
      title: 'New title',
      tasks: [{ id: 't1', text: 'Run', priority: 'high', completed: false, date: '2026-10-15' }],
    });
    assert.equal(res.status, 200);
    assert.equal((res.body as Goal).title, 'New title');
    assert.equal((res.body as Goal).tasks.length, 1);
  });

  it('does not let a request change who owns a goal or who may see it', async () => {
    const goal = (await call('alice', 'POST', '/goals', newGoal())).body as Goal;
    await call('alice', 'PATCH', `/goals/${goal.id}`, { userId: 'carol', viewerUids: ['carol'], editorUids: ['carol'] });
    const after = ((await call('alice', 'GET', '/goals')).body as Goal[]).find((g) => g.id === goal.id)!;
    assert.equal(after.userId, 'alice');
    assert.deepEqual(after.viewerUids, []);
    assert.deepEqual(after.editorUids, []);
  });

  it('refuses malformed goals', async () => {
    assert.equal((await call('alice', 'POST', '/goals', newGoal({ title: '' }))).status, 400);
    assert.equal((await call('alice', 'POST', '/goals', newGoal({ createdAt: 'yesterday' }))).status, 400);
    assert.equal((await call('alice', 'POST', '/goals', newGoal({ tasks: [{ id: 't', text: 'x', priority: 'urgent', completed: false, date: '2026-10-15' }] }))).status, 400);
  });

  it('refuses a goal whose plan is too large to store', async () => {
    const tasks = Array.from({ length: 6000 }, (_, i) => ({ id: `t${i}`, text: 'x'.repeat(150), priority: 'low', completed: false, date: '2026-10-15' }));
    assert.equal((await call('alice', 'POST', '/goals', newGoal({ tasks }))).status, 413);
    // Just under the request limit but over one goal's own ceiling.
    const mid = Array.from({ length: 4500 }, (_, i) => ({ id: `t${i}`, text: 'x'.repeat(180), priority: 'low', completed: false, date: '2026-10-15' }));
    assert.equal((await call('alice', 'POST', '/goals', newGoal({ tasks: mid }))).status, 413);
  });

  it('deletes my goal, and only mine', async () => {
    const goal = (await call('alice', 'POST', '/goals', newGoal())).body as Goal;
    assert.equal((await call('carol', 'DELETE', `/goals/${goal.id}`)).status, 404);
    assert.equal((await call('alice', 'DELETE', `/goals/${goal.id}`)).status, 204);
    assert.equal((await call('alice', 'DELETE', `/goals/${goal.id}`)).status, 404);
  });
});

describe('connecting a professional', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  before(async () => {
    codes = await signInAll(call);
  });
  after(() => server.close());

  it('sends a request using the client’s code', async () => {
    const res = await call('bob', 'POST', '/access-requests', { code: codes.alice.toLowerCase(), role: 'Trainer' });
    assert.equal(res.status, 201);
    assert.equal(res.body.result, 'sent');
    assert.equal(res.body.request.id, 'bob_alice');
    assert.equal(res.body.request.status, 'pending');
    assert.equal(res.body.request.fromName, 'Bob Trainer');
  });

  it('says so when a request is already waiting', async () => {
    const again = await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error, 'already_pending');
  });

  it('refuses your own code, an unknown code and a made-up role', async () => {
    assert.equal((await call('bob', 'POST', '/access-requests', { code: codes.bob, role: 'Trainer' })).body.error, 'own_account');
    assert.equal((await call('bob', 'POST', '/access-requests', { code: 'ZZZZZZ', role: 'Trainer' })).status, 404);
    assert.equal((await call('bob', 'POST', '/access-requests', { code: codes.dan, role: 'Wizard' })).status, 400);
    assert.equal((await call('bob', 'POST', '/access-requests', { code: 'abc', role: 'Trainer' })).status, 400);
  });

  it('shows a request only to the two people in it', async () => {
    const forAlice = (await call('alice', 'GET', '/access-requests')).body as { incoming: AccessRequest[]; outgoing: AccessRequest[] };
    assert.equal(forAlice.incoming.length, 1);
    assert.equal(forAlice.outgoing.length, 0);
    const forBob = (await call('bob', 'GET', '/access-requests')).body as { incoming: AccessRequest[]; outgoing: AccessRequest[] };
    assert.equal(forBob.outgoing.length, 1);
    const forCarol = (await call('carol', 'GET', '/access-requests')).body as { incoming: AccessRequest[]; outgoing: AccessRequest[] };
    assert.deepEqual(forCarol, { incoming: [], outgoing: [] });
  });

  it('lets only the client answer, never the professional or a stranger', async () => {
    for (const who of ['bob', 'carol']) {
      assert.equal((await call(who, 'POST', '/access-requests/bob_alice/approve', { goalAccess: {} })).status, 404, who);
      assert.equal((await call(who, 'POST', '/access-requests/bob_alice/deny')).status, 404, who);
    }
    const stillPending = ((await call('alice', 'GET', '/access-requests')).body as { incoming: AccessRequest[] }).incoming[0];
    assert.equal(stillPending.status, 'pending');
  });

  it('a denied request can be asked again, and then approved', async () => {
    assert.equal((await call('alice', 'POST', '/access-requests/bob_alice/deny')).status, 204);
    assert.equal((await call('alice', 'POST', '/access-requests/bob_alice/deny')).status, 409);
    const again = await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Dietitian' });
    assert.equal(again.body.result, 'sent_again');
    assert.equal(again.body.request.role, 'Dietitian');
    const approved = await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: {} });
    assert.equal(approved.status, 200);
    const profile = approved.body as UserProfile;
    assert.deepEqual(profile.collaboratorUids, ['bob']);
    assert.equal(profile.collaborators![0].role, 'Dietitian');
    assert.equal((await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' })).body.error, 'already_approved');
  });
});

describe('what a connected professional can see and do', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  let goal: Goal;
  before(async () => {
    codes = await signInAll(call);
    goal = await connect(call, codes, 'edit');
  });
  after(() => server.close());

  const plan = { tasks: [{ id: 't1', text: 'Run', priority: 'high', completed: false, date: '2026-10-15' }] };

  it('gives the professional the goals the client chose, in the client’s workspace', async () => {
    const seen = (await call('bob', 'GET', '/goals?workspace=alice')).body as Goal[];
    assert.deepEqual(seen.map((g) => g.id), [goal.id]);
    assert.deepEqual(((await call('bob', 'GET', '/goals/shared')).body as Goal[]).map((g) => g.id), [goal.id]);
    assert.deepEqual((await call('bob', 'GET', '/goals')).body, []); // their own workspace is their own
  });

  it('keeps unrelated people out', async () => {
    assert.deepEqual((await call('carol', 'GET', '/goals?workspace=alice')).body, []);
    assert.equal((await call('carol', 'PATCH', `/goals/${goal.id}`, plan)).status, 404);
    assert.equal((await call('carol', 'DELETE', `/goals/${goal.id}`)).status, 404);
  });

  it('lets an editor change the plan but not the goal itself', async () => {
    const ok = await call('bob', 'PATCH', `/goals/${goal.id}`, plan);
    assert.equal(ok.status, 200);
    assert.equal((ok.body as Goal).tasks.length, 1);
    for (const sneaky of [{ title: 'Mine now' }, { category: 'Health' }, { description: 'x' }, { targetDate: '2030-01' }, { ...plan, title: 'x' }]) {
      assert.equal((await call('bob', 'PATCH', `/goals/${goal.id}`, sneaky)).status, 403, JSON.stringify(sneaky));
    }
    assert.equal((await call('bob', 'DELETE', `/goals/${goal.id}`)).status, 403);
  });

  it('never lets an editor widen their own access', async () => {
    await call('bob', 'PATCH', `/goals/${goal.id}`, { viewerUids: ['carol'], editorUids: ['carol'] });
    const after = ((await call('alice', 'GET', '/goals')).body as Goal[]).find((g) => g.id === goal.id)!;
    assert.deepEqual(after.viewerUids, ['bob']);
    assert.deepEqual(after.editorUids, ['bob']);
  });

  it('shows the client to the professional without the client’s code or first-run answers', async () => {
    await call('alice', 'PATCH', '/me', { onboarding: { age: '30s' } });
    const clients = (await call('bob', 'GET', '/clients')).body as UserProfile[];
    assert.equal(clients.length, 1);
    assert.equal(clients[0].id, 'alice');
    assert.equal(clients[0].code, undefined);
    assert.equal(clients[0].onboarding, undefined);
    const one = (await call('bob', 'GET', '/users/alice')).body as UserProfile;
    assert.equal(one.code, undefined);
    assert.equal(one.onboarding, undefined);
    assert.equal(((await call('alice', 'GET', '/users/alice')).body as UserProfile).code, codes.alice);
  });

  it('hides a client’s account from people they never connected', async () => {
    assert.equal((await call('carol', 'GET', '/users/alice')).status, 404);
    assert.deepEqual((await call('carol', 'GET', '/clients')).body, []);
    assert.equal((await call('carol', 'GET', '/users/nobody-here')).status, 404);
  });
});

describe('the overview', () => {
  const { server, call } = start();
  let goal: Goal;
  before(async () => {
    const codes = await signInAll(call);
    goal = await connect(call, codes, 'edit');
    await call('bob', 'POST', `/chats/alice__bob/messages`, { text: 'hello' });
  });
  after(() => server.close());

  interface Overview {
    profile: UserProfile;
    clients: UserProfile[];
    incoming: AccessRequest[];
    outgoing: AccessRequest[];
    threads: ChatThread[];
    goals: Goal[];
    sharedGoals: Goal[];
  }

  it('gives a client their account, goals, requests and conversations', async () => {
    const res = await call('alice', 'GET', '/overview');
    assert.equal(res.status, 200);
    const o = res.body as Overview;
    assert.equal(o.profile.id, 'alice');
    assert.deepEqual(o.goals.map((g) => g.id), [goal.id]);
    assert.equal(o.incoming.length, 1);
    assert.equal(o.threads.length, 1);
    assert.deepEqual(o.sharedGoals, []);
    assert.deepEqual(o.clients, []);
  });

  it('gives a professional their clients and the goals shared with them, without the client’s code', async () => {
    const o = (await call('bob', 'GET', '/overview')).body as Overview;
    assert.deepEqual(o.sharedGoals.map((g) => g.id), [goal.id]);
    assert.deepEqual(o.goals, []);
    assert.equal(o.clients.length, 1);
    assert.equal(o.clients[0].code, undefined);
    assert.equal(o.outgoing.length, 1);
  });

  it('gives a stranger nothing of anyone else’s', async () => {
    const o = (await call('carol', 'GET', '/overview')).body as Overview;
    assert.deepEqual([o.goals, o.sharedGoals, o.clients, o.incoming, o.outgoing, o.threads], [[], [], [], [], [], []]);
  });

  it('needs a login and an account', async () => {
    assert.equal((await call(null, 'GET', '/overview')).status, 401);
    const fresh = start();
    assert.equal((await fresh.call('dan', 'GET', '/overview')).status, 404);
    fresh.server.close();
  });
});

describe('view-only access', () => {
  const { server, call } = start();
  let goal: Goal;
  before(async () => {
    const codes = await signInAll(call);
    goal = await connect(call, codes, 'view');
  });
  after(() => server.close());

  it('lets a viewer read the goal but change nothing', async () => {
    assert.equal(((await call('bob', 'GET', '/goals?workspace=alice')).body as Goal[]).length, 1);
    const tried = await call('bob', 'PATCH', `/goals/${goal.id}`, { tasks: [] });
    assert.equal(tried.status, 403);
    assert.equal(tried.body.error, 'read_only');
    assert.equal((await call('bob', 'DELETE', `/goals/${goal.id}`)).status, 403);
  });
});

describe('changing who can see what', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  let goalA: Goal;
  let goalB: Goal;
  before(async () => {
    codes = await signInAll(call);
    goalA = await connect(call, codes, 'edit');
    goalB = (await call('alice', 'POST', '/goals', newGoal({ title: 'Second goal' }))).body as Goal;
    await call('carol', 'POST', '/goals', newGoal({ title: 'Carols goal' }));
  });
  after(() => server.close());

  const visibleToBob = async () => ((await call('bob', 'GET', '/goals?workspace=alice')).body as Goal[]).map((g) => g.id).sort();

  it('ignores goals that are not the client’s own when approving or changing access', async () => {
    const carolGoal = ((await call('carol', 'GET', '/goals')).body as Goal[])[0];
    const res = await call('alice', 'PUT', '/collaborators/bob/access', { goalAccess: { [goalA.id]: 'edit', [carolGoal.id]: 'edit' } });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys((res.body as UserProfile).collaborators![0].goalAccess!), [goalA.id]);
    assert.equal(((await call('carol', 'GET', '/goals')).body as Goal[])[0].viewerUids!.includes('bob'), false);
  });

  it('adds and removes a professional goal by goal', async () => {
    assert.deepEqual(await visibleToBob(), [goalA.id]);
    await call('alice', 'PUT', `/goals/${goalB.id}/assignments`, { assignments: { bob: 'view' } });
    assert.deepEqual(await visibleToBob(), [goalA.id, goalB.id].sort());
    await call('alice', 'PUT', `/goals/${goalA.id}/assignments`, { assignments: { bob: null } });
    assert.deepEqual(await visibleToBob(), [goalB.id]);
  });

  it('only the owner of a goal may assign people to it', async () => {
    assert.equal((await call('bob', 'PUT', `/goals/${goalB.id}/assignments`, { assignments: { bob: 'edit' } })).status, 404);
    assert.equal((await call('carol', 'PUT', `/goals/${goalB.id}/assignments`, { assignments: { carol: 'edit' } })).status, 404);
    assert.deepEqual(await visibleToBob(), [goalB.id]);
  });

  it('cannot give access to someone who is not connected', async () => {
    await call('alice', 'PUT', `/goals/${goalB.id}/assignments`, { assignments: { carol: 'edit' } });
    assert.deepEqual((await call('carol', 'GET', '/goals?workspace=alice')).body, []);
  });

  it('a stranger cannot change someone else’s roster', async () => {
    assert.equal((await call('carol', 'PUT', '/collaborators/bob/access', { goalAccess: {} })).status, 404);
    assert.equal((await call('alice', 'PUT', '/collaborators/dan/access', { goalAccess: {} })).status, 404);
  });

  it('starts a new goal with edit access for the professionals picked, and only for connected ones', async () => {
    const goal = (await call('alice', 'POST', '/goals', newGoal({ assignedProfessionalUids: ['bob', 'carol'] }))).body as Goal;
    assert.deepEqual(goal.viewerUids, ['bob']);
    assert.deepEqual(goal.editorUids, ['bob']);
    const roster = ((await call('alice', 'GET', '/me')).body as UserProfile).collaborators!;
    assert.equal(roster.find((c) => c.uid === 'bob')!.goalAccess![goal.id], 'edit');
  });
});

describe('removing a connection', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  let goal: Goal;
  before(async () => {
    codes = await signInAll(call);
    goal = await connect(call, codes, 'edit');
  });
  after(() => server.close());

  it('lets a client remove a professional at once, and the professional can ask again', async () => {
    const res = await call('alice', 'DELETE', '/collaborators/bob');
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as UserProfile).collaboratorUids, []);
    assert.deepEqual((await call('bob', 'GET', '/goals?workspace=alice')).body, []);
    assert.equal((await call('bob', 'PATCH', `/goals/${goal.id}`, { tasks: [] })).status, 404);
    assert.equal(((await call('bob', 'GET', '/access-requests')).body as { outgoing: AccessRequest[] }).outgoing[0].status, 'removed');
    assert.equal((await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' })).body.result, 'sent_again');
  });

  it('lets a professional remove a client, which cuts the access straight away', async () => {
    await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: { [goal.id]: 'edit' } });
    assert.equal((await call('bob', 'DELETE', '/clients/alice')).status, 204);
    assert.deepEqual((await call('bob', 'GET', '/clients')).body, []);
    assert.deepEqual(((await call('alice', 'GET', '/me')).body as UserProfile).collaboratorUids, []);
    assert.deepEqual((await call('bob', 'GET', '/goals?workspace=alice')).body, []);
    assert.equal(((await call('alice', 'GET', '/goals')).body as Goal[])[0].viewerUids!.length, 0);
  });

  it('a stranger removing someone changes nothing', async () => {
    await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' });
    await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: { [goal.id]: 'edit' } });
    await call('carol', 'DELETE', '/clients/alice');
    await call('carol', 'DELETE', '/collaborators/bob');
    assert.deepEqual(((await call('alice', 'GET', '/me')).body as UserProfile).collaboratorUids, ['bob']);
  });

  it('leaving professional mode disconnects every client and switches the account back', async () => {
    await call('dan', 'POST', '/access-requests', { code: codes.carol, role: 'Doctor' });
    await call('carol', 'POST', '/access-requests/dan_carol/approve', { goalAccess: {} });
    await call('bob', 'PATCH', '/me', { persona: 'professional' });
    const res = await call('bob', 'POST', '/me/leave-professional');
    assert.equal(res.status, 200);
    assert.equal(res.body.disconnected, 1);
    assert.equal(res.body.profile.persona, 'client');
    assert.deepEqual(((await call('alice', 'GET', '/me')).body as UserProfile).collaboratorUids, []);
    // Dan is still connected to Carol: only Bob's own connections went.
    assert.deepEqual(((await call('carol', 'GET', '/me')).body as UserProfile).collaboratorUids, ['dan']);
  });
});

describe('a professional’s public profile', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  const profile = { roles: ['Trainer'], credentials: [], showcase: [], displayName: 'Coach Bob', headline: 'Strength coach' };
  before(async () => {
    codes = await signInAll(call);
    await call('bob', 'PUT', '/me/public-profile', profile);
  });
  after(() => server.close());

  it('belongs to its owner, who can always read it', async () => {
    const mine = (await call('bob', 'GET', '/public-profiles/bob')).body;
    assert.equal(mine.displayName, 'Coach Bob');
    assert.equal(mine.uid, 'bob');
  });

  it('is private until a client has approved that professional', async () => {
    assert.equal((await call('alice', 'GET', '/public-profiles/bob')).status, 404);
    assert.equal((await call('carol', 'GET', '/public-profiles/bob')).status, 404);
    await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' });
    assert.equal((await call('alice', 'GET', '/public-profiles/bob')).status, 404, 'a pending request is not enough');
    await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: {} });
    assert.equal((await call('alice', 'GET', '/public-profiles/bob')).status, 200);
    assert.equal((await call('carol', 'GET', '/public-profiles/bob')).status, 404);
  });

  it('can only be written by its owner, for their own account', async () => {
    await call('carol', 'PUT', '/me/public-profile', { ...profile, uid: 'bob', displayName: 'Hacked' });
    assert.equal((await call('bob', 'GET', '/public-profiles/bob')).body.displayName, 'Coach Bob');
    assert.equal((await call('carol', 'GET', '/public-profiles/carol')).body.displayName, 'Hacked');
  });

  it('refuses links that are not web addresses', async () => {
    const bad = { ...profile, referenceUrl: 'javascript:alert(1)' };
    assert.equal((await call('bob', 'PUT', '/me/public-profile', bad)).status, 400);
    const badShowcase = { ...profile, showcase: [{ id: 's1', title: 'x', link: 'data:text/html,hi' }] };
    assert.equal((await call('bob', 'PUT', '/me/public-profile', badShowcase)).status, 400);
    const fine = { ...profile, referenceUrl: 'https://www.linkedin.com/in/bob' };
    assert.equal((await call('bob', 'PUT', '/me/public-profile', fine)).status, 200);
    assert.equal((await call('bob', 'PUT', '/me/public-profile', { ...profile, referenceUrl: '' })).status, 200);
  });
});

describe('chat', () => {
  const { server, call } = start();
  const chat = 'alice__bob';
  before(async () => {
    const codes = await signInAll(call);
    await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' });
  });
  after(() => server.close());

  it('only lets people write to someone they are connected with', async () => {
    const early = await call('bob', 'POST', `/chats/${chat}/messages`, { text: 'hello' });
    assert.equal(early.status, 403);
    assert.equal(early.body.error, 'not_connected');
    assert.equal((await call('alice', 'POST', '/access-requests/bob_alice/approve', { goalAccess: {} })).status, 200);
  });

  it('delivers messages in order, with the sender taken from the login', async () => {
    const first = await call('bob', 'POST', `/chats/${chat}/messages`, { text: 'Ready for Monday?', senderUid: 'alice', senderName: 'Not Bob' });
    assert.equal(first.status, 201);
    assert.equal((first.body as ChatMessage).senderUid, 'bob');
    assert.equal((first.body as ChatMessage).senderName, 'Bob Trainer');
    await call('alice', 'POST', `/chats/${chat}/messages`, { text: 'Yes!' });
    const thread = (await call('alice', 'GET', `/chats/${chat}/messages`)).body as ChatMessage[];
    assert.deepEqual(thread.map((m) => m.text), ['Ready for Monday?', 'Yes!']);
    assert.equal('chatId' in thread[0], false);
  });

  it('keeps a conversation private to its two people', async () => {
    assert.equal((await call('carol', 'GET', `/chats/${chat}/messages`)).status, 404);
    assert.equal((await call('carol', 'POST', `/chats/${chat}/messages`, { text: 'hi' })).status, 404);
    assert.equal((await call('carol', 'POST', `/chats/${chat}/read`)).status, 404);
    assert.deepEqual((await call('carol', 'GET', '/chats')).body, []);
  });

  it('refuses an id that is not a conversation between two different people', async () => {
    for (const odd of ['bob__alice', 'alice__alice', 'alice', 'alice__bob__carol']) {
      assert.equal((await call('alice', 'GET', `/chats/${odd}/messages`)).status, 404, odd);
    }
  });

  it('refuses empty and oversized messages', async () => {
    assert.equal((await call('alice', 'POST', `/chats/${chat}/messages`, { text: '   ' })).status, 400);
    assert.equal((await call('alice', 'POST', `/chats/${chat}/messages`, { text: 'x'.repeat(4001) })).status, 400);
  });

  it('tracks what each person has read', async () => {
    const before = ((await call('alice', 'GET', '/chats')).body as ChatThread[])[0];
    assert.deepEqual(before.participantUids, ['alice', 'bob']);
    assert.equal(before.lastMessage!.text, 'Yes!');
    assert.ok(before.lastRead!.alice);
    assert.equal((await call('bob', 'POST', `/chats/${chat}/read`)).status, 204);
    const after = ((await call('bob', 'GET', '/chats')).body as ChatThread[])[0];
    assert.ok(after.lastRead!.bob);
  });

  it('can still be read after the connection ends, but not added to', async () => {
    await call('alice', 'DELETE', '/collaborators/bob');
    assert.equal(((await call('bob', 'GET', `/chats/${chat}/messages`)).body as ChatMessage[]).length, 2);
    assert.equal((await call('bob', 'POST', `/chats/${chat}/messages`, { text: 'still there?' })).status, 403);
  });
});

describe('hammering', () => {
  const { server, call } = start();
  let codes: Record<string, string>;
  before(async () => {
    codes = await signInAll(call);
  });
  after(() => server.close());

  it('slows down someone who keeps guessing access codes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await call('carol', 'POST', '/access-requests', { code: 'ZZZZ' + (i % 10) + 'Z', role: 'Trainer' })).status);
    assert.ok(statuses.slice(0, 10).every((s) => s === 404));
    assert.equal(statuses[10], 429);
    // Someone else is not slowed down by it.
    assert.equal((await call('bob', 'POST', '/access-requests', { code: codes.alice, role: 'Trainer' })).status, 201);
  });
});
