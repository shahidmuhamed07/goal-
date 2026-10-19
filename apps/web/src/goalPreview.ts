import type { Goal, TaskItem } from './types';

/** What a goal card shows about today: the tasks (ticked or not), the routines they belong to, and what comes next. */
export interface GoalPreview {
  /** Today's tasks in plan order, not yet done first. */
  tasks: TaskItem[];
  total: number;
  done: number;
  /** The routines planned for today ("Push day"), in order, without repeats. */
  routines: string[];
  /** The next day with something planned, when today has nothing. */
  next?: { date: string; routine: string };
  /** True when the goal has no routines or tasks at all yet. */
  empty: boolean;
}

/**
 * A short look at a goal's day for its card, so the card says what the work is and not only that
 * there is some. Pure: the caller passes today's date.
 */
export const previewGoal = (goal: Goal, today: string): GoalPreview => {
  const subs = goal.subcategories || [];
  const allTasks = goal.tasks || [];
  const tasks = allTasks.filter((t) => t.date === today);
  const ordered = [...tasks.filter((t) => !t.completed), ...tasks.filter((t) => t.completed)];

  const routines: string[] = [];
  const todaySubs = subs.filter((s) => s.date === today);
  const addName = (name?: string) => {
    if (name && !routines.includes(name)) routines.push(name);
  };
  todaySubs.forEach((s) => addName(s.name));
  // A task can sit in a routine whose own date differs (older goals): name it too.
  tasks.forEach((t) => addName(subs.find((s) => s.id === t.subcategoryId)?.name));

  const upcoming = subs
    .filter((s) => s.date && s.date > today)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : (a.order ?? 0) - (b.order ?? 0)))[0];

  return {
    tasks: ordered,
    total: tasks.length,
    done: tasks.filter((t) => t.completed).length,
    routines,
    next: tasks.length === 0 && upcoming ? { date: upcoming.date as string, routine: upcoming.name } : undefined,
    empty: subs.length === 0 && allTasks.length === 0,
  };
};
