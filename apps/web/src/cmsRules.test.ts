import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicPopup } from '@goalpath/shared';
import { parseCmsLink } from './cms/links';
import { pickPopup } from './cms/popupRules';

const popup = (id: string, frequency: PublicPopup['frequency']): PublicPopup => ({
  id,
  title: id,
  body: 'Body',
  tone: 'brand',
  frequency,
});

describe('parseCmsLink', () => {
  it('opens an admin page inside the app', () => {
    assert.deepEqual(parseCmsLink('/pages/summer-challenge'), { kind: 'page', slug: 'summer-challenge' });
    assert.deepEqual(parseCmsLink(' /pages/Summer/ '), { kind: 'page', slug: 'summer' });
  });

  it('opens a web address as a link', () => {
    assert.deepEqual(parseCmsLink('https://example.com/offer?a=1'), { kind: 'web', href: 'https://example.com/offer?a=1' });
  });

  it('ignores anything else', () => {
    for (const bad of [undefined, '', '   ', 'javascript:alert(1)', '/pages/', '/pages/a/b', 'mailto:a@b.c', '/other']) {
      assert.equal(parseCmsLink(bad), null, String(bad));
    }
  });
});

describe('pickPopup', () => {
  const today = '2026-10-18';

  it('shows a popup that was never closed, newest first', () => {
    assert.equal(pickPopup([popup('a', 'once'), popup('b', 'once')], {}, today, [])?.id, 'a');
  });

  it('never shows a "once" popup again after it was closed', () => {
    assert.equal(pickPopup([popup('a', 'once')], { a: '2026-09-01' }, today, []), null);
  });

  it('brings a "daily" popup back the next day but not the same day', () => {
    assert.equal(pickPopup([popup('a', 'daily')], { a: today }, today, []), null);
    assert.equal(pickPopup([popup('a', 'daily')], { a: '2026-10-17' }, today, [])?.id, 'a');
  });

  it('shows an "every visit" popup once per visit', () => {
    assert.equal(pickPopup([popup('a', 'every-visit')], { a: today }, today, [])?.id, 'a');
    assert.equal(pickPopup([popup('a', 'every-visit')], { a: today }, today, ['a']), null);
  });

  it('moves on to the next popup once the first is closed', () => {
    assert.equal(pickPopup([popup('a', 'every-visit'), popup('b', 'once')], {}, today, ['a'])?.id, 'b');
  });
});
