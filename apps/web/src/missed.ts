import type { Goal, Subcategory, TaskItem } from './types';
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
