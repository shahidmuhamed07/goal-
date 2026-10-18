import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Goal, Subcategory, TaskItem } from './types';
import { findMissedTasks, findPushableRoutines, moveTasksToDay, pushRoutineForward, skipTasks } from './missed';

const TODAY = '2026-10-18';

const task = (over: Partial<TaskItem> & { id: string; date: string }): TaskItem => ({
  text: 'A task',
  priority: 'medium',
  completed: false,
  ...over,
});

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  userId: 'u1',
  title: 'Get fitter',
  category: 'Fitness',
  createdAt: '2026-10-01T00:00:00.000Z',
  targetDate: '2027-01',
  milestones: [],
  subcategories: [],
  tasks: [],
  ...over,
});

const push: Subcategory = { id: 'sc-1', name: 'Push day', order: 0, date: '2026-10-16', editorRole: 'Trainer' };

describe('findMissedTasks', () => {
  it('lists unfinished tasks from earlier days, newest day first', () => {
    const g = goal({
      subcategories: [push],
      tasks: [
        task({ id: 'a', date: '2026-10-16', subcategoryId: 'sc-1' }),
        task({ id: 'b', date: '2026-10-17' }),
      ],
    });
    const found = findMissedTasks([g], TODAY);
    assert.deepEqual(found.map((m) => m.task.id), ['b', 'a']);
    assert.equal(found[1].subcategoryName, 'Push day');
    assert.equal(found[0].goalTitle, 'Get fitter');
  });

  it('leaves out done, skipped, today, future and very old tasks', () => {
    const g = goal({
      tasks: [
        task({ id: 'done', date: '2026-10-16', completed: true }),
        task({ id: 'skipped', date: '2026-10-16', skipped: true }),
        task({ id: 'today', date: TODAY }),
        task({ id: 'future', date: '2026-10-20' }),
        task({ id: 'old', date: '2026-09-01' }),
        task({ id: 'edge', date: '2026-10-04' }), // exactly 14 days back: still offered
      ],
    });
    assert.deepEqual(findMissedTasks([g], TODAY).map((m) => m.task.id), ['edge']);
  });
});

describe('moveTasksToDay', () => {
  it('creates the routine on the new day and moves the task into it', () => {
    const tasks = [task({ id: 'a', date: '2026-10-16', subcategoryId: 'sc-1' })];
    const out = moveTasksToDay({ subcategories: [push], tasks, taskIds: ['a'], day: TODAY, seed: 7 });
    assert.equal(out.subcategories.length, 2);
    const made = out.subcategories[1];
    assert.deepEqual(made, { id: 'sc-7-1', name: 'Push day', order: 1, date: TODAY, editorRole: 'Trainer' });
    assert.equal(out.tasks[0].date, TODAY);
    assert.equal(out.tasks[0].subcategoryId, 'sc-7-1');
  });

  it('reuses a routine with the same name that already exists that day', () => {
    const todays: Subcategory = { id: 'sc-2', name: 'Push day', order: 1, date: TODAY, editorRole: null };
    const tasks = [task({ id: 'a', date: '2026-10-16', subcategoryId: 'sc-1' })];
    const out = moveTasksToDay({ subcategories: [push, todays], tasks, taskIds: ['a'], day: TODAY });
    assert.equal(out.subcategories.length, 2);
    assert.equal(out.tasks[0].subcategoryId, 'sc-2');
  });

  it('two tasks from one routine share one new subcategory', () => {
    const tasks = [
      task({ id: 'a', date: '2026-10-16', subcategoryId: 'sc-1' }),
      task({ id: 'b', date: '2026-10-16', subcategoryId: 'sc-1' }),
    ];
    const out = moveTasksToDay({ subcategories: [push], tasks, taskIds: ['a', 'b'], day: TODAY, seed: 1 });
    assert.equal(out.subcategories.length, 2);
    assert.equal(out.tasks[0].subcategoryId, out.tasks[1].subcategoryId);
  });

  it('a task with no routine only changes its date, and other tasks are untouched', () => {
    const tasks = [task({ id: 'a', date: '2026-10-16' }), task({ id: 'b', date: '2026-10-15' })];
    const out = moveTasksToDay({ subcategories: [], tasks, taskIds: ['a'], day: TODAY });
    assert.equal(out.tasks[0].date, TODAY);
    assert.equal(out.tasks[1].date, '2026-10-15');
    assert.equal(out.subcategories.length, 0);
  });

  it('never writes an undefined editorRole', () => {
    const plain: Subcategory = { id: 'sc-9', name: 'Run', order: 0, date: '2026-10-16' };
    const tasks = [task({ id: 'a', date: '2026-10-16', subcategoryId: 'sc-9' })];
    const out = moveTasksToDay({ subcategories: [plain], tasks, taskIds: ['a'], day: TODAY, seed: 3 });
    assert.equal(out.subcategories[1].editorRole, null);
  });
});

describe('skipTasks', () => {
  it('marks only the chosen tasks as set aside', () => {
    const tasks = [task({ id: 'a', date: '2026-10-16' }), task({ id: 'b', date: '2026-10-16' })];
    const out = skipTasks(tasks, ['a']);
    assert.equal(out[0].skipped, true);
    assert.equal(out[1].skipped, undefined);
  });
});

/* ---- pushing a routine forward ------------------------------------------- */

/** "Gym" on Mon, Wed, Fri from 2026-10-12 (a Monday) to the end of the month, each day with two tasks. */
const gymGoal = (over: { done?: string[] } = {}): Goal => {
  const dates = ['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30'];
  const subcategories: Subcategory[] = dates.map((date, i) => ({
    id: `g${i}`,
    name: 'Gym',
    order: i,
    date,
    editorRole: null,
    repeatId: 'rp-1',
    repeatDays: [1, 3, 5],
  }));
  const tasks: TaskItem[] = dates.flatMap((date, i) =>
    ['Warm up', 'Lift'].map((text, k) => task({ id: `t${i}-${k}`, date, text, subcategoryId: `g${i}`, completed: (over.done || []).includes(`t${i}-${k}`) })),
  );
  return goal({ subcategories, tasks, targetDate: '2026-10', milestones: [{ id: 'm', monthKey: '2026-10', title: 'x', completed: false }] });
};

const push2 = (g: Goal, extra: Partial<Parameters<typeof pushRoutineForward>[0]> = {}) =>
  pushRoutineForward({ subcategories: g.subcategories, tasks: g.tasks, repeatId: 'rp-1', today: TODAY, endDate: '2026-10-31', ...extra });

describe('findPushableRoutines', () => {
  it('finds a weekly routine with missed days, with its days and how many were missed', () => {
    // Today is Sunday 18th: Mon 12, Wed 14 and Fri 16 are in the past and nothing was done.
    const found = findPushableRoutines([gymGoal()], TODAY);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, 'Gym');
    assert.equal(found[0].missedDays, 3);
    assert.deepEqual(found[0].days, [1, 3, 5]);
    assert.equal(found[0].everyWeeks, 1);
  });

  it('ignores days that were done, started, or are older than two weeks', () => {
    const allDoneMon = gymGoal({ done: ['t0-0', 't0-1'] });
    assert.equal(findPushableRoutines([allDoneMon], TODAY)[0].missedDays, 2);
    const started = gymGoal({ done: ['t1-0'] });
    assert.equal(findPushableRoutines([started], TODAY)[0].missedDays, 2);
    assert.equal(findPushableRoutines([gymGoal()], '2026-11-30').length, 0);
  });

  it('leaves out routines picked on a calendar and one-off days', () => {
    const g = gymGoal();
    const calendar = { ...g, subcategories: g.subcategories.map((s) => ({ ...s, repeatDates: true })) };
    assert.equal(findPushableRoutines([calendar], TODAY).length, 0);
    const oneOff = goal({ subcategories: [push], tasks: [task({ id: 't', date: '2026-10-16', subcategoryId: 'sc-1' })] });
    assert.equal(findPushableRoutines([oneOff], TODAY).length, 0);
  });
});

describe('pushRoutineForward', () => {
  it('slides the missed days and the rest of the plan onto the routine’s own days from today', () => {
    const g = gymGoal();
    const result = push2(g);
    const dates = result.subcategories.map((s) => s.date);
    // 9 days slide onto Mon/Wed/Fri from Sunday the 18th: 19, 21, 23, 26, 28, 30 fit; 3 do not.
    assert.deepEqual(dates, ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30']);
    assert.equal(result.moved, 6);
    assert.equal(result.dropped, 3);
    assert.equal(result.lastDay, '2026-10-30');
  });

  it('only ever lands on the routine’s weekdays', () => {
    const result = push2(gymGoal());
    for (const sub of result.subcategories) assert.ok([1, 3, 5].includes(new Date(`${sub.date}T12:00:00Z`).getUTCDay()), sub.date);
  });

  it('keeps each day’s tasks with it, on its new date', () => {
    const result = push2(gymGoal());
    for (const sub of result.subcategories) {
      const own = result.tasks.filter((t) => t.subcategoryId === sub.id);
      assert.equal(own.length, 2);
      assert.ok(own.every((t) => t.date === sub.date));
    }
  });

  it('takes the tasks of dropped days off the plan with them', () => {
    const result = push2(gymGoal());
    assert.equal(result.tasks.length, result.subcategories.length * 2);
    assert.ok(result.tasks.every((t) => result.subcategories.some((s) => s.id === t.subcategoryId)));
  });

  it('leaves a day that was done, and a day already started, where it is', () => {
    const g = gymGoal({ done: ['t0-0', 't0-1', 't1-0'] });
    const result = push2(g);
    const byId = new Map(result.subcategories.map((s) => [s.id, s.date]));
    assert.equal(byId.get('g0'), '2026-10-12', 'a finished day is history');
    assert.equal(byId.get('g1'), '2026-10-14', 'a day with something ticked is history too');
    assert.equal(byId.get('g2') && byId.get('g2')! >= TODAY, true, 'the missed Friday moves to the future');
  });

  it('lets the person change the days while pushing: an extra day, or fewer', () => {
    const extra = push2(gymGoal(), { days: [1, 3, 5, 6] });
    assert.ok(extra.subcategories.some((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay() === 6));
    assert.ok(extra.subcategories.every((s) => s.repeatDays!.join() === '1,3,5,6'));
    const fewer = push2(gymGoal(), { days: [2] });
    assert.ok(fewer.subcategories.every((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay() === 2));
  });

  it('follows every other week and keeps that setting', () => {
    const g = gymGoal();
    const biweekly = { ...g, subcategories: g.subcategories.map((s) => ({ ...s, repeatEvery: 2 })) };
    const result = push2(biweekly);
    for (const sub of result.subcategories) assert.equal(sub.repeatEvery, 2);
    // Weeks of 12th, 26th are "on": from the 18th the next on-week days are the 26th, 28th, 30th.
    assert.deepEqual(result.subcategories.map((s) => s.date), ['2026-10-26', '2026-10-28', '2026-10-30']);
  });

  it('never leaves an undefined field behind', () => {
    const g = gymGoal();
    const biweekly = { ...g, subcategories: g.subcategories.map((s) => ({ ...s, repeatEvery: 2 })) };
    const back = push2(biweekly, { everyWeeks: 1 });
    for (const sub of back.subcategories) {
      assert.equal('repeatEvery' in sub, false);
      assert.equal(Object.values(sub).includes(undefined), false);
    }
  });

  it('changes nothing when nothing was missed, or for a routine without weekdays', () => {
    const g = gymGoal();
    assert.equal(pushRoutineForward({ subcategories: g.subcategories, tasks: g.tasks, repeatId: 'rp-1', today: '2026-10-10', endDate: '2026-10-31' }).moved, 0);
    assert.equal(push2(g, { repeatId: 'rp-none' }).moved, 0);
  });

  it('does not touch another routine', () => {
    const g = gymGoal();
    const other: Subcategory = { id: 'x', name: 'Reading', order: 99, date: '2026-10-20', editorRole: null, repeatId: 'rp-2', repeatDays: [2] };
    const result = pushRoutineForward({ subcategories: [...g.subcategories, other], tasks: g.tasks, repeatId: 'rp-1', today: TODAY, endDate: '2026-10-31' });
    assert.equal(result.subcategories.find((s) => s.id === 'x')!.date, '2026-10-20');
  });
});
