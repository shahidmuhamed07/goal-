import type { Goal, GoalProgram, Subcategory, TaskItem } from './types';
import { COOL_DOWN, WARM_UP, stepsFor } from './exerciseMenu';
import { WEEKDAY_SHORT, WEEK_ORDER } from './recurrence';
import { shiftDateString } from './utils';

/**
 * Goals the AI writes week by week.
 *
 * A normal plan repeats the same routines every week. A program is different: every
 * week is new work (new sessions, a little more each time), written one week at a
 * time. Week n covers the 7 days starting `startDate + 7 * (n - 1)`. Each session is
 * an ordinary dated subcategory with its own tasks, so everything on the goal page
 * (ticking, editing, moving a day) works unchanged. This file is pure: no screens, no AI calls.
 */

/** One day of a week as the AI wrote it. */
export interface SessionDraft {
  /** "Mon" … "Sun" */
  day: string;
  name: string;
  tasks: { text: string; exercise?: string; steps?: string[] }[];
}

/** How far ahead of a week's first day the person is offered to plan it. */
export const PLAN_AHEAD_DAYS = 2;

const MAX_STEP_LINES = 4;

/** The weekday names the AI is told about, in week order (Mon first). */
export const dayNames = (days: number[]): string[] => WEEK_ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAY_SHORT[d]);

/** The seven dates of week `weekNumber` (1 is the first). */
export const weekDates = (startDate: string, weekNumber: number): string[] =>
  Array.from({ length: 7 }, (_, i) => shiftDateString(startDate, 7 * (weekNumber - 1) + i));

const weekdayName = (date: string): string => WEEKDAY_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];

/**
 * Fitness sessions get a warm up first and a cool down last, written by us, and each exercise
 * from the menu gets its own "how" lines. The AI only chooses the exercises and the doses.
 */
export const decorateFitness = (days: SessionDraft[]): SessionDraft[] =>
  days.map((d) => ({
    ...d,
    tasks: [
      { text: WARM_UP.text, steps: WARM_UP.steps },
      ...d.tasks.map((t) => ({ ...t, steps: t.exercise ? stepsFor(t.exercise) : t.steps })),
      { text: COOL_DOWN.text, steps: COOL_DOWN.steps },
    ],
  }));

/**
 * Writes one week onto the calendar: for each date in the week that matches a session's weekday,
 * a dated subcategory with that session's tasks. `firstOrder` keeps the new days after the old ones.
 */
export const materializeWeek = ({
  sessions,
  startDate,
  weekNumber,
  seed,
  firstOrder = 0,
}: {
  sessions: SessionDraft[];
  startDate: string;
  weekNumber: number;
  seed: number;
  firstOrder?: number;
}): { subcategories: Subcategory[]; tasks: TaskItem[] } => {
  const subcategories: Subcategory[] = [];
  const tasks: TaskItem[] = [];
  weekDates(startDate, weekNumber).forEach((date, dayIndex) => {
    const session = sessions.find((s) => s.day === weekdayName(date));
    if (!session) return;
    const id = `sc-${seed}-w${weekNumber}-${dayIndex}`;
    subcategories.push({ id, name: session.name, order: firstOrder + subcategories.length, date, editorRole: null });
    session.tasks.forEach((t, taskIndex) => {
      const steps = (t.steps ?? []).filter(Boolean).slice(0, MAX_STEP_LINES);
      tasks.push({
        id: `t-${seed}-w${weekNumber}-${dayIndex}-${taskIndex}`,
        text: t.text,
        priority: taskIndex === 0 ? 'high' : 'medium',
        completed: false,
        date,
        subcategoryId: id,
        ...(steps.length > 0 ? { steps } : {}),
      });
    });
  });
  return { subcategories, tasks };
};

/** What the person did in a week: the tasks they finished, and the ones they did not. For the AI to adapt the next week. */
export const weekResults = (goal: Pick<Goal, 'tasks'>, startDate: string, weekNumber: number) => {
  const dates = new Set(weekDates(startDate, weekNumber));
  const inWeek = (goal.tasks || []).filter((t) => dates.has(t.date));
  const names = (list: TaskItem[]) => list.slice(0, 40).map((t) => t.text.slice(0, 160));
  return { done: names(inWeek.filter((t) => t.completed)), skipped: names(inWeek.filter((t) => !t.completed)) };
};

/** The first day of the next unwritten week. */
export const nextWeekStart = (program: GoalProgram): string => shiftDateString(program.startDate, 7 * program.plannedWeeks);

/**
 * Whether the next week should be offered now: there are weeks left, and the written ones are
 * about to run out (it is within `PLAN_AHEAD_DAYS` of the next week's first day, or past it).
 */
export const nextWeekDue = (goal: Pick<Goal, 'program'>, today: string): boolean => {
  const program = goal.program;
  if (!program || program.plannedWeeks >= program.totalWeeks) return false;
  return today >= shiftDateString(nextWeekStart(program), -PLAN_AHEAD_DAYS);
};

/** The number of the next week to write, or undefined when the whole goal is written. */
export const nextWeekNumber = (program: GoalProgram): number | undefined =>
  program.plannedWeeks < program.totalWeeks ? program.plannedWeeks + 1 : undefined;
