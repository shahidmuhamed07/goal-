import type { ContentCollection } from '@goalpath/shared';

/**
 * Everything the store can hold. `admins` is the list of managers; it is NOT
 * one of the content collections, so the generic content routes can never read
 * or write it. The rest is people's own data (see `userRoutes.ts`).
 */
export type StoreCollection =
  | ContentCollection
  | 'admins'
  | 'users'
  | 'goals'
  | 'accessRequests'
  | 'publicProfiles'
  | 'chats'
  | 'messages';

/**
 * A simple lookup: every field named must match. A field holding a list matches
 * when the list contains the value, so `{ viewerUids: 'abc' }` finds every
 * document whose `viewerUids` includes `abc`.
 */
export type Filter = Record<string, string | number | boolean>;

export interface FindOptions {
  /** A field to sort by, ascending, or descending when it starts with `-`. */
  sort?: string;
  limit?: number;
}

/** A stored item: always has a string `id`, plus whatever fields its kind defines. */
export type Doc = { id: string } & Record<string, unknown>;

/**
 * Where content lives. The routes only know this interface, so MongoDB can be
 * swapped for memory (tests) or something else without touching a route.
 */
export interface ContentStore {
  ready(): Promise<void>;
  list(collection: StoreCollection): Promise<Doc[]>;
  get(collection: StoreCollection, id: string): Promise<Doc | null>;
  find(collection: StoreCollection, filter: Filter, options?: FindOptions): Promise<Doc[]>;
  /** Creates or replaces. Throws a `DuplicateError` when a unique field (a page address) is taken. */
  upsert(collection: StoreCollection, doc: Doc): Promise<void>;
  /** Returns whether something was removed. */
  remove(collection: StoreCollection, id: string): Promise<boolean>;
  close(): Promise<void>;
}

export class DuplicateError extends Error {
  constructor(public field: string) {
    super(`${field} is already used`);
  }
}
