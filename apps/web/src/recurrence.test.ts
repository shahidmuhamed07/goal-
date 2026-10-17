import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Subcategory, TaskItem } from './types';
import {
  applySeriesDays,
  createSeries,
  datesOnWeekdays,
  describePattern,
  describeRepeat,
  weeksBetween,
} from './recurrence';

// 2026-10-12 is a Monday.
const MON = '2026-10-12';
const END = '2026-11-30';

const series = (over: Partial<Parameters<typeof createSeries>[0]> & { fromDate?: string } = {}) =>
  createSeries({ subcategories: [], tasks: [], name: 'Chest day', fromDate: MON, endDate: END, seed: 1, ...over })!;

describe('weeks', () => {
  it('counts whole Monday-first weeks', () => {
    assert.equal(weeksBetween('2026-10-12', '2026-10-18'), 0); // Mon..Sun, same week
    assert.equal(weeksBetween('2026-10-12', '2026-10-19'), 1);
    assert.equal(weeksBetween('2026-10-18', '2026-10-19'), 1); // Sunday to next Monday
    assert.equal(weeksBetween('2026-10-19', '2026-10-12'), -1);
  });
});

describe('every week (unchanged behaviour)', () => {
  it('writes one subcategory per matching day with repeatDays and no extra fields', () => {
    const r = series({ days: [1, 4] }); // Mon, Thu
    assert.deepEqual(r.subcategories.slice(0, 3).map((s) => s.date), ['2026-10-12', '2026-10-15', '2026-10-19']);
    assert.deepEqual(r.subcategories[0].repeatDays, [1, 4]);
    assert.equal('repeatEvery' in r.subcategories[0], false);
    assert.equal('repeatDates' in r.subcategories[0], false);
  });
});

describe('every other week', () => {
  it('keeps the first week, skips the next, keeps the one after', () => {
    const dates = datesOnWeekdays(MON, END, [1, 4], 2);
    assert.deepEqual(dates.slice(0, 5), ['2026-10-12', '2026-10-15', '2026-10-26', '2026-10-29', '2026-11-09']);
  });

  it('counts weeks from the week of the first day, not from the first matching weekday', () => {
    // Starting on a Thursday with Mon+Thu: this week's Monday is before the start, so only Thu counts.
    const dates = datesOnWeekdays('2026-10-15', END, [1, 4], 2);
    assert.deepEqual(dates.slice(0, 3), ['2026-10-15', '2026-10-26', '2026-10-29']);
  });

  it('stores repeatEvery on every day of the routine', () => {
    const r = series({ pattern: { kind: 'weekly', days: [2], everyWeeks: 2 } });
    assert.ok(r.subcategories.every((s) => s.repeatEvery === 2));
    assert.equal(r.subcategories[1].date, '2026-10-27'); // Tue of week 3, not week 2
  });

  it('every day of the week means 7 days a week', () => {
    const r = series({ pattern: { kind: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 }, endDate: '2026-10-18' });
    assert.equal(r.count, 7);
  });
});

describe('picked dates', () => {
  const pick = ['2026-11-03', '2026-10-14', '2026-10-14', '2026-10-30'];

  it('creates exactly those days, once each, in order, marked as picked', () => {
    const r = series({ pattern: { kind: 'dates', dates: pick } });
    assert.deepEqual(r.subcategories.map((s) => s.date), ['2026-10-14', '2026-10-30', '2026-11-03']);
    assert.ok(r.subcategories.every((s) => s.repeatDates === true && !('repeatDays' in s)));
    assert.equal(new Set(r.subcategories.map((s) => s.repeatId)).size, 1);
  });

  it('ignores badly formed dates and days after the end of the goal', () => {
    const r = series({ pattern: { kind: 'dates', dates: ['not-a-date', '2027-01-01', '2026-10-20'] } });
    assert.deepEqual(r.subcategories.map((s) => s.date), ['2026-10-20']);
  });

  it('returns null when nothing valid is picked', () => {
    assert.equal(createSeries({ subcategories: [], tasks: [], name: 'x', fromDate: MON, endDate: END, pattern: { kind: 'dates', dates: [] } }), null);
  });

  it('cannot be given weekdays afterwards, but can be stopped', () => {
    const r = series({ pattern: { kind: 'dates', dates: ['2026-10-14', '2026-10-20', '2026-10-27'] } });
    const anchor = r.subcategories[0];
    const same = applySeriesDays({ ...r, anchor, days: [1], endDate: END });
    assert.equal(same.added + same.removed, 0);
    const stopped = applySeriesDays({ ...r, anchor, days: [], endDate: END });
    assert.equal(stopped.removed, 2);
    const left = stopped.subcategories.find((s) => s.id === anchor.id)!;
    assert.equal('repeatId' in left || 'repeatDates' in left, false);
  });
});

describe('editing an alternate-week routine', () => {
  const base = () => series({ pattern: { kind: 'weekly', days: [1], everyWeeks: 2 } }); // Mondays: 10/12, 10/26, 11/09 ...

  it('keeps the interval when the weekdays change', () => {
    const r = base();
    const next = applySeriesDays({ ...r, anchor: r.subcategories[0], days: [1, 3], endDate: END });
    const dates = next.subcategories.map((s) => s.date).sort();
    assert.ok(dates.includes('2026-10-14')); // Wed of the first week was added
    assert.ok(!dates.includes('2026-10-21')); // Wed of the off week was not
    assert.ok(next.subcategories.every((s) => s.repeatEvery === 2));
  });

  it('switching to every week fills in the off weeks', () => {
    const r = base();
    const next = applySeriesDays({ ...r, anchor: r.subcategories[0], days: [1], everyWeeks: 1, endDate: END });
    assert.ok(next.added > 0);
    assert.ok(next.subcategories.some((s) => s.date === '2026-10-19'));
    assert.ok(next.subcategories.every((s) => !('repeatEvery' in s)));
  });

  it('switching every week to every other week removes the off weeks and their tasks', () => {
    const r = series({ days: [1] });
    const tasks: TaskItem[] = r.subcategories.map((s, i) => ({ id: `t${i}`, text: 'Bench', priority: 'medium', completed: false, date: s.date!, subcategoryId: s.id }));
    const next = applySeriesDays({ subcategories: r.subcategories, tasks, anchor: r.subcategories[0], days: [1], everyWeeks: 2, endDate: END });
    assert.ok(next.removed > 0);
    assert.equal(next.removedTasks, next.removed);
    assert.ok(!next.subcategories.some((s) => s.date === '2026-10-19'));
    assert.ok(next.subcategories.some((s) => s.date === '2026-10-26'));
  });

  it('never leaves undefined fields behind (Firestore rejects them)', () => {
    const r = base();
    const next = applySeriesDays({ ...r, anchor: r.subcategories[0], days: [1], everyWeeks: 1, endDate: END });
    assert.equal(JSON.stringify(next.subcategories).includes('undefined'), false);
    assert.ok(next.subcategories.every((s: Subcategory) => Object.values(s).every((v) => v !== undefined)));
  });
});

describe('labels', () => {
  it('describes each pattern in plain words', () => {
    assert.equal(describePattern({ kind: 'weekly', days: [2, 4], everyWeeks: 1 }), 'Every Tue · Thu');
    assert.equal(describePattern({ kind: 'weekly', days: [1, 5], everyWeeks: 2 }), 'Every other week: Mon · Fri');
    assert.equal(describePattern({ kind: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 }), 'Every day');
    assert.equal(describePattern({ kind: 'dates', dates: ['2026-10-14'] }), '1 picked day');
    assert.equal(describePattern({ kind: 'dates', dates: ['2026-10-14', '2026-10-15'] }), '2 picked days');
  });

  it('labels a stored routine for its badge', () => {
    assert.equal(describeRepeat({ id: 'a', name: 'x', order: 0, repeatId: 'r', repeatDays: [2, 5] }, 8), 'Tue · Fri');
    assert.equal(describeRepeat({ id: 'a', name: 'x', order: 0, repeatId: 'r', repeatDays: [2, 5], repeatEvery: 2 }, 8), 'Every other week: Tue · Fri');
    assert.equal(describeRepeat({ id: 'a', name: 'x', order: 0, repeatId: 'r', repeatDates: true }, 3), '3 picked days');
  });
});
