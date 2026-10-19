import { Subcategory, TaskItem } from './types';
import { createSeries, sortWeekdays } from './recurrence';

/**
 * The plan a guided goal builds, and how it is written onto the calendar.
 *
 * A plan is a goal with weekly routines (and their tasks); `materializePlan`
 * writes them as dated days so a new goal opens on real work. Pure: nothing
 * here touches React or a server.
 */

export type Focus =
  | 'diet'
  | 'fitness'
  | 'health'
  | 'career'
  | 'business'
  | 'money'
  | 'learning'
  | 'creative';

export interface StarterRoutine {
  name: string;
  weekdays: number[];
  tasks: string[];
  /** Weeks between repeats: 1 (or missing) is every week, 2 is every other week. */
  everyWeeks?: number;
}

export interface StarterPlan {
  /** What the plan is about. `custom` is a goal that fits none of the listed niches. */
  focus: Focus | 'custom';
  title: string;
  category: string;
  description: string;
  months: number;
  routines: StarterRoutine[];
}

/** How many tasks each routine gets for the time someone can give. */
export const tasksForMinutes = (minutes: number): number =>
  minutes <= 15 ? 2 : minutes <= 30 ? 3 : minutes <= 45 ? 4 : 5;

/**
 * Spreads routines over the chosen days so every day has something and no
 * routine is left without one: routine i takes days i, i + k, i + 2k …
 */
export const spreadOverDays = (routineCount: number, days: number[]): number[][] => {
  const sorted = sortWeekdays(days);
  if (sorted.length === 0) return Array.from({ length: routineCount }, () => []);
  return Array.from({ length: routineCount }, (_, i) => {
    if (sorted.length < routineCount) return [sorted[i % sorted.length]];
    return sorted.filter((_day, index) => index % routineCount === i);
  });
};

/**
 * Writes a plan's routines onto the calendar: one dated subcategory per matching
 * day from `fromDate` to `endDate`, each carrying the routine's tasks.
 */
export const materializePlan = (
  plan: StarterPlan,
  {
    fromDate,
    endDate,
    seed = Date.now(),
    startToday = false,
  }: {
    fromDate: string;
    endDate: string;
    seed?: number;
    /**
     * Make sure the first day has something to do. When the plan starts on a day that is not one of
     * the chosen weekdays, the first routine is also placed on that day (once, not repeated), so a
     * new plan never opens on an empty Today.
     */
    startToday?: boolean;
  }
): { subcategories: Subcategory[]; tasks: TaskItem[] } => {
  let subcategories: Subcategory[] = [];
  const tasks: TaskItem[] = [];

  plan.routines.forEach((routine, routineIndex) => {
    if (routine.weekdays.length === 0) return;
    const created = createSeries({
      subcategories,
      tasks,
      name: routine.name,
      days: routine.weekdays,
      pattern:
        routine.everyWeeks && routine.everyWeeks > 1
          ? { kind: 'weekly', days: routine.weekdays, everyWeeks: routine.everyWeeks }
          : undefined,
      fromDate,
      endDate,
      editorRole: null,
      seed: seed + routineIndex,
    });
    if (!created) return;

    created.subcategories.slice(subcategories.length).forEach((sub, subIndex) => {
      routine.tasks.forEach((text, taskIndex) => {
        tasks.push({
          id: `t-${seed + routineIndex}-${subIndex}-${taskIndex}`,
          text,
          priority: taskIndex === 0 ? 'high' : 'medium',
          completed: false,
          date: sub.date as string,
          subcategoryId: sub.id,
        });
      });
    });
    subcategories = created.subcategories;
  });

  if (startToday && fromDate <= endDate && !subcategories.some((s) => s.date === fromDate)) {
    const first = plan.routines.find((r) => r.tasks.length > 0);
    if (first) {
      const id = `sc-${seed}-start`;
      subcategories = [...subcategories, { id, name: first.name, order: subcategories.length, date: fromDate, editorRole: null }];
      first.tasks.forEach((text, taskIndex) => {
        tasks.push({
          id: `t-${seed}-start-${taskIndex}`,
          text,
          priority: taskIndex === 0 ? 'high' : 'medium',
          completed: false,
          date: fromDate,
          subcategoryId: id,
        });
      });
    }
  }

  return { subcategories, tasks };
};
