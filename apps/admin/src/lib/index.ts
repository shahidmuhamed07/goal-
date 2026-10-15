import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';

/**
 * The one place that decides where content comes from.
 * Default: the real API. Set VITE_USE_MOCK=true for practice mode (browser storage).
 */
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

export const api = import.meta.env.VITE_USE_MOCK === 'true' ? createMockApi() : createHttpApi(apiUrl);
export const apiLocation = apiUrl;
