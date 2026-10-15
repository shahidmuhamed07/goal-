import { z } from 'zod';
import type { ContentCollection } from '@goalpath/shared';

/**
 * What the API accepts from the admin. Anything else is rejected with a 400.
 * `.strict()` refuses unknown fields, so nobody can smuggle extra data into the database.
 */

const isoDate = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), 'must be a date');
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'letters, numbers, - and _ only');
const text = (max: number) => z.string().max(max);

/** Links may be web addresses or paths inside the app. Never `javascript:` and friends. */
const link = z
  .string()
  .max(2000)
  .refine((u) => /^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')), 'must be an https:// address or a path starting with /');
const imageUrl = z.string().max(2000).refine((u) => /^https:\/\//i.test(u), 'must be an https:// address');

const meta = {
  id,
  status: z.enum(['draft', 'published']),
  createdAt: isoDate,
  updatedAt: isoDate,
};
const schedule = { startsAt: isoDate.optional(), endsAt: isoDate.optional() };
const tone = z.enum(['brand', 'pink', 'neutral']);
const audience = z.enum(['everyone', 'owners', 'professionals']);

const banner = z
  .object({
    ...meta,
    ...schedule,
    name: text(120).min(1),
    placement: z.enum(['announcement-bar', 'goals-banner', 'today-card', 'login-notice']),
    title: text(160).min(1),
    body: text(600).optional(),
    imageUrl: imageUrl.optional(),
    ctaLabel: text(40).optional(),
    ctaUrl: link.optional(),
    tone,
    audience,
    priority: z.number().int().min(-1000).max(1000),
  })
  .strict();

const popup = z
  .object({
    ...meta,
    ...schedule,
    name: text(120).min(1),
    title: text(160).min(1),
    body: text(600).min(1),
    imageUrl: imageUrl.optional(),
    ctaLabel: text(40).optional(),
    ctaUrl: link.optional(),
    tone,
    audience,
    frequency: z.enum(['once', 'daily', 'every-visit']),
  })
  .strict();

const block = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('heading'), text: text(200) }).strict(),
  z.object({ id, type: z.literal('text'), text: text(4000) }).strict(),
  z.object({ id, type: z.literal('image'), url: imageUrl.or(z.literal('')), alt: text(200) }).strict(),
  z.object({ id, type: z.literal('button'), label: text(40), url: link.or(z.literal('')) }).strict(),
  z.object({ id, type: z.literal('divider') }).strict(),
]);

const page = z
  .object({
    ...meta,
    slug: z.string().min(1).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase words joined by -'),
    title: text(160).min(1),
    audience,
    blocks: z.array(block).max(60),
  })
  .strict();

const plan = z
  .object({
    ...meta,
    name: text(120).min(1),
    focus: z.enum(['diet', 'fitness', 'health', 'career', 'business', 'money', 'learning', 'creative']),
    eating: text(40).optional(),
    title: text(160).min(1),
    category: text(60).min(1),
    description: text(600),
    routines: z
      .array(
        z
          .object({
            id,
            name: text(80).min(1),
            weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
            tasks: z.array(text(200).min(1)).min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(14),
  })
  .strict();

export const SCHEMAS: Record<ContentCollection, z.ZodType<{ id: string }>> = { banners: banner, popups: popup, pages: page, plans: plan };
