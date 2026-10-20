import type { Goal, Subcategory, TaskItem } from './types';
import { datesOnWeekdays, sortWeekdays } from './recurrence';
import { shiftDateString } from './utils';

/** How many days back a task still counts as "missed" and is offered again. */
export const MISSED_LOOKBACK_DAYS = 14;

export interface MissedTask {
  goalId: string;
  goalTitle: string;
  task: TaskItem;
  /** The routine the task belonged to ("Push day"), when it had one. */
  subcategoryName?: string;
}

/**
 * Tasks from earlier days that were never ticked off and not set aside, newest
 * day first. Pure: the caller decides which goals the person may change.
 */
export const findMissedTasks = (goals: Goal[], today: string, lookbackDays = MISSED_LOOKBACK_DAYS): MissedTask[] => {
  const earliest = shiftDateString(today, -lookbackDays);
  const out: MissedTask[] = [];
  for (const goal of goals) {
    const subs = new Map((goal.subcategories || []).map((s) => [s.id, s.name]));
    for (const task of goal.tasks || []) {
      if (task.completed || task.skipped) continue;
      if (!task.date || task.date >= today || task.date < earliest) continue;
      out.push({
        goalId: goal.id,
        goalTitle: goal.title,
        task,
        subcategoryName: task.subcategoryId ? subs.get(task.subcategoryId) : undefined,
      });
    }
  }
  return out.sort((a, b) => (a.task.date < b.task.date ? 1 : a.task.date > b.task.date ? -1 : 0));
};

/** One missed day of one goal ("Mon, Oct 19: Strength: full body"), with all of its unfinished tasks. */
export interface MissedDay {
  key: string;
  goalId: string;
  goalTitle: string;
  date: string;
  /** The routines that were planned that day, without repeats. Empty when the tasks had no routine. */
  names: string[];
  tasks: MissedTask[];
}

/**
 * Groups missed tasks by goal and day, so the person is asked once per day
 * ("can you do this day's plan?") and never once per exercise. Keeps the order
 * of `items` (newest day first).
 */
export const groupMissedByDay = (items: MissedTask[]): MissedDay[] => {
  const days = new Map<string, MissedDay>();
  for (const item of items) {
    const key = `${item.goalId}|${item.task.date}`;
    let day = days.get(key);
    if (!day) {
      day = { key, goalId: item.goalId, goalTitle: item.goalTitle, date: item.task.date, names: [], tasks: [] };
      days.set(key, day);
    }
    day.tasks.push(item);
    if (item.subcategoryName && !day.names.includes(item.subcategoryName)) day.names.push(item.subcategoryName);
  }
  return [...days.values()];
};

/**
 * Moves the given tasks to `day`. A task that sat in a routine ("Push day")
 * lands in a subcategory of the same name on that day, which is created when
 * the day does not have one yet. Nothing is deleted, and no field is left
 * undefined (the database refuses those).
 */
export const moveTasksToDay = ({
  subcategories,
  tasks,
  taskIds,
  day,
  seed = Date.now(),
}: {
  subcategories: Subcategory[];
  tasks: TaskItem[];
  taskIds: string[];
  day: string;
  seed?: number;
}): { subcategories: Subcategory[]; tasks: TaskItem[] } => {
  const ids = new Set(taskIds);
  const nextSubs = [...subcategories];
  let created = 0;

  const nextTasks = tasks.map((task) => {
    if (!ids.has(task.id)) return task;
    const from = task.subcategoryId ? nextSubs.find((s) => s.id === task.subcategoryId) : undefined;
    if (!from) return { ...task, date: day };

    let target = nextSubs.find((s) => s.date === day && s.name === from.name);
    if (!target) {
      created += 1;
      target = {
        id: `sc-${seed}-${created}`,
        name: from.name,
        order: nextSubs.length,
        date: day,
        editorRole: from.editorRole ?? null,
      };
      nextSubs.push(target);
    }
    return { ...task, date: day, subcategoryId: target.id };
  });

  return { subcategories: nextSubs, tasks: nextTasks };
};

/** Sets tasks aside: they stop being offered, but stay in the plan as not done. */
export const skipTasks = (tasks: TaskItem[], taskIds: string[]): TaskItem[] => {
  const ids = new Set(taskIds);
  return tasks.map((task) => (ids.has(task.id) ? { ...task, skipped: true } : task));
};

/* -------------------------------------------------------------------------- */
/* Pushing a routine forward                                                   */
/* -------------------------------------------------------------------------- */

/** A weekly routine with days that were missed, which can be pushed later. */
export interface PushableRoutine {
  goalId: string;
  goalTitle: string;
  repeatId: string;
  name: string;
  /** How many of its days were missed. */
  missedDays: number;
  /** The weekdays it runs on (0 = Sunday). */
  days: number[];
  /** Weeks between repeats: 1 is every week, 2 every other week. */
  everyWeeks: number;
}

/** Whether a day of a routine is "missed": in the past, with something still to do and nothing done. */
const isMissedDay = (sub: Subcategory, tasks: TaskItem[], today: string): boolean => {
  if (!sub.date || sub.date >= today) return false;
  const own = tasks.filter((t) => t.subcategoryId === sub.id);
  return own.some((t) => !t.completed && !t.skipped) && !own.some((t) => t.completed);
};

/**
 * The weekly routines that have missed days, so the person can be offered "push my
 * plan forward". Routines made from days picked on a calendar are left out: they have
 * no weekdays to follow. Pure; the caller says which goals the person may change.
 */
export const findPushableRoutines = (goals: Goal[], today: string, lookbackDays = MISSED_LOOKBACK_DAYS): PushableRoutine[] => {
  const earliest = shiftDateString(today, -lookbackDays);
  const out: PushableRoutine[] = [];
  for (const goal of goals) {
    const subs = goal.subcategories || [];
    const byRoutine = new Map<string, Subcategory[]>();
    for (const sub of subs) {
      if (!sub.repeatId || sub.repeatDates || !sub.repeatDays || sub.repeatDays.length === 0) continue;
      byRoutine.set(sub.repeatId, [...(byRoutine.get(sub.repeatId) || []), sub]);
    }
    for (const [repeatId, days] of byRoutine) {
      const missed = days.filter((s) => s.date && s.date >= earliest && isMissedDay(s, goal.tasks || [], today));
      if (missed.length === 0) continue;
      const latest = days[days.length - 1];
      out.push({
        goalId: goal.id,
        goalTitle: goal.title,
        repeatId,
        name: days[0].name,
        missedDays: missed.length,
        days: [...(latest.repeatDays || [])],
        everyWeeks: latest.repeatEvery ?? 1,
      });
    }
  }
  return out;
};

export interface PushResult {
  subcategories: Subcategory[];
  tasks: TaskItem[];
  /** How many days of the routine were given a new date. */
  moved: number;
  /** Days that no longer fit before the goal ends, and were taken off the plan. */
  dropped: number;
  /** The first and the last of the days it now runs on after the push. */
  firstDay?: string;
  lastDay?: string;
}

/**
 * Pushes a weekly routine forward: its missed days and every later day move, in order,
 * onto the routine's own weekdays starting today, so the whole plan slides later and
 * nothing is lost. Each day keeps its tasks. Days that were already started (something
 * ticked) stay where they are and their dates are not used again. A day that would fall
 * after the goal's last day is taken off the plan.
 *
 * `days` and `everyWeeks` let the person change the weekdays while pushing (an extra
 * day, or one fewer); the routine follows the new days from today on.
 */
export const pushRoutineForward = ({
  subcategories,
  tasks,
  repeatId,
  today,
  endDate,
  days,
  everyWeeks,
}: {
  subcategories: Subcategory[];
  tasks: TaskItem[];
  repeatId: string;
  today: string;
  endDate: string;
  days?: number[];
  everyWeeks?: number;
}): PushResult => {
  const series = subcategories.filter((s) => s.repeatId === repeatId && s.date).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const unchanged: PushResult = { subcategories, tasks, moved: 0, dropped: 0 };
  if (series.length === 0 || series.some((s) => s.repeatDates)) return unchanged;

  const reference = series[series.length - 1];
  const weekdays = sortWeekdays(days && days.length > 0 ? days : reference.repeatDays || []);
  const every = Math.max(1, Math.floor(everyWeeks ?? reference.repeatEvery ?? 1));
  if (weekdays.length === 0) return unchanged;

  const started = (sub: Subcategory) => tasks.some((t) => t.subcategoryId === sub.id && t.completed);
  const missed = series.filter((s) => isMissedDay(s, tasks, today));
  if (missed.length === 0) return unchanged;

  // The days that slide: the missed ones, then everything from today on that has not been started.
  const slides = series.filter((s) => missed.includes(s) || (s.date! >= today && !started(s)));
  const fixed = new Set(series.filter((s) => !slides.includes(s)).map((s) => s.date!));
  const free = datesOnWeekdays(today, endDate, weekdays, every, series[0].date!).filter((d) => !fixed.has(d));

  const newDate = new Map<string, string>();
  const droppedIds = new Set<string>();
  slides.forEach((sub, i) => {
    if (i < free.length) newDate.set(sub.id, free[i]);
    else droppedIds.add(sub.id);
  });

  const nextSubs = subcategories
    .filter((s) => !droppedIds.has(s.id))
    .map((s) => {
      const date = newDate.get(s.id);
      if (!date) return s;
      // Rebuilt without `repeatEvery` first so a routine back to "every week" does not keep an old value.
      const { repeatEvery: _old, ...rest } = s;
      return { ...rest, date, repeatDays: weekdays, ...(every > 1 ? { repeatEvery: every } : {}) };
    });

  const nextTasks = tasks
    .filter((t) => !t.subcategoryId || !droppedIds.has(t.subcategoryId))
    .map((t) => {
      const date = t.subcategoryId ? newDate.get(t.subcategoryId) : undefined;
      return date ? { ...t, date } : t;
    });

  const sorted = [...newDate.values()].sort();
  return { subcategories: nextSubs, tasks: nextTasks, moved: newDate.size, dropped: droppedIds.size, firstDay: sorted[0], lastDay: sorted[sorted.length - 1] };
};
