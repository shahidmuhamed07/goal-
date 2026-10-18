import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOME_TAB, backTarget, tabOrder } from './navigation';

test('Goals is the first screen and the first tab', () => {
  assert.equal(HOME_TAB, 'dashboard');
  assert.equal(tabOrder(false)[0], 'dashboard');
  assert.equal(tabOrder(true)[0], 'dashboard');
});

test('the tab order is Goals, Today, Connect, then Profile for owners only', () => {
  assert.deepEqual(tabOrder(false), ['dashboard', 'today', 'connect']);
  assert.deepEqual(tabOrder(true), ['dashboard', 'today', 'connect', 'professional']);
});

test('back from a goal page goes to the Goals list', () => {
  assert.equal(backTarget('detail', true), 'dashboard');
  assert.equal(backTarget('today', true), 'dashboard');
});

test('back from Today, Connect or Profile goes to Goals', () => {
  assert.equal(backTarget('today', false), 'dashboard');
  assert.equal(backTarget('connect', false), 'dashboard');
  assert.equal(backTarget('professional', false), 'dashboard');
});

test('back from Goals means already home', () => {
  assert.equal(backTarget('dashboard', false), null);
});
