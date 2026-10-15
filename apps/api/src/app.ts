import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  CONTENT_COLLECTIONS,
  isLive,
  matchesAudience,
  type Banner,
  type ContentCollection,
  type LiveContent,
  type PublicBanner,
} from '@goalpath/shared';
import { SCHEMAS } from './schemas';
import { DuplicateError, type ContentStore, type Doc } from './store';

export interface AppOptions {
  corsOrigins: string[];
  isProduction: boolean;
  /** Lets tests control "now". */
  now?: () => Date;
}

const isCollection = (v: string): v is ContentCollection => (CONTENT_COLLECTIONS as readonly string[]).includes(v);

/** Only what the app needs to draw a banner. Internal fields never leave the server. */
function toPublic(b: Banner): PublicBanner {
  const { id, placement, title, body, imageUrl, ctaLabel, ctaUrl, tone, priority } = b;
  return { id, placement, title, body, imageUrl, ctaLabel, ctaUrl, tone, priority };
}

export function createApp(store: ContentStore, options: AppOptions) {
  const now = options.now ?? (() => new Date());
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(cors({ origin: options.corsOrigins, methods: ['GET', 'PUT', 'DELETE'] }));

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
      const body: LiveContent = { serverTime: at.toISOString(), banners };
      res.set('Cache-Control', 'public, max-age=30');
      res.json(body);
    } catch (e) {
      next(e);
    }
  });

  /**
   * ADMIN. Anyone who can reach these routes can change content, so for now they
   * only run outside production. Real protection (a Firebase login check, plus
   * Cloudflare Access in front) comes next; until then they refuse to run live.
   */
  const requireAdmin: RequestHandler = (_req, res, next) => {
    if (options.isProduction) {
      res.status(503).json({ error: 'admin_auth_not_configured' });
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
