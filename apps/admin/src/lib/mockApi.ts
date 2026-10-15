import type { ContentApi, Repository } from './api';
import { buildSamples } from './samples';

const PREFIX = 'goalpath-admin:';

/** A repository that keeps its items in `localStorage`. Seeds itself the first time. */
function createLocalRepository<T extends { id: string }>(name: string, seed: () => T[]): Repository<T> {
  const key = PREFIX + name;

  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T[];
    } catch {
      /* storage blocked or corrupted: fall through to the samples */
    }
    const first = seed();
    write(first);
    return first;
  };

  const write = (items: T[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* storage full or blocked: the change lasts until the page closes */
    }
  };

  return {
    async list() {
      return read();
    },
    async save(item) {
      const items = read();
      const index = items.findIndex((x) => x.id === item.id);
      if (index === -1) items.unshift(item);
      else items[index] = item;
      write(items);
      return item;
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}

export function createMockApi(): ContentApi {
  return {
    isMock: true,
    banners: createLocalRepository('banners', () => buildSamples().banners),
    popups: createLocalRepository('popups', () => buildSamples().popups),
    pages: createLocalRepository('pages', () => buildSamples().pages),
    plans: createLocalRepository('plans', () => buildSamples().plans),
    async resetSamples() {
      ['banners', 'popups', 'pages', 'plans'].forEach((n) => localStorage.removeItem(PREFIX + n));
    },
  };
}
