import type { ContentCollection } from '@goalpath/shared';
import { DuplicateError, type ContentStore, type Doc } from './store';

/** Keeps everything in memory. Gone when the server stops: for tests and demos. */
export class MemoryStore implements ContentStore {
  private data = new Map<ContentCollection, Map<string, Doc>>();

  private bucket(c: ContentCollection) {
    let b = this.data.get(c);
    if (!b) this.data.set(c, (b = new Map()));
    return b;
  }

  async ready() {}
  async close() {}

  async list(c: ContentCollection) {
    return [...this.bucket(c).values()].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  }

  async upsert(c: ContentCollection, doc: Doc) {
    const b = this.bucket(c);
    // Same rule MongoDB enforces with a unique index on page addresses.
    if (c === 'pages' && [...b.values()].some((p) => p.id !== doc.id && p.slug === doc.slug)) {
      throw new DuplicateError('slug');
    }
    b.set(doc.id, structuredClone(doc));
  }

  async remove(c: ContentCollection, id: string) {
    return this.bucket(c).delete(id);
  }
}
