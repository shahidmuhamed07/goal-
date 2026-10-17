import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOME_TAB, backTarget, tabOrder } from './navigation';

test('Today is the first screen and the first tab', () => {
  assert.equal(HOME_TAB, 'today');
  assert.equal(tabOrder(false)[0], 'today');
  assert.equal(tabOrder(true)[0], 'today');
});

test('the tab order is Today, Goals, Connect, then Profile for owners only', () => {
  assert.deepEqual(tabOrder(false), ['today', 'dashboard', 'connect']);
  assert.deepEqual(tabOrder(true), ['today', 'dashboard', 'connect', 'professional']);
});

test('back from a goal page goes to the Goals list', () => {
  assert.equal(backTarget('detail', true), 'dashboard');
  assert.equal(backTarget('today', true), 'dashboard');
});

test('back from Goals, Connect or Profile goes to Today', () => {
  assert.equal(backTarget('dashboard', false), 'today');
  assert.equal(backTarget('connect', false), 'today');
  assert.equal(backTarget('professional', false), 'today');
});

test('back from Today means already home', () => {
  assert.equal(backTarget('today', false), null);
});
