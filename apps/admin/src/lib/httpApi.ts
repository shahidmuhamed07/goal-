import type { AdminRole, Banner, ContentCollection, Page, PlanTemplate, Popup, TeamMember } from '@goalpath/shared';
import type { ContentApi, Repository, TeamApi } from './api';

/** Gives the current login token, or null when nobody is signed in. */
export type TokenGetter = () => Promise<string | null>;

export type MeResult = { status: 'allowed'; email: string | null; role: AdminRole } | { status: 'login-required' } | { status: 'not-allowed' };

/**
 * Asks the API "who am I, and may I use the admin?". With no login set up on a
 * developer's machine the API answers yes with no email, so the admin opens directly.
 */
export async function checkAccess(baseUrl: string, token: string | null): Promise<MeResult> {
  // A sleeping free server needs up to about a minute to wake, so wait longer than that, but not forever.
  const res = await fetch(`${baseUrl}/api/admin/me`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 200) {
    const me = (await res.json()) as { email: string | null; role: AdminRole };
    return { status: 'allowed', email: me.email, role: me.role };
  }
  if (res.status === 403) return { status: 'not-allowed' };
  if (res.status === 401) return { status: 'login-required' };
  throw new Error(res.status === 503 ? 'The admin is locked on this server until login is set up.' : 'The server had a problem. Please try again.');
}

/** Turns a failed reply into a sentence a person can act on. */
async function explain(res: Response): Promise<string> {
  let body: { error?: string; issues?: { path: string; message: string }[] } = {};
  try {
    body = await res.json();
  } catch {
    /* no JSON body */
  }
  if (res.status === 400 && body.issues?.length) {
    return `Not saved: ${body.issues.map((i) => `${i.path || 'item'} ${i.message}`).join('; ')}`;
  }
  switch (body.error) {
    case 'already_owner': return 'That email is already an owner.';
    case 'team_full': return 'The team is full (20 managers). Remove someone first.';
    case 'owners_only': return 'Only an owner can do that.';
    case 'owner_cannot_be_removed': return 'Owners can only be changed in the server settings.';
    case 'duplicate': return 'Another page already uses this address. Choose a different one.';
  }
  if (res.status === 401) return 'Your sign-in has expired. Please sign in again.';
  if (res.status === 403) return 'This Google account is not allowed to do that.';
  if (res.status === 503) return 'The admin is locked on this server until login is set up.';
  if (res.status === 404) return 'That item no longer exists.';
  if (res.status === 400) return 'That does not look right. Please check it and try again.';
  return 'The server had a problem. Please try again.';
}

/** Sends a request with the login token attached, and turns failures into readable errors. */
function createSender(baseUrl: string, getToken: TokenGetter) {
  return async (path: string, init?: RequestInit): Promise<Response> => {
    let res: Response;
    try {
      const token = await getToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set('authorization', `Bearer ${token}`);
      res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new Error(`Cannot reach the API at ${baseUrl}. Is it running?`);
    }
    if (!res.ok) throw new Error(await explain(res));
    return res;
  };
}

type Sender = ReturnType<typeof createSender>;

function createRepository<T extends { id: string }>(send: Sender, collection: ContentCollection): Repository<T> {
  const path = (id?: string) => `/api/admin/${collection}${id ? `/${encodeURIComponent(id)}` : ''}`;
  return {
    async list() {
      return (await (await send(path())).json()) as T[];
    },
    async save(item) {
      const res = await send(path(item.id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item),
      });
      return (await res.json()) as T;
    },
    async remove(id) {
      await send(path(id), { method: 'DELETE' });
    },
  };
}

function createTeam(send: Sender): TeamApi {
  const path = (email: string) => `/api/admin/team/${encodeURIComponent(email.trim().toLowerCase())}`;
  return {
    async list() {
      return (await (await send('/api/admin/team')).json()) as TeamMember[];
    },
    async add(email) {
      await send(path(email), { method: 'PUT' });
    },
    async remove(email) {
      await send(path(email), { method: 'DELETE' });
    },
  };
}

/** Talks to the real backend. */
export function createHttpApi(baseUrl: string, getToken: TokenGetter): ContentApi {
  const send = createSender(baseUrl, getToken);
  return {
    isMock: false,
    banners: createRepository<Banner>(send, 'banners'),
    popups: createRepository<Popup>(send, 'popups'),
    pages: createRepository<Page>(send, 'pages'),
    plans: createRepository<PlanTemplate>(send, 'plans'),
    team: createTeam(send),
  };
}
