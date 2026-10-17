import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The UI standard, enforced. These checks read the source and fail with a message
 * that names the shared part to use instead. The standard itself is written in
 * context/ui-context.md ("The UI standard").
 */

const here = new URL('./', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, here), 'utf8');

/** Every screen and part of the app, with its text. */
const sources: Array<{ file: string; text: string }> = [
  { file: 'App.tsx', text: read('App.tsx') },
  ...readdirSync(new URL('./components/', here))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ file: `components/${f}`, text: read(`components/${f}`) })),
];

/** True for a line that is only a comment, which may talk about the old patterns without using them. */
const isComment = (line: string) => /^\s*(\*|\/\/|\/\*)/.test(line);

/** The lines of every source file where `pattern` matches, as "file:line". Comments are ignored. */
const offenders = (pattern: RegExp, skip: string[] = []): string[] =>
  sources.flatMap(({ file, text }) =>
    skip.includes(file)
      ? []
      : text
          .split('\n')
          .map((line, i) => (!isComment(line) && pattern.test(line) ? `${file}:${i + 1}` : ''))
          .filter(Boolean)
  );

describe('overlays', () => {
  it('are never hand-made: use <Dialog> (or the .scrim / .scrim-dim classes), which dim lightly with no blur', () => {
    const bad = offenders(/fixed inset-0[^"]*(bg-slate-900\/|backdrop-blur)|(bg-slate-900\/|backdrop-blur)[^"]*fixed inset-0/);
    assert.deepEqual(bad, [], `Hand-made overlay found. Use <Dialog> from components/Dialog.tsx.\n${bad.join('\n')}`);
  });

  it('never put a dark tint or blur on an absolutely placed backdrop either', () => {
    const bad = offenders(/absolute inset-0[^"]*(bg-slate-900\/|backdrop-blur)/);
    assert.deepEqual(bad, [], `Use the .scrim-dim class for a backdrop.\n${bad.join('\n')}`);
  });

  it('are dimmed lightly with no blur, in the one shared stylesheet rule', () => {
    const css = read('index.css');
    for (const rule of ['.scrim-dim', '.scrim']) {
      const body = css.slice(css.indexOf(`\n${rule} {`)).split('}')[0];
      assert.ok(body.includes('rgb(26 25 39 / 0.32)'), `${rule} should use the shared dim`);
      assert.equal(/backdrop-filter/.test(body), false, `${rule} must not blur the page behind it`);
    }
  });
});

describe('controls', () => {
  it('use the app’s own dropdown (AppSelect), never the browser’s native <select>', () => {
    const bad = offenders(/<select[\s>]/);
    assert.deepEqual(bad, [], `Use <AppSelect> from components/AppSelect.tsx with the .field-control look.\n${bad.join('\n')}`);
  });

  it('go back with <BackButton>, not a small text chip', () => {
    const bad = offenders(/←\s*Back/);
    assert.deepEqual(bad, [], `Use <BackButton> from components/BackButton.tsx.\n${bad.join('\n')}`);
  });

  it('set access in one way: <AccessPicker>, not hand-built No access / View / Edit buttons', () => {
    const bad = offenders(/title="No access"/);
    assert.deepEqual(bad, [], `Use <AccessPicker> from components/AccessPicker.tsx.\n${bad.join('\n')}`);
  });
});

describe('text', () => {
  it('uses .card-lede under a card title, never pale slate-400 text people need to read', () => {
    const bad = offenders(/text-xs text-slate-400 mt-1 mb-4/);
    assert.deepEqual(bad, [], `Use <p className="card-lede">.\n${bad.join('\n')}`);
  });
});

describe('the shared parts exist', () => {
  it('are all in place', () => {
    for (const file of ['Dialog', 'AccessPicker', 'BackButton', 'AppSelect']) {
      assert.ok(sources.some((s) => s.file === `components/${file}.tsx`), `${file}.tsx is missing`);
    }
    const css = read('index.css');
    for (const cls of ['.scrim', '.dialog', '.field-control', '.seg', '.back-btn', '.icon-action', '.card-lede', '.meta']) {
      assert.ok(css.includes(`\n${cls} {`) || css.includes(`\n${cls}[`) || css.includes(`\n${cls}:`), `${cls} is missing from index.css`);
    }
  });
});
