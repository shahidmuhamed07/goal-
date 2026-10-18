import { auth } from '../firebase';
import { API_URL } from './config';

/** The API said no, or could not be reached. `code` is its short reason (`not_found`, `read_only`, ...). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
  }
}

/** The signed-in person's login token, which the API turns into who is asking. */
async function loginToken(forceRefresh = false): Promise<string> {
  const current = auth.currentUser;
  if (!current) throw new ApiError(401, 'login_required');
  return current.getIdToken(forceRefresh);
}

async function send(method: string, path: string, body: unknown, token: string, signal?: AbortSignal) {
  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}

/**
 * One call to the API as the signed-in person. An expired login token is renewed
 * once and the call repeated. Anything that is not a success becomes an `ApiError`.
 */
export async function api<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'api_not_configured');
  let res: Response;
  try {
    res = await send(method, path, body, await loginToken(), signal);
    if (res.status === 401) res = await send(method, path, body, await loginToken(true), signal);
  } catch (err) {
    if (err instanceof ApiError || (err instanceof DOMException && err.name === 'AbortError')) throw err;
    throw new ApiError(0, 'unreachable');
  }
  if (!res.ok) {
    let code = 'error';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) code = data.error;
    } catch {
      /* no body */
    }
    throw new ApiError(res.status, code);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
