import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import {
  CONTENT_COLLECTIONS,
  isLive,
  matchesAudience,
  type AdminRole,
  type AdminUser,
  type Banner,
  type ContentCollection,
  type LiveContent,
  type Me,
  type Page,
  type Popup,
  type PublicBanner,
  type PublicPage,
  type PublicPopup,
  type TeamMember,
} from '@goalpath/shared';
import type { AdminAuth, TokenVerifier } from './auth';
import { SCHEMAS } from './schemas';
import { DuplicateError, type ContentStore, type Doc } from './store';
import type { PlanAi } from './planAi';
import { createUserRoutes } from './userRoutes';

export interface AppOptions {
  corsOrigins: string[];
  isProduction: boolean;
  /** How admins prove who they are. Without it the admin is open on a developer's machine and locked in production. */
  adminAuth?: AdminAuth;
  /** How the app's own users prove who they are (their Firebase login token). Without it people's data is unavailable. */
  userAuth?: TokenVerifier;
  /** The AI that helps plan goals. Without it the planning route answers 503 and the app uses its own fixed questions. */
  planAi?: PlanAi;
  /** Lets tests control "now". */
  now?: () => Date;
}

const isCollection = (v: string): v is ContentCollection => (CONTENT_COLLECTIONS as readonly string[]).includes(v);

/** Only what the app needs to draw a banner. Internal fields never leave the server. */
function toPublic(b: Banner): PublicBanner {
  const { id, placement, title, body, imageUrl, ctaLabel, ctaUrl, tone, priority } = b;
  return { id, placement, title, body, imageUrl, ctaLabel, ctaUrl, tone, priority };
}

function toPublicPopup(p: Popup): PublicPopup {
  const { id, title, body, imageUrl, ctaLabel, ctaUrl, tone, frequency } = p;
  return { id, title, body, imageUrl, ctaLabel, ctaUrl, tone, frequency };
}

function toPublicPage(p: Page): PublicPage {
  const { id, slug, title, blocks } = p;
  return { id, slug, title, blocks };
}

export function createApp(store: ContentStore, options: AppOptions) {
  const now = options.now ?? (() => new Date());
  const app = express();
  app.disable('x-powered-by');
  // A goal with a long plan is one large request, so the ceiling is just above one goal's own limit.
  app.use(express.json({ limit: '1100kb' }));
  app.use(cors({ origin: options.corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['content-type', 'authorization'] }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, time: now().toISOString() });
  });

  /**
   * PUBLIC. What the app shows right now. Only published items, inside their
   * dates, meant for this kind of person. Someone not logged in (no `role`) sees
   * only items meant for everyone.
   */
  app.get('/api/content/live', async (req, res, next) => {
    try {
      const role = req.query.role === 'owner' || req.query.role === 'professional' ? req.query.role : undefined;
      const at = now();
      const banners = ((await store.list('banners')) as unknown as Banner[])
        .filter((b) => isLive(b, at))
        .filter((b) => (role ? matchesAudience(b.audience, { role }) : b.audience === 'everyone'))
        .sort((a, b) => b.priority - a.priority)
        .map(toPublic);
      const visibleTo = (audience: Banner['audience']) => (role ? matchesAudience(audience, { role }) : audience === 'everyone');
      const popups = ((await store.list('popups')) as unknown as Popup[])
        .filter((p) => isLive(p, at))
        .filter((p) => visibleTo(p.audience))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toPublicPopup);
      const pages = ((await store.list('pages')) as unknown as Page[])
        .filter((p) => isLive(p, at))
        .filter((p) => visibleTo(p.audience))
        .map(toPublicPage);
      const body: LiveContent = { serverTime: at.toISOString(), banners, popups, pages };
      res.set('Cache-Control', 'public, max-age=30');
      res.json(body);
    } catch (e) {
      next(e);
    }
  });

  /**
   * ADMIN. Needs a valid login token from someone on the team: an owner (set in
   * the private settings) or a manager (added by an owner, kept in the database).
   * The role is looked up on EVERY request, so removing a manager works at once.
   * Without any login set up: refused in production (fail closed), open on a
   * developer's own machine so the project still runs before login is configured.
   */
  const requireAdmin: RequestHandler = async (req, res, next) => {
    const auth = options.adminAuth;
    if (!auth) {
      if (options.isProduction) {
        res.status(503).json({ error: 'admin_auth_not_configured' });
        return;
      }
      res.locals.adminEmail = null;
      res.locals.adminRole = 'owner' satisfies AdminRole;
      next();
      return;
    }

    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'login_required' });
      return;
    }

    let identity;
    try {
      identity = await auth.verify(token);
    } catch {
      res.status(401).json({ error: 'login_required' });
      return;
    }
    if (!identity.emailVerified) {
      res.status(403).json({ error: 'not_allowed' });
      return;
    }

    try {
      let role: AdminRole | null = null;
      if (auth.ownerEmails.includes(identity.email)) role = 'owner';
      else if (await store.get('admins', identity.email)) role = 'manager';
      if (!role) {
        res.status(403).json({ error: 'not_allowed' });
        return;
      }
      res.locals.adminEmail = identity.email;
      res.locals.adminRole = role;
      next();
    } catch (e) {
      next(e);
    }
  };

  /** Only owners may pass. Runs after requireAdmin. */
  const requireOwner: RequestHandler = (_req, res, next) => {
    if (res.locals.adminRole !== 'owner') {
      res.status(403).json({ error: 'owners_only' });
      return;
    }
    next();
  };

  const adminRoutes = express.Router();
  adminRoutes.use(requireAdmin);

  adminRoutes.param('collection', (req, res, next, value: string) => {
    if (!isCollection(value)) {
      res.status(404).json({ error: 'unknown_collection' });
      return;
    }
    res.locals.collection = value;
    next();
  });

  // "Who am I, and what may I do?", asked right after sign-in.
  adminRoutes.get('/me', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const me: Me = { email: res.locals.adminEmail ?? null, role: res.locals.adminRole };
    res.json(me);
  });

  /* ---- team: owners only ------------------------------------------------ */

  const MAX_MANAGERS = 20;
  const emailSchema = z.string().trim().toLowerCase().email().max(254);

  // Team management only makes sense when real login exists, because it needs to know who is asking.
  const requireLoginConfigured: RequestHandler = (_req, res, next) => {
    if (!options.adminAuth) {
      res.status(400).json({ error: 'login_not_configured' });
      return;
    }
    next();
  };

  adminRoutes.get('/team', requireOwner, requireLoginConfigured, async (_req, res, next) => {
    try {
      const owners: TeamMember[] = options.adminAuth!.ownerEmails.map((email) => ({ email, role: 'owner' }));
      const managers = ((await store.list('admins')) as unknown as AdminUser[]).map(
        (m): TeamMember => ({ email: m.email, role: 'manager', addedBy: m.addedBy, addedAt: m.addedAt }),
      );
      res.set('Cache-Control', 'no-store');
      res.json([...owners, ...managers]);
    } catch (e) {
      next(e);
    }
  });

  // Adding the same person twice is harmless: the first record is kept.
  adminRoutes.put('/team/:email', requireOwner, requireLoginConfigured, async (req, res, next) => {
    try {
      const email = emailSchema.parse(req.params.email);
      if (options.adminAuth!.ownerEmails.includes(email)) {
        res.status(409).json({ error: 'already_owner' });
        return;
      }
      const existing = await store.get('admins', email);
      if (existing) {
        res.json(existing);
        return;
      }
      if ((await store.list('admins')).length >= MAX_MANAGERS) {
        res.status(409).json({ error: 'team_full' });
        return;
      }
      const manager: AdminUser = { id: email, email, role: 'manager', addedBy: res.locals.adminEmail, addedAt: now().toISOString() };
      await store.upsert('admins', manager as unknown as Doc);
      res.status(201).json(manager);
    } catch (e) {
      next(e);
    }
  });

  adminRoutes.delete('/team/:email', requireOwner, requireLoginConfigured, async (req, res, next) => {
    try {
      const email = emailSchema.parse(req.params.email);
      if (options.adminAuth!.ownerEmails.includes(email)) {
        res.status(400).json({ error: 'owner_cannot_be_removed' });
        return;
      }
      const removed = await store.remove('admins', email);
      res.status(removed ? 204 : 404).end();
    } catch (e) {
      next(e);
    }
  });

  /* ---- content: owners and managers ------------------------------------- */

  adminRoutes.get('/:collection', async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await store.list(res.locals.collection as ContentCollection));
    } catch (e) {
      next(e);
    }
  });

  adminRoutes.put('/:collection/:id', async (req, res, next) => {
    try {
      const collection = res.locals.collection as ContentCollection;
      const doc = SCHEMAS[collection].parse(req.body);
      if (doc.id !== req.params.id) {
        res.status(400).json({ error: 'id_mismatch' });
        return;
      }
      await store.upsert(collection, doc as Doc);
      res.json(doc);
    } catch (e) {
      next(e);
    }
  });

  adminRoutes.delete('/:collection/:id', async (req, res, next) => {
    try {
      const removed = await store.remove(res.locals.collection as ContentCollection, req.params.id);
      res.status(removed ? 204 : 404).end();
    } catch (e) {
      next(e);
    }
  });

  app.use('/api/admin', adminRoutes);

  /** People's own data: accounts, goals, connections and chat. Every route here needs a login. */
  app.use('/api', createUserRoutes(store, { verify: options.userAuth, now, planAi: options.planAi }));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    if (err instanceof DuplicateError) {
      res.status(409).json({ error: 'duplicate', field: err.field });
      return;
    }
    if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'too_large' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'bad_json' });
      return;
    }
    // Details go to the log, never to the caller.
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'server_error' });
  };
  app.use(onError);

  return app;
}
