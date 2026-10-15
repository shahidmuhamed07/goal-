import { getIdToken } from './firebase';
import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';

/**
 * The one place that decides where content comes from.
 * Default: the real API, with the signed-in person's login token on every request.
 * Set VITE_USE_MOCK=true for practice mode (browser storage, no login).
 */
export const apiLocation: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

export const api = import.meta.env.VITE_USE_MOCK === 'true' ? createMockApi() : createHttpApi(apiLocation, getIdToken);
