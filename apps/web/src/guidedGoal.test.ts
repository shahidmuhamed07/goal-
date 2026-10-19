import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AnswerReader,
  NICHES,
  buildGuidedPlan,
  cleanText,
  describeForAi,
  isAnswered,
  makePlanWithRules,
  visibleQuestions,
  type Answers,
  type CommonAnswers,
  type NicheKey,
} from './guidedGoal';
import { GOAL_CATEGORIES } from './utils';
import { adviseFitnessWeek, bmiOf, limitsFrom, weekdaysFor } from './fitnessPlan';
import { materializePlan, tasksForMinutes } from './starterPlan';

const common = (over: Partial<CommonAnswers> = {}): CommonAnswers => ({ days: [1, 3, 5], minutes: 30, months: 3, ...over });

/** The first option of every question that applies, answered in order (some questions depend on earlier answers). */
const firstChoices = (key: NicheKey): Answers => {
  const niche = NICHES.find((n) => n.key === key)!;
  const answers: Answers = {};
  for (const q of niche.questions) {
    if (q.showIf && !q.showIf(answers)) continue;
    if (q.kind === 'single') answers[q.id] = q.options[0].value;
  }
  return answers;
};

describe('the niches', () => {
  it('are the four areas of the plain form, plus "Something else"', () => {
    const real = NICHES.filter((n) => n.key !== 'custom');
    assert.deepEqual(real.map((n) => n.category), [...GOAL_CATEGORIES]);
    assert.equal(NICHES[NICHES.length - 1].key, 'custom');
    assert.equal(NICHES.length, 5);
  });

  it('have no Creative Writing, in the plain form or the guided flow', () => {
    assert.equal((GOAL_CATEGORIES as readonly string[]).includes('Creative Writing'), false);
    assert.equal(NICHES.some((n) => n.category === 'Creative Writing' || /creative/i.test(n.label)), false);
  });

  it('never ask the person to type: every question is a tap with at least two choices', () => {
    for (const n of NICHES) {
      assert.ok(n.questions.length >= 2 && n.questions.length <= 5, n.key);
      assert.equal(new Set(n.questions.map((q) => q.id)).size, n.questions.length, `${n.key} repeats a question id`);
      for (const q of n.questions) {
        assert.ok(q.kind === 'single' || q.kind === 'multi', `${n.key}.${q.id}`);
        assert.ok(q.options.length + (q.allowOther ? 1 : 0) >= 2, `${n.key}.${q.id} needs choices`);
      }
    }
  });

  it('ask at most five questions on any path, so it stays quick (the AI adds a few more after)', () => {
    for (const n of NICHES) {
      const worst = Math.max(
        visibleQuestions(n, {}).length,
        visibleQuestions(n, firstChoices(n.key)).length,
        ...n.questions.flatMap((q) => q.options.map((o) => visibleQuestions(n, { [q.id]: o.value }).length)),
      );
      assert.ok(worst <= 5, `${n.key} asks ${worst} questions`);
    }
  });
});

describe('every niche makes a sound plan', () => {
  it('with no answers at all (the person skipped everything)', () => {
    for (const n of NICHES) {
      const plan = buildGuidedPlan(n.key, {}, common());
      assert.ok(plan.title.length > 0 && plan.title.length <= 100, n.key);
      assert.equal(plan.category, n.category);
      assert.ok(plan.routines.length >= 1, n.key);
    }
  });

  it('from the first choice of every question', () => {
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

  it('for every single choice of the first question, with nothing else answered', () => {
    for (const n of NICHES) {
      for (const o of n.questions[0].options) {
        const plan = buildGuidedPlan(n.key, { [n.questions[0].id]: o.value }, common({ days: [1, 2, 3, 4, 5] }));
        assert.ok(plan.routines.length >= 1 && plan.title.length > 0, `${n.key}/${o.value}`);
        const names = plan.routines.map((r) => r.name);
        assert.equal(new Set(names).size, names.length, `${n.key}/${o.value}: repeated routine ${names.join(', ')}`);
      }
    }
  });
});

describe('the common answers shape the plan', () => {
  it('the time for each session is optional, and leaving it out gives a normal amount', () => {
    for (const n of NICHES) {
      const none = buildGuidedPlan(n.key, firstChoices(n.key), common({ minutes: null }));
      const normal = buildGuidedPlan(n.key, firstChoices(n.key), common({ minutes: 30 }));
      assert.deepEqual(none.routines.map((r) => r.tasks.length), normal.routines.map((r) => r.tasks.length), n.key);
    }
  });

  it('fewer minutes mean fewer tasks per routine', () => {
    for (const n of NICHES) {
      // Fitness sizes each session to the time itself, with a warm up and a stretch around the exercises:
      // its own rules are tested in fitnessPlan.test.ts.
      if (n.key === 'fitness') continue;
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
  });

  it('carries the number of months through', () => {
    assert.equal(buildGuidedPlan('career', {}, common({ months: 6 })).months, 6);
  });
});

describe('answers change what is offered, without forcing anything', () => {
  it('career: different aims make different plans', () => {
    const promo = buildGuidedPlan('career', { aim: 'promo' }, common());
    const job = buildGuidedPlan('career', { aim: 'job' }, common());
    assert.equal(job.title, 'Land a new job');
    assert.equal(promo.title, 'Earn my next promotion');
    assert.ok(promo.routines.some((r) => r.name === 'Promotion plan'));
    assert.ok(job.routines.some((r) => r.name === 'Job search'));
  });

  it('career: tapping help areas adds their routines', () => {
    const plan = buildGuidedPlan('career', { aim: 'grow', focus: ['network', 'profile'] }, common({ days: [1, 2, 3, 4, 5] }));
    const names = plan.routines.map((r) => r.name);
    assert.ok(names.includes('Networking') && names.includes('Profile and portfolio'));
  });

  it('business and career are one area: "Start or grow a business" gets a business plan', () => {
    const plan = buildGuidedPlan('career', { aim: 'business' }, common({ days: [1, 2, 3, 4, 5] }));
    assert.equal(plan.category, 'Business & Career');
    assert.ok(plan.routines.length >= 3);
    assert.ok(plan.routines.every((r) => r.tasks.length > 0));
  });

  it('"Something else" uses what was typed, and works fine if nothing was typed', () => {
    assert.equal(buildGuidedPlan('career', { aim: 'other', aim_other: 'Become a team lead' }, common()).title, 'Become a team lead');
    assert.equal(buildGuidedPlan('career', { aim: 'other' }, common()).title, 'Reach my career goal');
    assert.equal(buildGuidedPlan('learning', { what: 'other', what_other: 'Chess' }, common()).title, 'Learn Chess');
    assert.equal(buildGuidedPlan('learning', { what: 'other' }, common()).title, 'Learn something new');
  });

  it('learning: the subject picked sets the title', () => {
    assert.equal(buildGuidedPlan('learning', { what: 'language' }, common()).title, 'Learn a new language');
    assert.equal(buildGuidedPlan('learning', { what: 'music' }, common()).title, 'Learn music');
  });

  it('fitness: where and level change the exercises', () => {
    const gym = buildGuidedPlan('fitness', { aim: 'muscle', where: 'gym', level: 'beginner' }, common({ minutes: 60 }));
    const home = buildGuidedPlan('fitness', { aim: 'muscle', where: 'home', level: 'beginner' }, common({ minutes: 60 }));
    assert.ok(gym.routines[0].tasks.some((t) => t.includes('Bench press') && t.includes('3 sets of 8')));
    assert.ok(home.routines[0].tasks.some((t) => t.includes('Push-ups')));
  });

  it('money: a debt goal gets a debt plan, a saving goal does not', () => {
    const debt = buildGuidedPlan('money', { aim: 'debt' }, common({ days: [1, 2, 3, 4] }));
    const save = buildGuidedPlan('money', { aim: 'save' }, common({ days: [1, 2, 3, 4] }));
    assert.ok(debt.routines.some((r) => r.name === 'Debt plan'));
    assert.equal(save.routines.some((r) => r.name === 'Debt plan'), false);
  });

  it('custom ("Something else"): any kind of goal gets a simple rhythm to rename', () => {
    const plan = buildGuidedPlan('custom', { kind: 'habit', help: ['checkin'] }, common({ days: [1, 2, 3, 4, 5] }));
    assert.equal(plan.title, 'Build a new habit');
    assert.equal(plan.category, 'General');
    assert.equal(plan.focus, 'custom');
    assert.ok(plan.routines.some((r) => r.name === 'Daily check-in'));
  });
});

describe('typed text is made safe', () => {
  it('shortens, strips control characters and collapses spaces', () => {
    assert.equal(cleanText('  hello \n\n  world\u0000  '), 'hello world');
    assert.equal(cleanText('x'.repeat(200)).length, 60);
  });

  it('a very long or messy name for "Something else" cannot break a title', () => {
    const plan = buildGuidedPlan('career', { aim: 'other', aim_other: `${'a'.repeat(300)}\n\n<script>` }, common());
    assert.ok(plan.title.length <= 100);
    assert.equal(/[\n\u0000]/.test(plan.title), false);
  });
});

describe('moving on needs only a tap', () => {
  const career = NICHES.find((n) => n.key === 'career')!;
  const [aim, , focus] = career.questions;

  it('a single choice must be made, and "Something else" counts without typing', () => {
    assert.equal(isAnswered(aim, {}), false);
    assert.equal(isAnswered(aim, { aim: 'job' }), true);
    assert.equal(isAnswered(aim, { aim: 'other' }), true);
  });

  it('picking nothing is fine for multi-choice', () => {
    assert.equal(isAnswered(focus, {}), true);
  });
});

describe('the plain form and the helper agree', () => {
  it('every category in the plain form has a niche in the helper', () => {
    for (const c of GOAL_CATEGORIES) assert.ok(NICHES.some((n) => n.category === c), c);
  });
});

describe('it plugs into the calendar', () => {
  it('every niche can be written onto dates with tasks', () => {
    for (const n of NICHES) {
      const plan = buildGuidedPlan(n.key, firstChoices(n.key), common({ days: [1, 3, 5] }));
      const { subcategories, tasks } = materializePlan(plan, { fromDate: '2026-10-12', endDate: '2026-11-30', seed: 5 });
      assert.ok(subcategories.length > 5, n.key);
      assert.ok(tasks.every((t) => subcategories.some((s) => s.id === t.subcategoryId)), n.key);
    }
  });

  it('a routine set to every other week lands on every second week only, with that remembered', () => {
    const base = { focus: 'custom' as const, title: 'T', category: 'Health', description: '', months: 2 };
    const weekly = materializePlan({ ...base, routines: [{ name: 'Yoga', weekdays: [1], tasks: ['Stretch'] }] }, { fromDate: '2026-10-12', endDate: '2026-11-30', seed: 1 });
    const biweekly = materializePlan({ ...base, routines: [{ name: 'Yoga', weekdays: [1], tasks: ['Stretch'], everyWeeks: 2 }] }, { fromDate: '2026-10-12', endDate: '2026-11-30', seed: 1 });
    assert.equal(weekly.subcategories.length, 8);
    assert.deepEqual(biweekly.subcategories.map((s) => s.date), ['2026-10-12', '2026-10-26', '2026-11-09', '2026-11-23']);
    assert.ok(biweekly.subcategories.every((s) => s.repeatEvery === 2));
    assert.equal(weekly.subcategories.some((s) => 'repeatEvery' in s), false);
  });

  describe('the first day of a new plan', () => {
    const base = { focus: 'custom' as const, title: 'T', category: 'Health', description: '', months: 2 };
    // Sunday 18 October 2026: the routines below run Monday, Wednesday and Friday only.
    const plan = { ...base, routines: [{ name: 'Strength', weekdays: [1, 3, 5], tasks: ['Warm up', 'Lift'] }, { name: 'Cardio', weekdays: [2], tasks: ['Run'] }] };

    it('shows work on a day that is not one of the chosen weekdays, when asked to', () => {
      const without = materializePlan(plan, { fromDate: '2026-10-18', endDate: '2026-12-31', seed: 7 });
      assert.equal(without.subcategories.some((s) => s.date === '2026-10-18'), false);
      const withStart = materializePlan(plan, { fromDate: '2026-10-18', endDate: '2026-12-31', seed: 7, startToday: true });
      const today = withStart.subcategories.filter((s) => s.date === '2026-10-18');
      assert.equal(today.length, 1);
      assert.equal(today[0].name, 'Strength');
      assert.equal('repeatId' in today[0], false, 'a one-off day, not a new routine');
      assert.deepEqual(withStart.tasks.filter((t) => t.subcategoryId === today[0].id).map((t) => t.text), ['Warm up', 'Lift']);
      assert.ok(withStart.tasks.filter((t) => t.subcategoryId === today[0].id).every((t) => t.date === '2026-10-18' && !t.completed));
    });

    it('adds nothing when the first day is already a chosen weekday', () => {
      const monday = materializePlan(plan, { fromDate: '2026-10-19', endDate: '2026-12-31', seed: 7, startToday: true });
      assert.equal(monday.subcategories.filter((s) => s.date === '2026-10-19').length, 1);
      assert.equal(monday.subcategories.filter((s) => s.id.endsWith('-start')).length, 0);
    });

    it('keeps every task attached to a day that exists, with unique ids', () => {
      const result = materializePlan(plan, { fromDate: '2026-10-18', endDate: '2026-12-31', seed: 7, startToday: true });
      assert.ok(result.tasks.every((t) => result.subcategories.some((s) => s.id === t.subcategoryId)));
      assert.equal(new Set(result.tasks.map((t) => t.id)).size, result.tasks.length);
      assert.equal(new Set(result.subcategories.map((s) => s.id)).size, result.subcategories.length);
    });

    it('does nothing for a plan with no routines', () => {
      const empty = materializePlan({ ...base, routines: [] }, { fromDate: '2026-10-18', endDate: '2026-12-31', startToday: true });
      assert.deepEqual(empty, { subcategories: [], tasks: [] });
    });
  });

  it('the AI-ready seam: the rules plan maker returns the same plan', async () => {
    const answers = firstChoices('career');
    assert.deepEqual(await makePlanWithRules('career', answers, common()), buildGuidedPlan('career', answers, common()));
  });
});

describe('working with the AI planner', () => {
  it('tells the AI the area and each choice as plain question and answer text', () => {
    const described = describeForAi('career', { aim: 'switch' });
    assert.equal(described.niche, 'Business & Career');
    assert.ok(described.answers.length >= 1);
    assert.ok(described.answers.every((a) => a.q.length > 0 && a.a.length > 0));
    assert.ok(!JSON.stringify(described).includes('"switch"'), 'shows the label, not the internal value');
  });

  it('sends typed "something else" text, and follow-up answers, in the person\'s own words', () => {
    const answers = { aim: 'other', aim_other: '  Become a\u0007 pilot ', 'ai:f1': 'Tech', 'ai:f2': 'other', 'ai:f2_other': 'Evenings' };
    const described = describeForAi('career', answers, [
      { id: 'f1', title: 'Which field?' },
      { id: 'f2', title: 'When?' },
      { id: 'f3', title: 'Not answered?' },
    ]);
    assert.ok(described.answers.some((a) => a.a === 'Become a pilot'));
    assert.deepEqual(described.answers.slice(-2), [
      { q: 'Which field?', a: 'Tech' },
      { q: 'When?', a: 'Evenings' },
    ]);
  });
});

describe('the "no pain or limits" choice', () => {
  const limits = NICHES.find((n) => n.key === 'fitness')!.questions.find((q) => q.id === 'limits')!;

  it('is offered first and must be answered, so it is a deliberate tap', () => {
    assert.equal(limits.options[0].value, 'none');
    assert.equal(limits.options[0].exclusive, true);
    assert.equal(isAnswered(limits, {}), false);
    assert.equal(isAnswered(limits, { limits: ['none'] }), true);
    assert.equal(isAnswered(limits, { limits: ['knees'] }), true);
  });

  it('makes the same plan as having nothing to work around', () => {
    const base = { aim: 'muscle', where: 'gym', level: 'beginner' };
    const none = buildGuidedPlan('fitness', { ...base, limits: ['none'] }, common());
    const empty = buildGuidedPlan('fitness', { ...base, limits: [] }, common());
    assert.deepEqual(none, empty);
  });
});

describe('every question reads the same', () => {
  it('explains why it is asked, in one short line', () => {
    for (const n of NICHES) {
      for (const q of n.questions) {
        assert.ok(q.why.length >= 10 && q.why.length <= 90, `${n.key}.${q.id}: "${q.why}"`);
      }
    }
  });

  it('gives every choice of a question a hint, or none of them (never just some)', () => {
    for (const n of NICHES) {
      for (const q of n.questions) {
        const hinted = q.options.filter((o) => !!o.hint).length;
        assert.ok(hinted === 0 || hinted === q.options.length, `${n.key}.${q.id} has hints on ${hinted} of ${q.options.length} choices`);
      }
    }
  });

  it('fitness lets the person describe a pain in their own words, and reads it', () => {
    const limits = NICHES.find((n) => n.key === 'fitness')!.questions.find((q) => q.id === 'limits')!;
    assert.equal(limits.allowOther, true);
    assert.equal(limits.options.length, 1, 'only "No pain or limits" is listed; the rest is typed');
    const reader = (answers: Answers) => new AnswerReader(NICHES.find((n) => n.key === 'fitness')!.questions, answers);
    assert.deepEqual(limitsFrom(reader({ limits: ['none'] })), []);
    assert.deepEqual(limitsFrom(reader({ limits: ['other'], limits_other: 'sore left knee, and a bad back' })), ['knees', 'back']);
    assert.deepEqual(limitsFrom(reader({ limits: ['other'], limits_other: 'tennis elbow' })), [], 'unknown pains are only passed to the AI as text');
  });
});

describe('the week we recommend for fitness', () => {
  const advise = (answers: Answers) => adviseFitnessWeek(new AnswerReader(NICHES.find((n) => n.key === 'fitness')!.questions, answers));

  it('suggests fewer days for a beginner than for an experienced person', () => {
    assert.equal(advise({ aim: 'muscle', level: 'beginner' }).days.length, 3);
    assert.equal(advise({ aim: 'muscle', level: 'experienced' }).days.length, 5);
  });

  it('follows the training split the person chose', () => {
    assert.equal(advise({ aim: 'muscle', level: 'some', split: 'upperlower' }).days.length, 4);
    assert.equal(advise({ aim: 'muscle', level: 'beginner', split: 'ppl' }).days.length, 3);
    assert.equal(advise({ aim: 'muscle', level: 'experienced', split: 'ppl' }).days.length, 6);
  });

  it('takes a day off when there is a pain or limit, but not from a beginner who has only three', () => {
    assert.equal(advise({ aim: 'muscle', level: 'some', limits: ['other'], limits_other: 'sore knee' }).days.length, 3);
    assert.equal(advise({ aim: 'muscle', level: 'beginner', limits: ['other'], limits_other: 'bad back' }).days.length, 3);
  });

  it('says why in one sentence and suggests a time the app offers', () => {
    const advice = advise({ aim: 'fat', level: 'returning' });
    assert.match(advice.note, /^We suggest \d days a week, about \d+ minutes each time, because /);
    assert.ok([15, 30, 45, 60].includes(advice.minutes));
  });

  it('spreads the days with rest between and never repeats a day', () => {
    for (let n = 1; n <= 7; n += 1) {
      const days = weekdaysFor(n);
      assert.equal(days.length, n);
      assert.equal(new Set(days).size, n);
    }
  });
});

describe('the recommendation uses what the person told us about themselves', () => {
  const reader = (answers: Answers) => new AnswerReader(NICHES.find((n) => n.key === 'fitness')!.questions, answers);

  it('works out body mass index only from believable height and weight', () => {
    assert.equal(bmiOf({ heightCm: 170, weightKg: 70 }), 24.2);
    assert.equal(bmiOf({ heightCm: 170 }), undefined);
    assert.equal(bmiOf({ heightCm: 20, weightKg: 70 }), undefined);
  });

  it('gives fat loss more time each session than muscle building', () => {
    const base = { level: 'some' };
    const fat = adviseFitnessWeek(reader({ ...base, aim: 'fat' }), { age: 30, heightCm: 170, weightKg: 80 });
    const muscle = adviseFitnessWeek(reader({ ...base, aim: 'muscle' }), { age: 30, heightCm: 170, weightKg: 80 });
    assert.ok(fat.minutes > muscle.minutes, `${fat.minutes} vs ${muscle.minutes}`);
    assert.match(muscle.note, /shorter, harder sessions, with a different workout each day/);
    assert.match(fat.note, /a little more time/);
  });

  it('starts gently and low impact at a high body weight, and gentler for an older person', () => {
    const heavy = adviseFitnessWeek(reader({ level: 'some', aim: 'fat' }), { heightCm: 165, weightKg: 100 });
    assert.ok(heavy.minutes <= 45);
    assert.match(heavy.note, /low-impact/);
    const older = adviseFitnessWeek(reader({ level: 'experienced', aim: 'muscle' }), { age: 62 });
    const younger = adviseFitnessWeek(reader({ level: 'experienced', aim: 'muscle' }), { age: 30 });
    assert.ok(older.days.length < younger.days.length);
    assert.match(older.note, /gentler for your age/);
  });

  it('keeps a teenager to a few days, and never asks a sitting beginner for more than three', () => {
    assert.ok(adviseFitnessWeek(reader({ level: 'experienced', aim: 'muscle' }), { age: 15 }).days.length <= 4);
    assert.equal(adviseFitnessWeek(reader({ level: 'beginner', aim: 'fat' }), { movement: 'sitting' }).days.length, 3);
  });

  it('ignores an age or measurement that cannot be real', () => {
    const odd = adviseFitnessWeek(reader({ level: 'some', aim: 'muscle' }), { age: 400, heightCm: 5, weightKg: 9000 });
    const none = adviseFitnessWeek(reader({ level: 'some', aim: 'muscle' }));
    assert.deepEqual(odd, none);
  });
});
