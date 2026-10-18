import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Goal, Subcategory, TaskItem } from './types';
import { findMissedTasks, moveTasksToDay, skipTasks } from './missed';

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
