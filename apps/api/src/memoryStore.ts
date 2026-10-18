import { DuplicateError, type ContentStore, type Doc, type Filter, type FindOptions, type StoreCollection } from './store';

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
    // Same rule MongoDB enforces with a unique index on access codes.
    if (c === 'users' && typeof doc.code === 'string' && [...b.values()].some((u) => u.id !== doc.id && u.code === doc.code)) {
      throw new DuplicateError('code');
    }
    b.set(doc.id, structuredClone(doc));
  }

  async find(c: StoreCollection, filter: Filter, options: FindOptions = {}) {
    const matches = (d: Doc) =>
      Object.entries(filter).every(([field, wanted]) => {
        const value = d[field];
        return Array.isArray(value) ? value.includes(wanted) : value === wanted;
      });
    let rows = [...this.bucket(c).values()].filter(matches).map((d) => structuredClone(d));
    if (options.sort) {
      const desc = options.sort.startsWith('-');
      const field = desc ? options.sort.slice(1) : options.sort;
      rows.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (desc ? -1 : 1));
    }
    if (options.limit) rows = rows.slice(0, options.limit);
    return rows;
  }

  async remove(c: StoreCollection, id: string) {
    return this.bucket(c).delete(id);
  }
}
