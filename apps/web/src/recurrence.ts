import { Goal, Subcategory, TaskItem } from './types';
import { shiftDateString } from './utils';

/**
 * Weekly routines: "Chest day every Tuesday and Thursday".
 *
 * A routine is not a separate record. Planning is date-based (a subcategory and
 * its tasks belong to one `YYYY-MM-DD` day), so a routine is simply the same
 * subcategory written onto every matching day up to the end of the goal, with a
 * shared `repeatId` linking them. That keeps today's view, the streak, progress
 * counts and the Firestore rules working without knowing routines exist.
 *
 * Everything here is pure: arrays in, arrays out. Dates are handled as plain
 * calendar strings in UTC so a weekday never shifts with the user's timezone.
 */

/** 0 = Sunday … 6 = Saturday, the numbering `Date#getUTCDay` uses. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Monday-first, the order every weekday picker shows. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A goal document may not grow past Firestore's 1 MiB limit. A routine repeated
 * across a long goal multiplies tasks quickly, so writes stay under this budget.
 */
export const MAX_GOAL_CONTENT_BYTES = 900_000;

export const estimateBytes = (value: unknown): number => JSON.stringify(value).length;

export const weekdayOf = (dateStr: string): Weekday => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
};

/** The days of a routine in Monday-first order, without duplicates. */
export const sortWeekdays = (days: number[]): Weekday[] =>
  WEEK_ORDER.filter((day) => days.includes(day));

/** The Monday of the week that contains `dateStr`. */
export const startOfWeek = (dateStr: string): string =>
  shiftDateString(dateStr, -((weekdayOf(dateStr) + 6) % 7));

/** The seven dates, Monday to Sunday, of the week that contains `dateStr`. */
export const getWeekDates = (dateStr: string): string[] => {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => shiftDateString(start, i));
};

export const firstDayOfMonthKey = (monthKey: string): string => `${monthKey}-01`;

export const lastDayOfMonthKey = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, '0')}`;
};

const horizonKeys = (goal: Pick<Goal, 'targetDate' | 'milestones'>): string[] =>
  [goal.targetDate, ...(goal.milestones || []).map((m) => m.monthKey)]
    .filter(Boolean)
    .sort();

/** The first day a goal can be planned on: the start of its first month. */
export const goalStartDate = (goal: Pick<Goal, 'targetDate' | 'milestones'>): string => {
  const keys = horizonKeys(goal);
  return firstDayOfMonthKey(keys[0] || '1970-01');
};

/** The last day a goal can be planned on: the end of its final month. */
export const goalEndDate = (goal: Pick<Goal, 'targetDate' | 'milestones'>): string => {
  const keys = horizonKeys(goal);
  return lastDayOfMonthKey(keys[keys.length - 1] || '1970-01');
};

/** What a day holds: tasks (and how many are done) and subcategories planned on it. */
export interface DayStats {
  total: number;
  done: number;
  subs: number;
}

/**
 * Per-day counts for a whole goal, keyed by `YYYY-MM-DD`. The week strip on the
 * goal page and the one on each goal card both draw their day marks from this.
 */
export const buildDayStats = (
  goal: Pick<Goal, 'tasks' | 'subcategories'>
): Record<string, DayStats> => {
  const map: Record<string, DayStats> = {};
  const entry = (date: string) => (map[date] ||= { total: 0, done: 0, subs: 0 });
  (goal.tasks || []).forEach((t) => {
    if (!t.date) return;
    const e = entry(t.date);
    e.total += 1;
    if (t.completed) e.done += 1;
  });
  (goal.subcategories || []).forEach((s) => {
    if (s.date) entry(s.date).subs += 1;
  });
  return map;
};

/** Whole weeks from the week of `a` to the week of `b` (Monday-first weeks). Negative when `b` is earlier. */
export const weeksBetween = (a: string, b: string): number => {
  const ms = (d: string) => {
    const [y, m, day] = startOfWeek(d).split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((ms(b) - ms(a)) / (7 * 86_400_000));
};

/**
 * Every date from `from` to `to` (inclusive) that falls on one of `days`.
 * With `everyWeeks` of 2, only every second week counts, starting with the week
 * that contains `weekAnchor` (by default `from`).
 */
export const datesOnWeekdays = (
  from: string,
  to: string,
  days: number[],
  everyWeeks = 1,
  weekAnchor = from
): string[] => {
  const wanted = new Set(days);
  const step = Math.max(1, Math.floor(everyWeeks));
  const dates: string[] = [];
  // The guard keeps a bad range from looping forever; 24 months is ~730 days.
  for (let date = from, i = 0; date <= to && i < 1000; date = shiftDateString(date, 1), i += 1) {
    if (wanted.has(weekdayOf(date)) && weeksBetween(weekAnchor, date) % step === 0) dates.push(date);
  }
  return dates;
};

/** How a new routine repeats: on weekdays (every week, or every other week), or on days picked one by one. */
export type RepeatPattern =
  | { kind: 'weekly'; days: number[]; everyWeeks: number }
  | { kind: 'dates'; dates: string[] };

/** "Every Tue · Thu", "Every other Mon · Fri", "Every day" or "5 picked days". */
export const describePattern = (pattern: RepeatPattern): string => {
  if (pattern.kind === 'dates') {
    const n = new Set(pattern.dates).size;
    return `${n} picked ${n === 1 ? 'day' : 'days'}`;
  }
  const days = describeDays(pattern.days);
  if (pattern.everyWeeks > 1) return `Every other week: ${days}`;
  return days === 'Every day' ? days : `Every ${days}`;
};

/** "Tue · Thu", "Weekdays", "Weekends" or "Every day". */
export const describeDays = (days: number[]): string => {
  const sorted = sortWeekdays(days);
  if (sorted.length === 7) return 'Every day';
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '6,0') return 'Weekends';
  return sorted.map((day) => WEEKDAY_SHORT[day]).join(' · ');
};

/** The label for a routine's badge: "Tue · Fri", "Every other week: Tue · Fri" or "4 picked days". */
export const describeRepeat = (sub: Subcategory, occurrences: number): string => {
  if (sub.repeatDates) return describePattern({ kind: 'dates', dates: Array.from({ length: occurrences }, (_, i) => String(i)) });
  const days = describeDays(sub.repeatDays || []);
  return (sub.repeatEvery ?? 1) > 1 ? `Every other week: ${days}` : days;
};

export const isRepeating = (sub?: Pick<Subcategory, 'repeatId'> | null): boolean =>
  !!sub?.repeatId;

export interface PlanArrays {
  subcategories: Subcategory[];
  tasks: TaskItem[];
}

/** Occurrences of the same routine on or after `anchor`'s date, anchor included. */
export const occurrencesFrom = (
  subcategories: Subcategory[],
  anchor: Subcategory
): Subcategory[] =>
  anchor.repeatId && anchor.date
    ? subcategories.filter(
        (s) => s.repeatId === anchor.repeatId && !!s.date && s.date >= anchor.date!
      )
    : [anchor];

/** How much a change to the days after `anchor` would add or take away. */
export interface SeriesChange extends PlanArrays {
  added: number;
  removed: number;
  removedTasks: number;
}

/**
 * Applies a new weekday set to a routine from `anchor`'s day forward.
 *
 * - Later days on a weekday that is no longer wanted are removed, with their tasks.
 * - Later days that are wanted but missing are added, each starting with a copy of
 *   the anchor day's tasks (not completed).
 * - Days before the anchor are history and are never touched.
 * - An empty `days` stops the routine after the anchor and clears it from the anchor.
 *
 * Calling this with the current days is a no-op, so it also serves as a dry run for
 * showing "adds N days / removes M" before the person confirms.
 */
export const applySeriesDays = ({
  subcategories,
  tasks,
  anchor,
  days,
  endDate,
  everyWeeks,
  seed = Date.now(),
}: PlanArrays & {
  anchor: Subcategory;
  days: number[];
  endDate: string;
  /** Weeks between repeats. Defaults to what the routine already uses (1 when none). */
  everyWeeks?: number;
  seed?: number;
}): SeriesChange => {
  const anchorDate = anchor.date;
  const nothing = { subcategories, tasks, added: 0, removed: 0, removedTasks: 0 };
  if (!anchorDate) return nothing;
  // A routine built from picked dates has no weekdays to edit; it can only be stopped.
  if (anchor.repeatDates && days.length > 0) return nothing;
  const every = Math.max(1, Math.floor(everyWeeks ?? anchor.repeatEvery ?? 1));

  const wanted = sortWeekdays(days);
  const stopping = wanted.length === 0;
  const repeatId = anchor.repeatId || `rp-${seed}`;

  const isLaterOccurrence = (s: Subcategory) =>
    !!anchor.repeatId && s.repeatId === anchor.repeatId && !!s.date && s.date > anchorDate;

  const dropIds = new Set(
    subcategories
      .filter(
        (s) =>
          isLaterOccurrence(s) &&
          (stopping ||
            !wanted.includes(weekdayOf(s.date!)) ||
            weeksBetween(anchorDate, s.date!) % every !== 0)
      )
      .map((s) => s.id)
  );
  const removedTasks = tasks.filter((t) => t.subcategoryId && dropIds.has(t.subcategoryId)).length;

  let nextSubs: Subcategory[] = subcategories
    .filter((s) => !dropIds.has(s.id))
    .map((s) => {
      if (s.id === anchor.id) return stopping ? withoutRepeat(s) : withRepeat(s, repeatId, wanted, every);
      if (isLaterOccurrence(s)) return withRepeat(s, repeatId, wanted, every);
      return s;
    });
  let nextTasks = tasks.filter((t) => !(t.subcategoryId && dropIds.has(t.subcategoryId)));

  let added = 0;
  if (!stopping) {
    const dayAfter = shiftDateString(anchorDate, 1);
    const alreadyThere = new Set(
      nextSubs
        .filter((s) => s.repeatId === repeatId && !!s.date)
        .map((s) => s.date as string)
    );
    // A different subcategory with the same name on a day is the same routine
    // planned by hand, so the day is left alone rather than doubled up.
    const sameNameOn = (date: string) =>
      nextSubs.some(
        (s) => s.date === date && s.name.trim().toLowerCase() === anchor.name.trim().toLowerCase()
      );

    const template = tasks.filter((t) => t.subcategoryId === anchor.id);
    const base = nextSubs.length;
    const newSubs: Subcategory[] = [];
    const newTasks: TaskItem[] = [];

    datesOnWeekdays(dayAfter, endDate, wanted, every, anchorDate).forEach((date) => {
      if (alreadyThere.has(date) || sameNameOn(date)) return;
      const id = `sc-${seed}-${newSubs.length}`;
      newSubs.push({
        id,
        name: anchor.name,
        order: base + newSubs.length,
        date,
        editorRole: anchor.editorRole ?? null,
        repeatId,
        repeatDays: wanted,
        ...(every > 1 ? { repeatEvery: every } : {}),
      });
      template.forEach((t, i) => {
        newTasks.push({
          id: `t-${seed}-${newSubs.length}-${i}`,
          text: t.text,
          priority: t.priority,
          completed: false,
          date,
          subcategoryId: id,
        });
      });
    });

    added = newSubs.length;
    nextSubs = [...nextSubs, ...newSubs];
    nextTasks = [...newTasks, ...nextTasks];
  }

  return { subcategories: nextSubs, tasks: nextTasks, added, removed: dropIds.size, removedTasks };
};

/**
 * Creates a brand-new routine: one subcategory on every matching day from
 * `fromDate` to `endDate`. Give either `days` (every week, the original form) or
 * a `pattern` (every other week, or days picked one by one). Returns null when
 * no day matches.
 */
export const createSeries = ({
  subcategories,
  tasks,
  name,
  days,
  pattern,
  fromDate,
  endDate,
  editorRole,
  seed = Date.now(),
}: PlanArrays & {
  name: string;
  days?: number[];
  pattern?: RepeatPattern;
  fromDate: string;
  endDate: string;
  editorRole?: string | null;
  seed?: number;
}): (PlanArrays & { firstId: string; count: number }) | null => {
  const how: RepeatPattern = pattern ?? { kind: 'weekly', days: days ?? [], everyWeeks: 1 };

  let dates: string[];
  let extra: Pick<Subcategory, 'repeatDays' | 'repeatEvery' | 'repeatDates'>;
  if (how.kind === 'dates') {
    // Only real days inside the goal, each once, in order.
    dates = [...new Set(how.dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= endDate).sort();
    extra = { repeatDates: true };
  } else {
    const wanted = sortWeekdays(how.days);
    const every = Math.max(1, Math.floor(how.everyWeeks));
    dates = datesOnWeekdays(fromDate, endDate, wanted, every, fromDate);
    extra = { repeatDays: wanted, ...(every > 1 ? { repeatEvery: every } : {}) };
  }
  if (dates.length === 0) return null;

  const repeatId = `rp-${seed}`;
  const base = subcategories.length;
  const created: Subcategory[] = dates.map((date, i) => ({
    id: `sc-${seed}-${i}`,
    name,
    order: base + i,
    date,
    editorRole: editorRole ?? null,
    repeatId,
    ...extra,
  }));

  return {
    subcategories: [...subcategories, ...created],
    tasks,
    firstId: created[0].id,
    count: created.length,
  };
};

/**
 * Adds one task to `anchor`'s day and, when the subcategory is part of a routine,
 * to every later day of it too.
 */
export const addTaskForward = ({
  subcategories,
  tasks,
  anchor,
  text,
  priority,
  forward,
  seed = Date.now(),
}: PlanArrays & {
  anchor: Subcategory;
  text: string;
  priority: TaskItem['priority'];
  forward: boolean;
  seed?: number;
}): TaskItem[] => {
  const targets = forward ? occurrencesFrom(subcategories, anchor) : [anchor];
  const added: TaskItem[] = targets.map((s, i) => ({
    id: `t-${seed}-${i}`,
    text,
    priority,
    completed: false,
    date: s.date || anchor.date || '',
    subcategoryId: s.id,
  }));
  return [...added, ...tasks];
};

/** Renames or re-tags `anchor` and every later day of its routine. */
export const updateFrom = (
  subcategories: Subcategory[],
  anchor: Subcategory,
  changes: Partial<Pick<Subcategory, 'name' | 'editorRole'>>
): Subcategory[] => {
  const ids = new Set(occurrencesFrom(subcategories, anchor).map((s) => s.id));
  ids.add(anchor.id);
  return subcategories.map((s) => (ids.has(s.id) ? { ...s, ...changes } : s));
};

/** Removes subcategories (and their tasks) by id. */
export const removeSubcategories = (
  { subcategories, tasks }: PlanArrays,
  ids: Set<string>
): PlanArrays => ({
  subcategories: subcategories.filter((s) => !ids.has(s.id)),
  tasks: tasks.filter((t) => !(t.subcategoryId && ids.has(t.subcategoryId))),
});

/** The later days of `anchor`'s routine, for "this will remove N days". */
export const countLater = (
  { subcategories, tasks }: PlanArrays,
  anchor: Subcategory
): { days: number; tasks: number } => {
  const later = occurrencesFrom(subcategories, anchor).filter((s) => s.id !== anchor.id);
  const ids = new Set(later.map((s) => s.id));
  return {
    days: later.length,
    tasks: tasks.filter((t) => t.subcategoryId && ids.has(t.subcategoryId)).length,
  };
};

// Firestore rejects `undefined`, so repeat fields are added or dropped, never nulled.
const withRepeat = (sub: Subcategory, repeatId: string, days: Weekday[], every = 1): Subcategory => {
  const { repeatEvery: _old, ...rest } = sub;
  return { ...rest, repeatId, repeatDays: days, ...(every > 1 ? { repeatEvery: every } : {}) };
};

const withoutRepeat = (sub: Subcategory): Subcategory => {
  const { repeatId: _repeatId, repeatDays: _repeatDays, repeatEvery: _every, repeatDates: _dates, ...rest } = sub;
  return rest;
};
