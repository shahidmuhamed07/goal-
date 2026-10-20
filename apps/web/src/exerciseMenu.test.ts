import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_EXERCISES, COOL_DOWN, WARM_UP, menuFor, stepsFor } from './exerciseMenu';
import type { Level, Limit, Place } from './fitnessPlan';

const PLACES: Place[] = ['gym', 'home', 'homegear', 'outdoors'];
const LEVELS: Level[] = ['beginner', 'returning', 'some', 'experienced'];
const LIMITS: Limit[] = ['knees', 'back', 'shoulders', 'breath'];

describe('the exercise menu', () => {
  it('gives every exercise a name the AI can be held to, and 2 to 4 short "how" lines', () => {
    assert.equal(new Set(ALL_EXERCISES.map((n) => n.toLowerCase())).size, ALL_EXERCISES.length, 'no duplicate names');
    for (const name of ALL_EXERCISES) {
      assert.ok(name.length <= 60, name);
      const steps = stepsFor(name)!;
      assert.ok(steps.length >= 3 && steps.length <= 5, `${name} has ${steps.length} lines`);
      assert.match(steps[0], /^Works: .{3,40}$/, `${name} needs a short "works" line`);
      assert.ok(steps.every((s) => s.length <= 80), `${name} has a line over 80 letters`);
      assert.ok(!/heavy as you can|maximum|max weight|to failure/i.test(steps.join(' ')), `${name} must not push for heavy weight`);
    }
    for (const part of [WARM_UP, COOL_DOWN]) assert.ok(part.steps.length >= 3 && part.steps.every((s) => s.length <= 80));
  });

  it('offers enough exercises for a varied month in every place, level and limit', () => {
    for (const place of PLACES) assert.ok(menuFor(place, 'some', []).length >= 20, `${place} has a wide menu`);
    for (const place of PLACES) {
      for (const level of LEVELS) {
        assert.ok(menuFor(place, level, []).length >= 10, `${place} ${level}`);
        for (const limit of LIMITS) assert.ok(menuFor(place, level, [limit]).length >= 8, `${place} ${level} ${limit}`);
        assert.ok(menuFor(place, level, LIMITS).length >= 5, `${place} ${level} with every limit`);
      }
    }
  });

  it('keeps heavy barbell lifts away from beginners, and exercises that hurt a named limit away from that person', () => {
    assert.ok(!menuFor('gym', 'beginner', []).includes('Deadlift'));
    assert.ok(menuFor('gym', 'experienced', []).includes('Deadlift'));
    assert.ok(!menuFor('gym', 'experienced', ['back']).includes('Deadlift'));
    assert.ok(!menuFor('gym', 'some', ['knees']).includes('Walking lunges'));
    assert.ok(!menuFor('home', 'some', ['shoulders']).includes('Push-ups'));
    assert.ok(!menuFor('outdoors', 'experienced', ['breath']).includes('Hill or stair sprints'));
  });

  it('only lists exercises that suit the place', () => {
    assert.ok(!menuFor('home', 'some', []).includes('Bench press'));
    assert.ok(menuFor('gym', 'some', []).includes('Bench press'));
    assert.ok(menuFor('homegear', 'some', []).includes('Dumbbell floor press'));
  });

  it('lets a gym person choose machines, free weights or both, always keeping body-weight moves', () => {
    const machines = menuFor('gym', 'some', [], 'machines');
    const free = menuFor('gym', 'some', [], 'free');
    const both = menuFor('gym', 'some', [], 'both');
    assert.ok(machines.includes('Leg press') && !machines.includes('Goblet squat'));
    assert.ok(free.includes('Goblet squat') && !free.includes('Leg press'));
    assert.ok(machines.includes('Plank') && free.includes('Plank'));
    assert.ok(both.length > machines.length && both.length > free.length);
    assert.deepEqual(menuFor('home', 'some', [], 'machines'), menuFor('home', 'some', []), 'equipment only matters in a gym');
  });

  it('finds steps whatever the capitals', () => {
    assert.deepEqual(stepsFor('bench PRESS'), stepsFor('Bench press'));
    assert.ok(stepsFor('Bench press')![0].startsWith('Works: Chest'));
    assert.equal(stepsFor('Invented lift'), undefined);
  });
});
