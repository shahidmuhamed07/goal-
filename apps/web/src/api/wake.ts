import { API_URL } from './config';

/**
 * Asks the API a tiny question the moment the page opens, and ignores the answer.
 *
 * The API runs on a plan that puts it to sleep when it has been idle, and waking it takes
 * up to a minute. Sending this at page load, before the person has even signed in, means the
 * server is already waking while they pick an account, instead of starting only after.
 */
export function wakeApi(): void {
  if (!API_URL) return;
  try {
    void fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(() => {
      /* offline or the server is slow: nothing to do, the app retries on its own */
    });
  } catch {
    /* fetch unavailable (an old browser or a test): nothing to do */
  }
}
