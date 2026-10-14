import { useCallback, useEffect, useState } from 'react';
import type { Repository } from './api';

interface Collection<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  save: (item: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

/** Loads a repository's items and keeps them fresh after every change. */
export function useCollection<T extends { id: string }>(repo: Repository<T>): Collection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await repo.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (item: T) => {
      await repo.save(item);
      await reload();
    },
    [repo, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id);
      await reload();
    },
    [repo, reload],
  );

  return { items, loading, error, save, remove, reload };
}
