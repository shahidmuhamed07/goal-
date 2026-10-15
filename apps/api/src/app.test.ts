import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { Banner, LiveContent } from '@goalpath/shared';
import { createApp } from './app';
import { MemoryStore } from './memoryStore';

const NOW = new Date('2026-10-14T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function banner(over: Partial<Banner>): Banner {
  return {
    id: 'ban_x', name: 'Test', placement: 'goals-banner', title: 'Hello', tone: 'brand', audience: 'everyone',
    priority: 1, status: 'published', createdAt: day(-5), updatedAt: day(-1), ...over,
  };
}

function startServer(isProduction = false) {
  const store = new MemoryStore();
  const app = createApp(store, { corsOrigins: ['http://localhost:3000'], isProduction, now: () => NOW });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { store, server, base };
}

const put = <T extends { id: string }>(base: string, collection: string, item: T) =>
  fetch(`${base}/api/admin/${collection}/${item.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) });

describe('live content', () => {
  const { store, server, base } = startServer();
  before(async () => {
    await store.upsert('banners', banner({ id: 'ban_live', title: 'Live', priority: 5 }) as never);
    await store.upsert('banners', banner({ id: 'ban_top', title: 'Top', priority: 50 }) as never);
    await store.upsert('banners', banner({ id: 'ban_draft', status: 'draft' }) as never);
    await store.upsert('banners', banner({ id: 'ban_future', startsAt: day(2) }) as never);
    await store.upsert('banners', banner({ id: 'ban_ended', endsAt: day(-2) }) as never);
    await store.upsert('banners', banner({ id: 'ban_owners', audience: 'owners' }) as never);
    await store.upsert('banners', banner({ id: 'ban_pros', audience: 'professionals' }) as never);
  });
  after(() => server.close());

  const live = async (qs = '') => (await (await fetch(`${base}/api/content/live${qs}`)).json()) as LiveContent;

  it('shows published items inside their dates, highest priority first', async () => {
    const ids = (await live('?role=owner')).banners.map((b) => b.id);
    assert.deepEqual(ids, ['ban_top', 'ban_live', 'ban_owners']);
  });

  it('hides drafts, future items and ended items', async () => {
    const ids = (await live('?role=owner')).banners.map((b) => b.id);
    for (const hidden of ['ban_draft', 'ban_future', 'ban_ended']) assert.ok(!ids.includes(hidden), hidden);
  });

  it('filters by audience', async () => {
    assert.ok((await live('?role=professional')).banners.some((b) => b.id === 'ban_pros'));
    assert.ok(!(await live('?role=professional')).banners.some((b) => b.id === 'ban_owners'));
  });

  it('shows a logged-out visitor only items for everyone', async () => {
    const ids = (await live()).banners.map((b) => b.id);
    assert.deepEqual(ids, ['ban_top', 'ban_live']);
  });

  it('never exposes internal fields', async () => {
    const first = (await live()).banners[0] as Record<string, unknown>;
    for (const key of ['name', 'status', 'audience', 'createdAt', 'updatedAt', 'startsAt', 'endsAt']) assert.ok(!(key in first), key);
  });
});

describe('admin', () => {
  const { server, base } = startServer();
  after(() => server.close());

  it('creates, lists and deletes a banner', async () => {
    const item = banner({ id: 'ban_new' });
    assert.equal((await put(base, 'banners', item)).status, 200);
    const list = (await (await fetch(`${base}/api/admin/banners`)).json()) as Banner[];
    assert.equal(list.length, 1);
    assert.equal((await fetch(`${base}/api/admin/banners/ban_new`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/api/admin/banners/ban_new`, { method: 'DELETE' })).status, 404);
  });

  it('rejects invalid content with 400 and says what is wrong', async () => {
    const res = await put(base, 'banners', { ...banner({ id: 'ban_bad' }), title: '' });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { issues: { path: string }[] };
    assert.ok(body.issues.some((i) => i.path === 'title'));
  });

  it('rejects unknown fields', async () => {
    assert.equal((await put(base, 'banners', { ...banner({ id: 'ban_extra' }), isAdmin: true } as never)).status, 400);
  });

  it('rejects dangerous links and non-https images', async () => {
    assert.equal((await put(base, 'banners', banner({ id: 'ban_js', ctaLabel: 'Go', ctaUrl: 'javascript:alert(1)' }))).status, 400);
    assert.equal((await put(base, 'banners', banner({ id: 'ban_http', imageUrl: 'http://example.com/a.png' }))).status, 400);
    assert.equal((await put(base, 'banners', banner({ id: 'ban_ok', ctaLabel: 'Go', ctaUrl: '/pages/summer' }))).status, 200);
  });

  it('rejects an id in the body that differs from the address', async () => {
    const res = await fetch(`${base}/api/admin/banners/other_id`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(banner({ id: 'ban_a' })) });
    assert.equal(res.status, 400);
  });

  it('refuses a second page with the same address (409)', async () => {
    const page = (id: string) => ({ id, slug: 'summer', title: 'Summer', audience: 'everyone', status: 'draft', blocks: [], createdAt: day(-1), updatedAt: day(-1) });
    assert.equal((await put(base, 'pages', page('page_1'))).status, 200);
    assert.equal((await put(base, 'pages', page('page_2'))).status, 409);
    assert.equal((await put(base, 'pages', page('page_1'))).status, 200); // editing itself is fine
  });

  it('returns 404 for an unknown collection', async () => {
    assert.equal((await fetch(`${base}/api/admin/secrets`)).status, 404);
  });
});

describe('production safety', () => {
  const { server, base } = startServer(true);
  after(() => server.close());

  it('admin routes refuse to run until real authentication exists', async () => {
    assert.equal((await fetch(`${base}/api/admin/banners`)).status, 503);
    assert.equal((await put(base, 'banners', banner({ id: 'ban_prod' }))).status, 503);
  });

  it('public content still works', async () => {
    assert.equal((await fetch(`${base}/api/content/live`)).status, 200);
  });
});

describe('admin login', () => {
  // A fake token checker: the token text decides who you are.
  const verify = async (token: string) => {
    if (token === 'owner-token') return { email: 'owner@example.com', emailVerified: true };
    if (token === 'stranger-token') return { email: 'stranger@example.com', emailVerified: true };
    if (token === 'unverified-token') return { email: 'owner@example.com', emailVerified: false };
    throw new Error('bad token');
  };
  const store = new MemoryStore();
  const app = createApp(store, {
    corsOrigins: ['http://localhost:3001'],
    isProduction: true, // login must work in production, where the "open" fallback is off
    adminAuth: { verify, allowedEmails: ['owner@example.com'] },
    now: () => NOW,
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());

  const get = (path: string, token?: string) => fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('lets the owner in and says who they are', async () => {
    const res = await get('/api/admin/me', 'owner-token');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { email: 'owner@example.com' });
  });

  it('lets the owner read and write content', async () => {
    const item = banner({ id: 'ban_auth' });
    const res = await fetch(`${base}/api/admin/banners/${item.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner-token' },
      body: JSON.stringify(item),
    });
    assert.equal(res.status, 200);
    assert.equal((await get('/api/admin/banners', 'owner-token')).status, 200);
  });

  it('asks for a login when there is no token (401)', async () => {
    assert.equal((await get('/api/admin/banners')).status, 401);
  });

  it('refuses a token that is not valid (401)', async () => {
    assert.equal((await get('/api/admin/banners', 'forged-token')).status, 401);
  });

  it('refuses a real login that is not on the list (403)', async () => {
    assert.equal((await get('/api/admin/banners', 'stranger-token')).status, 403);
  });

  it('refuses an email that is not verified (403)', async () => {
    assert.equal((await get('/api/admin/banners', 'unverified-token')).status, 403);
  });

  it('refuses writes from a stranger and stores nothing', async () => {
    const res = await fetch(`${base}/api/admin/banners/ban_evil`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer stranger-token' },
      body: JSON.stringify(banner({ id: 'ban_evil' })),
    });
    assert.equal(res.status, 403);
    assert.ok(!(await store.list('banners')).some((b) => b.id === 'ban_evil'));
  });

  it('keeps public content open to everyone', async () => {
    assert.equal((await get('/api/content/live')).status, 200);
  });

  it('allows the Authorization header in a browser preflight', async () => {
    const res = await fetch(`${base}/api/admin/banners`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3001', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' },
    });
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/i);
  });
});
