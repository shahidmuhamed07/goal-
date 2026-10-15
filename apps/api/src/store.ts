import type { ContentCollection } from '@goalpath/shared';

/**
 * Everything the store can hold. `admins` is the list of managers; it is NOT
 * one of the content collections, so the generic content routes can never read
 * or write it.
 */
export type StoreCollection = ContentCollection | 'admins';

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
