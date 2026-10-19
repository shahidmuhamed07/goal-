import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Goal, Subcategory, TaskItem } from './types';
import { previewGoal } from './goalPreview';

const TODAY = '2026-10-19';
const goal = (subcategories: Subcategory[] = [], tasks: TaskItem[] = []): Goal => ({
  id: 'g', userId: 'u', title: 'Get stronger', category: 'Fitness', createdAt: '2026-10-01', targetDate: '2027-01',
  milestones: [], subcategories, tasks,
});
const sub = (id: string, name: string, date: string, order = 0): Subcategory => ({ id, name, order, date });
const task = (id: string, date: string, over: Partial<TaskItem> = {}): TaskItem => ({ id, text: `Task ${id}`, priority: 'medium', completed: false, date, ...over });

describe('previewGoal', () => {
  it('lists today’s tasks with the routine they belong to, not yet done first', () => {
    const p = previewGoal(goal([sub('s1', 'Push day', TODAY)], [
      task('a', TODAY, { subcategoryId: 's1', completed: true }),
      task('b', TODAY, { subcategoryId: 's1' }),
      task('c', '2026-10-20', { subcategoryId: 's1' }),
    ]), TODAY);
    assert.deepEqual(p.tasks.map((t) => t.id), ['b', 'a']);
    assert.equal(p.total, 2);
    assert.equal(p.done, 1);
    assert.deepEqual(p.routines, ['Push day']);
    assert.equal(p.next, undefined);
    assert.equal(p.empty, false);
  });

  it('names each routine once, even with several days of it', () => {
    const p = previewGoal(goal([sub('s1', 'Push day', TODAY), sub('s2', 'Pull day', TODAY, 1), sub('s3', 'Push day', TODAY, 2)], []), TODAY);
    assert.deepEqual(p.routines, ['Push day', 'Pull day']);
  });

  it('with nothing today, says what comes next', () => {
    const p = previewGoal(goal([sub('s1', 'Pull day', '2026-10-23'), sub('s2', 'Push day', '2026-10-21')], [task('a', '2026-10-21', { subcategoryId: 's2' })]), TODAY);
    assert.equal(p.total, 0);
    assert.deepEqual(p.next, { date: '2026-10-21', routine: 'Push day' });
    assert.equal(p.empty, false);
  });

  it('ignores days that are over when looking for what is next', () => {
    const p = previewGoal(goal([sub('s1', 'Old', '2026-10-01')], []), TODAY);
    assert.equal(p.next, undefined);
    assert.equal(p.empty, false);
  });

  it('a goal with nothing planned at all is empty', () => {
    const p = previewGoal(goal(), TODAY);
    assert.deepEqual([p.empty, p.total, p.done, p.routines.length, p.next], [true, 0, 0, 0, undefined]);
  });

  it('copes with a goal missing its lists', () => {
    const broken = { ...goal(), subcategories: undefined, tasks: undefined } as unknown as Goal;
    assert.equal(previewGoal(broken, TODAY).empty, true);
  });
});
