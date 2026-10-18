/**
 * Where the API lives. In development it defaults to the local API; in production
 * it is set at build time (`VITE_API_URL`). Without it the app cannot reach its
 * data, so the build must always set it.
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3002' : '');
