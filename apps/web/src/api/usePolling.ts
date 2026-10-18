import { useCallback, useEffect, useRef, useState } from 'react';

interface PollingOptions {
  /** Nothing is fetched while this is false (for example before sign-in). */
  enabled: boolean;
  intervalMs: number;
  /** When this changes the data is thrown away and fetched again (for example a different person signed in). */
  resetKey?: string;
}

/**
 * Keeps a piece of data fresh by asking for it every few seconds while the app
 * is on screen, and again as soon as the person comes back to it.
 *
 * Changes made on this device are shown at once through `setData`. Because an
 * answer that was already on its way might still describe the time before the
 * change, `touch()` throws such answers away; the next ask fetches the truth.
 */
export function usePolling<T>(load: (signal: AbortSignal) => Promise<T>, { enabled, intervalMs, resetKey }: PollingOptions) {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  const loadRef = useRef(load);
  loadRef.current = load;
  const generation = useRef(0);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const aborter = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const myGeneration = generation.current;
    const myRequest = (requestId.current += 1);
    aborter.current?.abort();
    const controller = new AbortController();
    aborter.current = controller;
    inFlight.current = true;
    try {
      const fresh = await loadRef.current(controller.signal);
      if (generation.current !== myGeneration || requestId.current !== myRequest) return;
      setDataState(fresh);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted || generation.current !== myGeneration || requestId.current !== myRequest) return;
      setError(err);
    } finally {
      if (requestId.current === myRequest) {
        inFlight.current = false;
        setLoaded(true);
      }
    }
  }, []);

  /** Discards any answer still on its way. Call it when this device changes the data. */
  const touch = useCallback(() => {
    generation.current += 1;
  }, []);

  /** Shows a change at once, like React's own setter. */
  const setData = useCallback((next: T | ((prev: T | undefined) => T | undefined)) => {
    generation.current += 1;
    setDataState((prev) => (typeof next === 'function' ? (next as (p: T | undefined) => T | undefined)(prev) : next));
  }, []);

  useEffect(() => {
    if (!enabled) {
      aborter.current?.abort();
      generation.current += 1;
      setDataState(undefined);
      setError(null);
      setLoaded(false);
      return undefined;
    }
    void refresh();
    const tick = () => {
      if (document.visibilityState === 'visible' && !inFlight.current) void refresh();
    };
    const timer = window.setInterval(tick, intervalMs);
    const back = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
      aborter.current?.abort();
    };
  }, [enabled, intervalMs, resetKey, refresh]);

  return { data, setData, error, loaded, refresh, touch };
}
