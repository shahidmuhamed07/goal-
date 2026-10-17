import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NICHES,
  buildGuidedPlan,
  cleanText,
  isAnswered,
  makePlanWithRules,
  type Answers,
  type CommonAnswers,
} from './guidedGoal';
import { materializePlan, tasksForMinutes } from './starterPlan';

const common = (over: Partial<CommonAnswers> = {}): CommonAnswers => ({ days: [1, 3, 5], minutes: 30, months: 3, ...over });

/** The first option of every choice question, and a short text for every required text question. */
const firstChoices = (key: string): Answers => {
  const niche = NICHES.find((n) => n.key === key)!;
  const answers: Answers = {};
  for (const q of niche.questions) {
    if (q.kind === 'single') answers[q.id] = q.options![0].value;
    if (q.kind === 'text' && !q.optional) answers[q.id] = 'Spanish';
  }
  return answers;
};

describe('every niche', () => {
  it('covers the eight niches, each with at least three questions and no repeated question id', () => {
    assert.equal(NICHES.length, 8);
    assert.equal(new Set(NICHES.map((n) => n.key)).size, 8);
    for (const n of NICHES) {
      assert.ok(n.questions.length >= 3, n.key);
      assert.equal(new Set(n.questions.map((q) => q.id)).size, n.questions.length, `${n.key} repeats a question id`);
      for (const q of n.questions) {
        if (q.kind !== 'text') assert.ok((q.options?.length ?? 0) >= 2, `${n.key}.${q.id} needs options`);
      }
    }
  });

  it('makes a sound plan with no answers at all (the person skipped everything)', () => {
    for (const n of NICHES) {
      const plan = buildGuidedPlan(n.key, {}, common());
      assert.ok(plan.title.length > 0 && plan.title.length <= 100, n.key);
      assert.equal(plan.category, n.category);
      assert.ok(plan.routines.length >= 1, n.key);
    }
  });

  it('makes a sound plan from the first choice of every question', () => {
    for (const n of NICHES) {
      const plan = buildGuidedPlan(n.key, firstChoices(n.key), common());
      for (const r of plan.routines) {
        assert.ok(r.name.length > 0, `${n.key}: unnamed routine`);
        assert.ok(r.tasks.length >= 1, `${n.key}/${r.name}: no tasks`);
        assert.ok(r.tasks.every((t) => t.length > 0 && t.length <= 160), `${n.key}/${r.name}: bad task`);
        assert.ok(r.weekdays.length >= 1 && r.weekdays.every((d) => [1, 3, 5].includes(d)), `${n.key}/${r.name}: day outside the chosen days`);
      }
      assert.equal(JSON.stringify(plan).includes('undefined'), false, `${n.key} left an undefined`);
    }
  });

  it('never repeats a routine name within one plan', () => {
    for (const n of NICHES) {
      for (const answers of [{}, firstChoices(n.key)]) {
        const names = buildGuidedPlan(n.key, answers, common({ days: [0, 1, 2, 3, 4, 5, 6] })).routines.map((r) => r.name);
        assert.equal(new Set(names).size, names.length, `${n.key}: ${names.join(', ')}`);
      }
    }
  });
});

describe('the common answers shape the plan', () => {
  it('fewer minutes means fewer tasks per routine', () => {
    for (const n of NICHES) {
      const short = buildGuidedPlan(n.key, firstChoices(n.key), common({ minutes: 15 }));
      const long = buildGuidedPlan(n.key, firstChoices(n.key), common({ minutes: 60 }));
      assert.ok(short.routines.every((r) => r.tasks.length <= tasksForMinutes(15)), n.key);
      assert.ok(long.routines.some((r) => r.tasks.length > tasksForMinutes(15)), n.key);
    }
  });

  it('one chosen day means one routine; many days mean up to four, all on chosen days', () => {
    const one = buildGuidedPlan('fitness', firstChoices('fitness'), common({ days: [2] }));
    assert.equal(one.routines.length, 1);
    assert.deepEqual(one.routines[0].weekdays, [2]);
    const many = buildGuidedPlan('fitness', firstChoices('fitness'), common({ days: [1, 2, 3, 4, 5, 6, 0] }));
    assert.equal(many.routines.length, 4);
    assert.ok(many.routines.every((r) => r.weekdays.length >= 1));
  });

  it('carries the number of months through', () => {
    assert.equal(buildGuidedPlan('career', {}, common({ months: 6 })).months, 6);
  });
});

describe('answers change what is offered', () => {
  it('career: the target role goes into the title and a task', () => {
    const plan = buildGuidedPlan('career', { aim: 'job', target: 'product designer' }, common({ days: [1, 2, 3, 4, 5] }));
    assert.equal(plan.title, 'Land a product designer role');
    assert.ok(plan.routines.some((r) => r.tasks.some((t) => t.includes('product designer'))));
  });

  it('career: different aims make different plans', () => {
    const promo = buildGuidedPlan('career', { aim: 'promo' }, common());
    const job = buildGuidedPlan('career', { aim: 'job' }, common());
    assert.notEqual(promo.title, job.title);
    assert.ok(promo.routines.some((r) => r.name === 'Promotion plan'));
    assert.ok(job.routines.some((r) => r.name === 'Job search'));
  });

  it('"Something else" uses what the person typed', () => {
    const plan = buildGuidedPlan('career', { aim: 'other', aim_other: 'Become a team lead' }, common());
    assert.equal(plan.title, 'Become a team lead');
  });

  it('learning: the thing to learn is the title', () => {
    assert.equal(buildGuidedPlan('learning', { what: 'Spanish' }, common()).title, 'Learn Spanish');
  });

  it('diet: the eating style changes the protein task', () => {
    const veg = buildGuidedPlan('diet', { style: 'vegetarian', meals: 'home' }, common({ days: [1, 2, 3, 4, 5], minutes: 60 }));
    assert.ok(veg.routines.flatMap((r) => r.tasks).some((t) => t.includes('paneer')));
    const vegan = buildGuidedPlan('diet', { style: 'vegan', meals: 'home' }, common({ days: [1, 2, 3, 4, 5], minutes: 60 }));
    assert.ok(vegan.routines.flatMap((r) => r.tasks).some((t) => t.includes('tofu')));
  });

  it('diet: eating out adds a routine for it', () => {
    const out = buildGuidedPlan('diet', { meals: 'out' }, common({ days: [1, 2, 3, 4] }));
    assert.equal(out.routines[0].name, 'Eating out, smartly');
  });

  it('fitness: where and level change the exercises', () => {
    const gym = buildGuidedPlan('fitness', { aim: 'muscle', where: 'gym', level: 'beginner' }, common({ minutes: 60 }));
    const home = buildGuidedPlan('fitness', { aim: 'muscle', where: 'home', level: 'beginner' }, common({ minutes: 60 }));
    assert.ok(gym.routines[0].tasks.some((t) => t.includes('Bench press')));
    assert.ok(home.routines[0].tasks.some((t) => t.includes('Push-ups')));
    assert.ok(gym.routines[0].tasks.some((t) => t.includes('3 sets of 8')));
  });

  it('fitness: an injury note becomes a warm-up reminder', () => {
    const plan = buildGuidedPlan('fitness', { aim: 'muscle', where: 'gym', note: 'sore left knee' }, common());
    assert.ok(plan.routines[0].tasks[0].includes('sore left knee'));
  });
});

describe('typed text is made safe', () => {
  it('shortens, strips control characters and collapses spaces', () => {
    assert.equal(cleanText('  hello \n\n  world\u0000  '), 'hello world');
    assert.equal(cleanText('x'.repeat(200)).length, 60);
  });

  it('a very long or messy target cannot break a title', () => {
    const plan = buildGuidedPlan('career', { aim: 'job', target: `${'a'.repeat(300)}\n\n<script>` }, common());
    assert.ok(plan.title.length <= 100);
    assert.equal(/[\n\u0000]/.test(plan.title), false);
  });
});

describe('answers needed to move on', () => {
  const career = NICHES.find((n) => n.key === 'career')!;
  const [aim, , focus, target] = career.questions;

  it('a choice must be made, and "Something else" must be typed', () => {
    assert.equal(isAnswered(aim, {}), false);
    assert.equal(isAnswered(aim, { aim: 'job' }), true);
    assert.equal(isAnswered(aim, { aim: 'other' }), false);
    assert.equal(isAnswered(aim, { aim: 'other', aim_other: '  ' }), false);
    assert.equal(isAnswered(aim, { aim: 'other', aim_other: 'Become a team lead' }), true);
  });

  it('picking nothing is fine for multi-choice, and optional text may stay empty', () => {
    assert.equal(isAnswered(focus, {}), true);
    assert.equal(isAnswered(target, {}), true);
  });

  it('a required text answer must have something in it', () => {
    const what = NICHES.find((n) => n.key === 'learning')!.questions[0];
    assert.equal(isAnswered(what, {}), false);
    assert.equal(isAnswered(what, { what: '   ' }), false);
    assert.equal(isAnswered(what, { what: 'Spanish' }), true);
  });
});

describe('it plugs into the calendar', () => {
  it('the plan can be written onto dates with tasks', () => {
    const plan = buildGuidedPlan('fitness', firstChoices('fitness'), common({ days: [1, 3, 5] }));
    const { subcategories, tasks } = materializePlan(plan, { fromDate: '2026-10-12', endDate: '2026-11-30', seed: 5 });
    assert.ok(subcategories.length > 10);
    assert.ok(tasks.length > subcategories.length);
    assert.ok(tasks.every((t) => subcategories.some((s) => s.id === t.subcategoryId)));
  });

  it('the AI-ready seam: the rules plan maker returns the same plan', async () => {
    const answers = firstChoices('career');
    assert.deepEqual(await makePlanWithRules('career', answers, common()), buildGuidedPlan('career', answers, common()));
  });
});
