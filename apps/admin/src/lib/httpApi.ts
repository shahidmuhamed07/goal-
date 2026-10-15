import type { Banner, ContentCollection, Page, PlanTemplate, Popup } from '@goalpath/shared';
import type { ContentApi, Repository } from './api';

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
  if (res.status === 503) return 'The admin is locked on this server until login is set up.';
  if (res.status === 404) return 'That item no longer exists.';
  return 'The server had a problem. Please try again.';
}

function createRepository<T extends { id: string }>(baseUrl: string, collection: ContentCollection): Repository<T> {
  const url = (id?: string) => `${baseUrl}/api/admin/${collection}${id ? `/${encodeURIComponent(id)}` : ''}`;

  const send = async (input: string, init?: RequestInit): Promise<Response> => {
    let res: Response;
    try {
      res = await fetch(input, init);
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
export function createHttpApi(baseUrl: string): ContentApi {
  return {
    isMock: false,
    banners: createRepository<Banner>(baseUrl, 'banners'),
    popups: createRepository<Popup>(baseUrl, 'popups'),
    pages: createRepository<Page>(baseUrl, 'pages'),
    plans: createRepository<PlanTemplate>(baseUrl, 'plans'),
  };
}
