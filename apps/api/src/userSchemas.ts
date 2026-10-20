import { z } from 'zod';
import { PROFESSIONAL_ROLES } from '@goalpath/shared';

/**
 * The shapes the app may send for people's own data. Anything not listed is
 * dropped, so a request can never write a field the server does not know about
 * (such as another person's access list).
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);
const id = z.string().min(1).max(120);

const milestone = z.object({
  id,
  monthKey,
  title: z.string().max(300),
  completed: z.boolean(),
});

const subcategory = z.object({
  id,
  name: z.string().min(1).max(160),
  order: z.number().finite(),
  date: day.optional(),
  editorRole: z.string().max(60).nullable().optional(),
  repeatId: z.string().max(120).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  repeatEvery: z.number().int().min(1).max(52).optional(),
  repeatDates: z.boolean().optional(),
});

const task = z.object({
  id,
  text: z.string().max(600),
  priority: z.enum(['high', 'medium', 'low']),
  completed: z.boolean(),
  skipped: z.boolean().optional(),
  date: day,
  subcategoryId: z.string().max(120).optional(),
  steps: z.array(z.string().max(120)).max(6).optional(),
});

const short = (max: number) => z.string().max(max);

/** What the AI needs to write the next week of a goal. Checked like everything else, so it cannot grow without limit. */
const program = z.object({
  startDate: day,
  totalWeeks: z.number().int().min(1).max(60),
  plannedWeeks: z.number().int().min(0).max(60),
  outline: z.array(z.object({ focus: short(100), note: short(160) })).max(14),
  brief: z.object({
    niche: short(40),
    answers: z.array(z.object({ q: short(200), a: short(300) })).max(30),
    days: z.array(short(12)).max(7),
    minutes: z.number().int().min(5).max(240).nullable(),
    months: z.number().int().min(1).max(24),
  }),
  fitness: z.object({ place: short(20), level: short(20), limits: z.array(short(20)).max(6), kit: short(20).optional() }).optional(),
});

/** One goal is one stored document, so its plan has a hard ceiling well under the database's own. */
export const MAX_GOAL_BYTES = 1_000_000;

export const goalContent = {
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  description: z.string().max(2000),
  targetDate: z.string().min(1).max(10),
  milestones: z.array(milestone).max(120),
  subcategories: z.array(subcategory),
  tasks: z.array(task),
  program: program.optional(),
};

export const createGoalBody = z.object({
  ...goalContent,
  description: goalContent.description.default(''),
  createdAt: day,
  subcategories: goalContent.subcategories.default([]),
  tasks: goalContent.tasks.default([]),
  /** Connected professionals who start with edit access to this goal. */
  assignedProfessionalUids: z.array(z.string().max(128)).max(50).optional(),
});

export const patchGoalBody = z.object(goalContent).partial();

export const patchMeBody = z
  .object({
    persona: z.enum(['client', 'professional']),
    personaChosenAt: z.string().max(40),
    onboardedAt: z.string().max(40),
    onboarding: z.record(z.unknown()),
  })
  .partial()
  .strict()
  .refine((v) => JSON.stringify(v).length <= 6000, { message: 'too large' });

const level = z.enum(['view', 'edit']);

export const goalAccessBody = z.object({ goalAccess: z.record(level) });
export const assignmentsBody = z.object({ assignments: z.record(level.nullable()) });

export const requestAccessBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  role: z.enum(PROFESSIONAL_ROLES),
});

/** Empty, or a web address that starts with http or https (never a script). */
const link = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), { message: 'must start with http:// or https://' });

export const publicProfileBody = z.object({
  displayName: z.string().max(120).optional(),
  headline: z.string().max(160).optional(),
  roles: z.array(z.enum(PROFESSIONAL_ROLES)).max(3),
  yearsExperience: z.string().max(40).optional(),
  languages: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
  contactEmail: z.string().max(254).optional(),
  referenceUrl: link.optional(),
  credentials: z
    .array(
      z.object({
        id,
        title: z.string().max(200),
        issuer: z.string().max(200),
        year: z.string().max(10).optional(),
        referenceUrl: link.optional(),
      }),
    )
    .max(40),
  showcase: z
    .array(
      z.object({
        id,
        title: z.string().max(200),
        description: z.string().max(1000).optional(),
        link: link.optional(),
      }),
    )
    .max(40),
  acceptingClients: z.boolean().optional(),
});

export const messageBody = z.object({ text: z.string().trim().min(1).max(4000) });
