import { createMockApi } from './mockApi';

/**
 * The one place that decides where content comes from.
 * Swap `createMockApi()` for an HTTP-backed implementation when the backend is ready.
 */
export const api = createMockApi();
