import type { Banner, ContentCollection, Page, PlanTemplate, Popup } from '@goalpath/shared';
import type { ContentApi, Repository } from './api';

/** Gives the current login token, or null when nobody is signed in. */
export type TokenGetter = () => Promise<string | null>;

export type MeResult = { status: 'allowed'; email: string | null } | { status: 'login-required' } | { status: 'not-allowed' };

/**
 * Asks the API "who am I, and may I use the admin?". With no login set up on a
 * developer's machine the API answers yes with no email, so the admin opens directly.
 */
export async function checkAccess(baseUrl: string, token: string | null): Promise<MeResult> {
  const res = await fetch(`${baseUrl}/api/admin/me`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (res.status === 200) return { status: 'allowed', email: ((await res.json()) as { email: string | null }).email };
  if (res.status === 403) return { status: 'not-allowed' };
  if (res.status === 401) return { status: 'login-required' };
  throw new Error(res.status === 503 ? 'The admin is locked on this server until login is set up.' : 'The server had a problem. Please try again.');
}

/** Turns a failed reply into a sentence a person can act on. */
async function explain(res: Response): Promise<string> {
  let body: { error?: string; issues?: { path: string; message: string }[]; field?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* no JSON body */
  }
  if (res.status === 400 && body.issues?.length) {
    return `Not saved: ${body.issues.map((i) => `${i.path || 'item'} ${i.message}`).join('; ')}`;
  }
  if (res.status === 409) return 'Another page already uses this address. Choose a different one.';
  if (res.status === 401) return 'Your sign-in has expired. Please sign in again.';
  if (res.status === 403) return 'This Google account is not allowed to change content.';
  if (res.status === 503) return 'The admin is locked on this server until login is set up.';
  if (res.status === 404) return 'That item no longer exists.';
  return 'The server had a problem. Please try again.';
}

function createRepository<T extends { id: string }>(
  baseUrl: string,
  collection: ContentCollection,
  getToken: TokenGetter,
): Repository<T> {
  const url = (id?: string) => `${baseUrl}/api/admin/${collection}${id ? `/${encodeURIComponent(id)}` : ''}`;

  const send = async (input: string, init?: RequestInit): Promise<Response> => {
    let res: Response;
    try {
      const token = await getToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set('authorization', `Bearer ${token}`);
      res = await fetch(input, { ...init, headers });
    } catch {
      throw new Error(`Cannot reach the API at ${baseUrl}. Is it running?`);
    }
    if (!res.ok) throw new Error(await explain(res));
    return res;
  };

  return {
    async list() {
      return (await (await send(url())).json()) as T[];
    },
    async save(item) {
      const res = await send(url(item.id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item),
      });
      return (await res.json()) as T;
    },
    async remove(id) {
      await send(url(id), { method: 'DELETE' });
    },
  };
}

/** Talks to the real backend. */
export function createHttpApi(baseUrl: string, getToken: TokenGetter): ContentApi {
  return {
    isMock: false,
    banners: createRepository<Banner>(baseUrl, 'banners', getToken),
    popups: createRepository<Popup>(baseUrl, 'popups', getToken),
    pages: createRepository<Page>(baseUrl, 'pages', getToken),
    plans: createRepository<PlanTemplate>(baseUrl, 'plans', getToken),
  };
}
