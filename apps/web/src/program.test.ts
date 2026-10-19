import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Goal, GoalProgram } from './types';
import { COOL_DOWN, WARM_UP } from './exerciseMenu';
import { dayNames, decorateFitness, materializeWeek, nextWeekDue, nextWeekNumber, nextWeekStart, weekDates, weekResults, type SessionDraft } from './program';

// 2026-10-19 is a Monday.
const START = '2026-10-19';

const SESSIONS: SessionDraft[] = [
  { day: 'Mon', name: 'Upper body', tasks: [{ text: 'Bench press: 3 sets of 8', exercise: 'Bench press' }, { text: 'Seated row: 3 sets of 8', exercise: 'Seated row' }] },
  { day: 'Wed', name: 'Lower body', tasks: [{ text: 'Leg press: 3 sets of 10', exercise: 'Leg press' }, { text: 'Plank: 3 holds', exercise: 'Plank' }] },
];

const program = (over: Partial<GoalProgram> = {}): GoalProgram => ({
  startDate: START,
  totalWeeks: 4,
  plannedWeeks: 1,
  outline: [],
  brief: { niche: 'Fitness', answers: [], days: ['Mon', 'Wed'], minutes: null, months: 1 },
  ...over,
});

describe('weeks of a program', () => {
  it('week n is the 7 days from the start, 7 days apart', () => {
    assert.deepEqual(weekDates(START, 1), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    assert.equal(weekDates(START, 3)[0], '2026-11-02');
  });

  it('names the chosen days Monday first', () => {
    assert.deepEqual(dayNames([0, 5, 1]), ['Mon', 'Fri', 'Sun']);
  });

  it('writes each session on its own date, with tasks, steps and unique ids', () => {
    const decorated = decorateFitness(SESSIONS);
    const { subcategories, tasks } = materializeWeek({ sessions: decorated, startDate: START, weekNumber: 1, seed: 1 });
    assert.deepEqual(subcategories.map((s) => [s.date, s.name]), [['2026-10-19', 'Upper body'], ['2026-10-21', 'Lower body']]);
    assert.equal(tasks.filter((t) => t.date === '2026-10-19').length, 4, 'warm up, two exercises, cool down');
    assert.equal(tasks[0].text, WARM_UP.text);
    assert.equal(tasks[3].text, COOL_DOWN.text);
    assert.ok(tasks[1].steps && tasks[1].steps.length >= 2, 'the exercise has its own written steps');
    assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
    assert.equal(new Set(subcategories.map((s) => s.id)).size, subcategories.length);
    assert.ok(tasks.every((t) => subcategories.some((s) => s.id === t.subcategoryId)));
  });

  it('never repeats: week 2 lands on different dates and different ids', () => {
    const one = materializeWeek({ sessions: SESSIONS, startDate: START, weekNumber: 1, seed: 5 });
    const two = materializeWeek({ sessions: SESSIONS, startDate: START, weekNumber: 2, seed: 5, firstOrder: one.subcategories.length });
    assert.deepEqual(two.subcategories.map((s) => s.date), ['2026-10-26', '2026-10-28']);
    assert.equal(two.subcategories[0].order, 2);
    const ids = new Set([...one.tasks, ...two.tasks].map((t) => t.id));
    assert.equal(ids.size, one.tasks.length + two.tasks.length);
  });

  it('leaves out an empty steps list and caps long ones', () => {
    const { tasks } = materializeWeek({
      sessions: [{ day: 'Mon', name: 'Day', tasks: [{ text: 'a', steps: [] }, { text: 'b', steps: ['1', '2', '3', '4', '5', '6'] }] }],
      startDate: START,
      weekNumber: 1,
      seed: 2,
    });
    assert.equal('steps' in tasks[0], false);
    assert.equal(tasks[1].steps!.length, 4);
  });

  it('reports what was finished and what was not, for the AI to adapt the next week', () => {
    const { tasks } = materializeWeek({ sessions: SESSIONS, startDate: START, weekNumber: 1, seed: 3 });
    tasks[0].completed = true;
    const results = weekResults({ tasks }, START, 1);
    assert.deepEqual(results.done, ['Bench press: 3 sets of 8']);
    assert.equal(results.skipped.length, 3);
    assert.deepEqual(weekResults({ tasks }, START, 2), { done: [], skipped: [] });
  });

  it('offers the next week two days before it starts, and never past the last week', () => {
    const goal = (p: GoalProgram) => ({ program: p });
    assert.equal(nextWeekStart(program()), '2026-10-26');
    assert.equal(nextWeekDue(goal(program()), '2026-10-23'), false);
    assert.equal(nextWeekDue(goal(program()), '2026-10-24'), true);
    assert.equal(nextWeekDue(goal(program()), '2026-11-10'), true, 'still offered when the person was away');
    assert.equal(nextWeekDue(goal(program({ plannedWeeks: 4 })), '2026-12-01'), false);
    assert.equal(nextWeekDue({} as Pick<Goal, 'program'>, '2026-12-01'), false);
    assert.equal(nextWeekNumber(program({ plannedWeeks: 2 })), 3);
    assert.equal(nextWeekNumber(program({ plannedWeeks: 4 })), undefined);
  });
});
