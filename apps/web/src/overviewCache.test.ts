import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_CACHE_BYTES, clearOverviewCache, readOverviewCache, writeOverviewCache, type KeyValueStore } from './api/overviewCache';
import type { Overview } from './api/appApi';

/** A stand-in for localStorage. */
const memoryStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
};

const overview = (uid: string, extra: Partial<Overview> = {}): Overview => ({
  profile: { id: uid, displayName: 'A' },
  clients: [],
  incoming: [],
  outgoing: [],
  threads: [],
  goals: [],
  sharedGoals: [],
  ...extra,
});

describe('the saved first picture', () => {
  it('is read back for the same account', () => {
    const store = memoryStore();
    assert.equal(writeOverviewCache('u1', overview('u1'), store), true);
    assert.deepEqual(readOverviewCache('u1', store)?.profile.id, 'u1');
  });

  it('is never shown to a different account', () => {
    const store = memoryStore();
    writeOverviewCache('u1', overview('u1'), store);
    assert.equal(readOverviewCache('u2', store), null);
    // Even if someone copied one account's picture under another account's key.
    store.setItem('goalpath:overview:u2', store.getItem('goalpath:overview:u1')!);
    assert.equal(readOverviewCache('u2', store), null);
  });

  it('is ignored when it is damaged, old or incomplete', () => {
    const store = memoryStore();
    store.setItem('goalpath:overview:u1', '{not json');
    assert.equal(readOverviewCache('u1', store), null);
    store.setItem('goalpath:overview:u1', JSON.stringify({ v: 0, uid: 'u1', data: overview('u1') }));
    assert.equal(readOverviewCache('u1', store), null);
    store.setItem('goalpath:overview:u1', JSON.stringify({ v: 1, uid: 'u1', data: { profile: { id: 'u1' } } }));
    assert.equal(readOverviewCache('u1', store), null);
  });

  it('is not kept when it is too large, and an older smaller one is dropped', () => {
    const store = memoryStore();
    writeOverviewCache('u1', overview('u1'), store);
    const huge = overview('u1', { goals: [{ id: 'g', userId: 'u1', title: 'x'.repeat(MAX_CACHE_BYTES), category: 'c', createdAt: '', targetDate: '', milestones: [], subcategories: [], tasks: [] }] });
    assert.equal(writeOverviewCache('u1', huge, store), false);
    assert.equal(readOverviewCache('u1', store), null);
  });

  it('is removed for everyone on sign-out, and nothing else is touched', () => {
    const store = memoryStore();
    writeOverviewCache('u1', overview('u1'), store);
    writeOverviewCache('u2', overview('u2'), store);
    store.setItem('something-else', '1');
    clearOverviewCache(store);
    assert.equal(readOverviewCache('u1', store), null);
    assert.equal(readOverviewCache('u2', store), null);
    assert.equal(store.getItem('something-else'), '1');
  });

  it('does nothing when storage is not available (a private window)', () => {
    assert.equal(readOverviewCache('u1', null), null);
    assert.equal(writeOverviewCache('u1', overview('u1'), null), false);
    clearOverviewCache(null);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      key: () => null,
      length: 0,
    };
    assert.equal(readOverviewCache('u1', broken), null);
    assert.equal(writeOverviewCache('u1', overview('u1'), broken), false);
  });
});
