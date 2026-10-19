import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AnswerReader, buildGuidedPlan, nicheByKey, type Answers, type CommonAnswers } from './guidedGoal';
import { adviseFitnessWeek, bmiOf, movesForMinutes, readProfile, recommendAim, weekdaysFor } from './fitnessPlan';

const common = (over: Partial<CommonAnswers> = {}): CommonAnswers => ({ days: [1, 3, 5], minutes: 30, months: 3, ...over });
const plan = (answers: Answers, over: Partial<CommonAnswers> = {}) => buildGuidedPlan('fitness', answers, common(over));
const names = (p: ReturnType<typeof plan>) => p.routines.map((r) => r.name);
const allTasks = (p: ReturnType<typeof plan>) => p.routines.flatMap((r) => r.tasks);

const AIMS = ['muscle', 'strength', 'fat', 'stamina', 'mobility', 'active'];
const PLACES = ['gym', 'home', 'homegear', 'outdoors'];
const LEVELS = ['beginner', 'returning', 'some', 'experienced'];
const DAY_SETS = [[2], [1, 4], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 0]];

describe('the fitness questions', () => {
  const niche = nicheByKey('fitness');
  const options = (id: string) => niche.questions.find((q) => q.id === id)!.options.map((o) => o.value);

  it('offer four or more choices on every question, so people find themselves in them', () => {
    for (const q of niche.questions.filter((x) => x.kind !== 'numbers')) assert.ok(q.options.length >= 4, q.id);
    assert.ok(options('aim').length >= 5);
    assert.ok(options('where').length >= 4);
    assert.ok(options('level').length >= 4);
  });

  it('cover the aims, places and levels the plan builder understands', () => {
    assert.deepEqual(options('aim'), AIMS);
    assert.deepEqual(options('where'), PLACES);
    assert.deepEqual(options('level'), LEVELS);
  });
});

describe('knowing the person: height, weight and steps come first', () => {
  const niche = nicheByKey('fitness');
  const reader = (answers: Answers) => new AnswerReader(niche.questions, answers);

  it('asks for height and weight, then steps, before the aim, so the aim can be recommended', () => {
    assert.deepEqual(niche.questions.map((q) => q.id), ['body', 'steps', 'aim', 'where', 'level', 'limits']);
    const body = niche.questions[0];
    assert.equal(body.kind, 'numbers');
    assert.equal(body.skippable, true);
    assert.deepEqual(body.fields!.map((f) => f.id), ['height', 'weight']);
  });

  it('works out body mass index, and ignores numbers that cannot be right', () => {
    assert.equal(bmiOf(170, 70), 24.2);
    assert.equal(bmiOf(160, 90), 35.2);
    assert.equal(bmiOf(undefined, 70), undefined);
    assert.equal(bmiOf(60, 70), undefined);
    assert.equal(bmiOf(170, 5), undefined);
  });

  it('recommends fat loss for a higher BMI, muscle for a low one, and reads steps when there are no numbers', () => {
    assert.equal(recommendAim({ bmi: 27, steps: undefined }), 'fat');
    assert.equal(recommendAim({ bmi: 25, steps: 'high' }), 'fat');
    assert.equal(recommendAim({ bmi: 17.5, steps: 'some' }), 'muscle');
    assert.equal(recommendAim({ bmi: 22, steps: 'some' }), 'muscle');
    assert.equal(recommendAim({ bmi: undefined, steps: 'low' }), 'active');
    assert.equal(recommendAim({ bmi: undefined, steps: 'high' }), 'strength');
    assert.equal(recommendAim({ bmi: undefined, steps: undefined }), undefined);
  });

  it('the aim question marks the recommended aim from the answers so far', () => {
    const aim = niche.questions.find((q) => q.id === 'aim')!;
    assert.equal(aim.recommend!({ height: '170', weight: '85' }), 'fat');
    assert.equal(aim.recommend!({ steps: 'low' }), 'active');
    assert.equal(aim.recommend!({}), undefined);
    assert.equal(aim.recommend!({ body_skipped: '1' }), undefined);
  });

  it('suggests days and a session length that fit experience, aim and walking', () => {
    const advise = (answers: Answers) => adviseFitnessWeek(readProfile(reader(answers)));
    assert.deepEqual(advise({ level: 'beginner', aim: 'muscle' }).days, [1, 3, 5]);
    assert.equal(advise({ level: 'beginner', aim: 'muscle' }).minutes, 30);
    assert.equal(advise({ level: 'some', aim: 'muscle' }).days.length, 4);
    assert.equal(advise({ level: 'some', aim: 'muscle' }).minutes, 45);
    assert.equal(advise({ level: 'experienced', aim: 'muscle' }).days.length, 5);
    assert.equal(advise({ level: 'experienced', aim: 'fat' }).days.length, 6);
    assert.equal(advise({ level: 'beginner', aim: 'fat', steps: 'good' }).days.length, 4);
    assert.equal(advise({ level: 'beginner', aim: 'fat', steps: 'low' }).days.length, 3);
  });

  it('keeps it gentle when breathless, or when very little walking meets a beginner', () => {
    const advise = (answers: Answers) => adviseFitnessWeek(readProfile(reader(answers)));
    assert.ok(advise({ level: 'experienced', aim: 'fat', limits: ['breath'] }).days.length <= 3);
    assert.equal(advise({ level: 'experienced', limits: ['breath'] }).minutes, 30);
    assert.ok(advise({ level: 'beginner', aim: 'muscle', steps: 'low' }).days.length <= 3);
  });

  it('explains what the suggestion is based on, including the BMI when it is known', () => {
    const note = adviseFitnessWeek(readProfile(reader({ height: '170', weight: '85', steps: 'low', level: 'beginner', aim: 'fat' }))).note;
    assert.match(note, /^We suggest 3 days a week of about 30 minutes, because /);
    assert.ok(note.includes('BMI of 29.4') && note.includes('very little') && note.includes('losing fat'));
    const bare = adviseFitnessWeek(readProfile(reader({}))).note;
    assert.ok(!bare.includes('BMI'));
  });

  it('spreads any number of days over the week with rest days between', () => {
    for (let n = 1; n <= 7; n += 1) assert.equal(weekdaysFor(n).length, n);
    assert.deepEqual(weekdaysFor(3), [1, 3, 5]);
    assert.deepEqual(weekdaysFor(4), [1, 2, 4, 5]);
    assert.deepEqual(weekdaysFor(0), [3]);
    assert.equal(weekdaysFor(99).length, 7);
  });

  it('the niche passes it to the week screen', () => {
    const advice = niche.adviseWeek!(reader({ level: 'some', aim: 'muscle', height: '175', weight: '72' }));
    assert.ok(advice && advice.days.length === 4 && advice.minutes === 45 && advice.note.length > 0);
  });

  it('the plan says what it was built around', () => {
    const p = plan({ aim: 'fat', where: 'home', level: 'beginner', height: '170', weight: '85', steps: 'low' }, { days: [1, 3, 5] });
    assert.ok(p.description.includes('Built around your height and weight (BMI 29.4) and very little walking each day.'), p.description);
    assert.ok(!plan({ aim: 'fat' }).description.includes('Built around'));
  });
});

describe('every combination makes a sound fitness plan', () => {
  it('for each aim, place, level, limit, number of days and time', () => {
    let checked = 0;
    for (const aim of AIMS) {
      for (const where of PLACES) {
        for (const level of LEVELS) {
          for (const limits of [[], ['knees'], ['back'], ['shoulders'], ['breath'], ['knees', 'back', 'shoulders', 'breath']]) {
            for (const days of DAY_SETS) {
              for (const minutes of [null, 15, 30, 45, 60]) {
                const p = plan({ aim, where, level, limits }, { days, minutes });
                const where_ = `${aim}/${where}/${level}/${limits.join('+')}/${days.length}d/${minutes}`;
                assert.ok(p.routines.length >= 1 && p.routines.length <= 6, where_);
                assert.equal(new Set(names(p)).size, p.routines.length, `${where_}: repeated routine name`);
                for (const r of p.routines) {
                  assert.ok(r.name.length > 0 && r.name.length <= 60, where_);
                  assert.ok(r.tasks.length >= 3 && r.tasks.length <= 9, `${where_}/${r.name}: ${r.tasks.length} tasks`);
                  assert.ok(r.tasks.every((t) => t.length > 0 && t.length <= 160), `${where_}/${r.name}: bad task`);
                  assert.equal(new Set(r.tasks).size, r.tasks.length, `${where_}/${r.name}: a task is repeated`);
                  assert.ok(r.weekdays.length >= 1 && r.weekdays.every((d) => days.includes(d)), `${where_}/${r.name}: day outside the chosen days`);
                }
                // Every chosen day has something to do.
                assert.deepEqual([...new Set(p.routines.flatMap((r) => r.weekdays))].sort(), [...days].sort(), where_);
                assert.equal(JSON.stringify(p).includes('undefined'), false, where_);
                assert.ok(p.description.length > 0 && p.description.length <= 600, where_);
                checked += 1;
              }
            }
          }
        }
      }
    }
    assert.ok(checked > 10000);
  });

  it('with nothing answered at all', () => {
    const p = plan({});
    assert.ok(p.routines.length >= 1 && p.title.length > 0);
  });
});

describe('the week follows the number of training days', () => {
  const muscle = (days: number[], level = 'some') => plan({ aim: 'muscle', where: 'gym', level }, { days });

  it('one or two days: full body sessions', () => {
    assert.deepEqual(names(muscle([2])), ['Full body']);
    assert.deepEqual(names(muscle([2, 5])), ['Full body A', 'Full body B']);
  });

  it('three days: full body for beginners, push pull legs for everyone else', () => {
    assert.deepEqual(names(muscle([1, 3, 5], 'beginner')), ['Full body A', 'Full body B', 'Full body C']);
    assert.deepEqual(names(muscle([1, 3, 5], 'returning')), ['Full body A', 'Full body B', 'Full body C']);
    assert.deepEqual(names(muscle([1, 3, 5])), ['Strength: push', 'Strength: pull', 'Strength: legs']);
  });

  it('four days: upper and lower, alternating', () => {
    const p = muscle([1, 2, 4, 5]);
    assert.deepEqual(names(p), ['Strength: upper', 'Strength: lower']);
    assert.deepEqual(p.routines[0].weekdays, [1, 4]);
    assert.deepEqual(p.routines[1].weekdays, [2, 5]);
  });

  it('five days: five different sessions, one on each day', () => {
    const p = muscle([1, 2, 3, 4, 5]);
    assert.equal(p.routines.length, 5);
    assert.ok(p.routines.every((r) => r.weekdays.length === 1));
  });

  it('six days: push pull legs twice', () => {
    const p = muscle([1, 2, 3, 4, 5, 6]);
    assert.deepEqual(names(p), ['Strength: push', 'Strength: pull', 'Strength: legs']);
    assert.ok(p.routines.every((r) => r.weekdays.length === 2));
  });

  it('seven days: always includes an easy recovery session', () => {
    assert.ok(names(muscle([1, 2, 3, 4, 5, 6, 0])).includes('Active recovery'));
  });

  it('fat loss mixes strength with cardio and intervals', () => {
    const p = plan({ aim: 'fat', where: 'gym', level: 'some' }, { days: [1, 2, 4, 5] });
    assert.ok(names(p).includes('Intervals'));
    assert.ok(names(p).some((n) => n.startsWith('Strength')));
    assert.ok(names(p).includes('Easy cardio'));
    assert.ok(plan({ aim: 'fat' }, { days: [2] }).routines[0].tasks.some((t) => t.startsWith('Go round all the exercises')));
  });

  it('stamina is mostly cardio with a little strength', () => {
    const p = plan({ aim: 'stamina', where: 'outdoors', level: 'some' }, { days: [1, 3, 5, 6] });
    assert.deepEqual(names(p), ['Easy cardio', 'Intervals', 'Strength support', 'Long steady cardio']);
  });

  it('moving better is all mobility', () => {
    const p = plan({ aim: 'mobility' }, { days: [1, 3, 5] });
    assert.deepEqual(names(p), ['Mobility: hips and legs', 'Mobility: back and shoulders', 'Core and posture']);
  });
});

describe('where you train changes the exercises', () => {
  const tasks = (where: string, aim = 'muscle') => allTasks(plan({ aim, where, level: 'some' }, { days: [1, 2, 3, 4, 5], minutes: 60 })).join(' | ');

  it('gym, home, home with equipment and outdoors each get their own', () => {
    assert.ok(tasks('gym').includes('Bench press'));
    assert.ok(tasks('home').includes('Push-ups'));
    assert.ok(!tasks('home').includes('Bench press'));
    assert.ok(tasks('homegear').includes('Dumbbell floor press'));
    assert.ok(tasks('outdoors').includes('Pull-ups or bar hangs'));
    assert.ok(!tasks('outdoors').includes('Dumbbell'));
  });

  it('cardio uses what is there: a treadmill at the gym, a run outside, a brisk walk at home', () => {
    const cardio = (where: string) => plan({ aim: 'stamina', where, level: 'some' }, { days: [1, 3] }).routines[0].tasks.join(' | ');
    assert.ok(cardio('gym').includes('Treadmill'));
    assert.ok(cardio('outdoors').includes('Run or brisk walk'));
    assert.ok(cardio('home').includes('Brisk walk'));
  });
});

describe('experience changes the amount', () => {
  const dose = (level: string, aim = 'muscle') => allTasks(plan({ aim, where: 'gym', level }, { days: [1, 3, 5], minutes: 60 })).join(' | ');

  it('beginners start lighter, experienced people do more', () => {
    assert.ok(dose('beginner').includes('Bench press: 3 sets of 8'));
    assert.ok(dose('returning').includes('start light'));
    assert.ok(dose('some').includes('4 sets of 8'));
    assert.ok(dose('experienced').includes('4 sets of 6 to 10'));
  });

  it('a strength aim uses heavier, lower reps', () => {
    assert.ok(dose('experienced', 'strength').includes('5 sets of 3 to 5'));
    assert.ok(!dose('experienced', 'strength').includes('4 sets of 6 to 10'));
  });

  it('holds get longer with experience', () => {
    assert.ok(dose('beginner').includes('3 holds of 20 seconds'));
    assert.ok(dose('experienced').includes('3 holds of 60 seconds'));
  });
});

describe('the time for each session sizes the session', () => {
  const sessionLength = (minutes: number | null) => plan({ aim: 'muscle', where: 'gym', level: 'some' }, { days: [1, 2, 4, 5], minutes }).routines[0].tasks.length;

  it('more time means more exercises, up to what the session holds', () => {
    assert.ok(sessionLength(15) < sessionLength(30));
    assert.ok(sessionLength(30) < sessionLength(45));
    assert.ok(sessionLength(45) < sessionLength(60));
    assert.equal(movesForMinutes(15), 3);
    assert.equal(movesForMinutes(60), 6);
  });

  it('leaving the time out gives a normal 30-minute session', () => {
    assert.equal(sessionLength(null), sessionLength(30));
  });

  it('every session starts with a warm up and ends with a stretch, even a short one', () => {
    for (const minutes of [15, 30, 45, 60]) {
      for (const r of plan({ aim: 'muscle', where: 'home', level: 'beginner' }, { days: [1, 3, 5], minutes }).routines) {
        assert.ok(/^Warm up for \d minutes$/.test(r.tasks[0]), r.name);
        assert.ok(/stretch/i.test(r.tasks[r.tasks.length - 1]), r.name);
      }
    }
  });

  it('a 15-minute session says so and stays short', () => {
    const r = plan({ aim: 'muscle', where: 'gym', level: 'some' }, { days: [1, 3, 5], minutes: 15 }).routines[0];
    assert.equal(r.tasks[0], 'Warm up for 3 minutes');
    assert.equal(r.tasks.length, 5);
  });
});

describe('limits swap in gentler exercises', () => {
  const tasks = (where: string, limits: string[]) => allTasks(plan({ aim: 'muscle', where, level: 'some', limits }, { days: [1, 2, 3, 4, 5, 6], minutes: 60 })).join(' | ');

  it('sore knees: no lunges or deep squats at the gym, and no running', () => {
    const t = tasks('gym', ['knees']);
    assert.ok(!t.includes('Walking lunges') && !t.includes('Squats:'));
    assert.ok(t.includes('Leg press'));
    // A gentler swap never doubles up an exercise in the same session.
    for (const r of plan({ aim: 'muscle', where: 'home', level: 'some', limits: ['knees', 'back'] }, { days: [1, 2, 3, 4, 5, 6], minutes: 60 }).routines) {
      const base = r.tasks.map((x) => x.split(':')[0]);
      assert.equal(new Set(base).size, base.length, r.name);
    }
    const cardio = plan({ aim: 'stamina', where: 'outdoors', level: 'some', limits: ['knees'] }, { days: [1, 3] }).routines.map((r) => r.tasks.join(' ')).join(' ');
    assert.ok(!/Run |jog|Treadmill|skipping/i.test(cardio));
    assert.ok(/Cycling or a brisk walk/.test(cardio));
  });

  it('back trouble: no deadlifts', () => {
    const t = tasks('gym', ['back']);
    assert.ok(!t.includes('Romanian deadlift'));
    assert.ok(t.includes('Bird dog'));
  });

  it('shoulder trouble: no overhead pressing, at the gym or at home', () => {
    assert.ok(!tasks('gym', ['shoulders']).includes('Shoulder press'));
    assert.ok(!tasks('home', ['shoulders']).includes('Pike push-ups'));
  });

  it('easily out of breath: gentler intervals and shorter easy cardio', () => {
    const normal = plan({ aim: 'stamina', where: 'outdoors', level: 'some' }, { days: [1, 3], minutes: 30 });
    const gentle = plan({ aim: 'stamina', where: 'outdoors', level: 'some', limits: ['breath'] }, { days: [1, 3], minutes: 30 });
    assert.ok(normal.routines[1].tasks.join(' ').includes('30 seconds hard'));
    assert.ok(gentle.routines[1].tasks.join(' ').includes('20 seconds fast'));
    assert.ok(gentle.routines[0].tasks.join(' ').includes('25 minutes'));
  });

  it('a swapped exercise gets the right kind of dose: reps for reps, a hold for a hold', () => {
    for (const where of ['gym', 'home', 'homegear', 'outdoors']) {
      const t = allTasks(plan({ aim: 'muscle', where, level: 'some', limits: ['knees', 'back', 'shoulders'] }, { days: [1, 2, 3, 4, 5, 6], minutes: 60 }));
      assert.ok(t.every((x) => !(/holding/.test(x) && /holds of/.test(x))), where);
      assert.ok(t.every((x) => !(/Superman holds/.test(x) && /sets of/.test(x))), where);
    }
  });

  it('with nothing to work around, the normal exercises stay', () => {
    assert.ok(tasks('gym', []).includes('Walking lunges'));
  });
});

describe('the plan says when to train and when to rest', () => {
  it('names the training days and the rest days', () => {
    const d = plan({ aim: 'muscle' }, { days: [1, 3, 5] }).description;
    assert.ok(d.includes('Train on Mon · Wed · Fri.'), d);
    assert.ok(d.includes('Rest on Tue · Thu · Sat · Sun'), d);
  });

  it('reads naturally for weekdays and for every day', () => {
    assert.ok(plan({ aim: 'muscle' }, { days: [1, 2, 3, 4, 5] }).description.includes('Rest on weekends'));
    const all = plan({ aim: 'muscle' }, { days: [1, 2, 3, 4, 5, 6, 0] }).description;
    assert.ok(all.includes('Train every day.') && !all.includes('Rest on'));
  });

  it('mentions the session length only when one was given', () => {
    assert.ok(plan({ aim: 'muscle' }, { minutes: 45 }).description.includes('about 45 minutes'));
    assert.ok(!plan({ aim: 'muscle' }, { minutes: null }).description.includes('minutes'));
  });

  it('says where the plan is for', () => {
    assert.ok(plan({ aim: 'muscle', where: 'outdoors' }).description.includes('outdoors'));
    assert.ok(plan({ aim: 'muscle', where: 'homegear' }).description.includes('dumbbells or bands'));
  });

  it('a typed aim becomes the title', () => {
    assert.equal(plan({ aim: 'other', aim_other: 'Run a 10k' }).title, 'Run a 10k');
  });
});
