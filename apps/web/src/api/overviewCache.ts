import type { Overview } from './appApi';

/**
 * The last answer from the server, kept on this device so the app can open on it at once
 * and update a moment later, even while a sleeping server is still waking.
 *
 * It belongs to one account (its key holds the uid), is replaced every time fresh data
 * arrives, and is removed on sign-out. It is only a first picture: the next answer from the
 * server always wins.
 */

const PREFIX = 'goalpath:overview:';
/** Bumped when the shape of the answer changes, so an old picture is never read as a new one. */
const VERSION = 1;
/** A goal with a long plan can be large; past this the picture is simply not kept (browsers allow about 5 MB). */
export const MAX_CACHE_BYTES = 2_000_000;

/** The part of `localStorage` this needs, so tests can pass a plain object. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const defaultStore = (): KeyValueStore | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked storage (a private window)
  }
};

/** The saved picture for this account, or null when there is none or it cannot be trusted. */
export const readOverviewCache = (uid: string, store: KeyValueStore | null = defaultStore()): Overview | null => {
  if (!store || !uid) return null;
  try {
    const raw = store.getItem(PREFIX + uid);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { v?: number; uid?: string; data?: Overview };
    if (saved.v !== VERSION || saved.uid !== uid || !saved.data) return null;
    // It must be this account's own picture, and have the pieces the app reads.
    if (saved.data.profile?.id !== uid || !Array.isArray(saved.data.goals) || !Array.isArray(saved.data.sharedGoals)) return null;
    return saved.data;
  } catch {
    return null;
  }
};

/** Keeps the picture. Returns false when it was too large or storage refused it. */
export const writeOverviewCache = (uid: string, data: Overview, store: KeyValueStore | null = defaultStore()): boolean => {
  if (!store || !uid) return false;
  try {
    const text = JSON.stringify({ v: VERSION, uid, data });
    if (text.length > MAX_CACHE_BYTES) {
      store.removeItem(PREFIX + uid);
      return false;
    }
    store.setItem(PREFIX + uid, text);
    return true;
  } catch {
    return false; // storage full or blocked
  }
};

/** Removes every saved picture, for any account. Used on sign-out so nothing stays behind. */
export const clearOverviewCache = (store: KeyValueStore | null = defaultStore()): void => {
  if (!store) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => store.removeItem(key));
  } catch {
    /* nothing to do */
  }
};
