import { DuplicateError, type ContentStore, type Doc, type StoreCollection } from './store';

/** Keeps everything in memory. Gone when the server stops: for tests and demos. */
export class MemoryStore implements ContentStore {
  private data = new Map<StoreCollection, Map<string, Doc>>();

  private bucket(c: StoreCollection) {
    let b = this.data.get(c);
    if (!b) this.data.set(c, (b = new Map()));
    return b;
  }

  async ready() {}
  async close() {}

  async list(c: StoreCollection) {
    const stamp = (d: Doc) => String(d.updatedAt ?? d.addedAt ?? '');
    return [...this.bucket(c).values()].sort((a, b) => stamp(b).localeCompare(stamp(a)));
  }

  async get(c: StoreCollection, id: string) {
    const doc = this.bucket(c).get(id);
    return doc ? structuredClone(doc) : null;
  }

  async upsert(c: StoreCollection, doc: Doc) {
    const b = this.bucket(c);
    // Same rule MongoDB enforces with a unique index on page addresses.
    if (c === 'pages' && [...b.values()].some((p) => p.id !== doc.id && p.slug === doc.slug)) {
      throw new DuplicateError('slug');
    }
    b.set(doc.id, structuredClone(doc));
  }

  async remove(c: StoreCollection, id: string) {
    return this.bucket(c).delete(id);
  }
}
