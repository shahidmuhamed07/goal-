import type { AnswerReader, CommonAnswers, RoutineDraft } from './guidedGoal';
import { describeDays } from './recurrence';

/**
 * The fitness framework behind "Help me plan".
 *
 * A plan is built from five things the person says: their aim, where they train,
 * how experienced they are, what to work around (sore knees, back, shoulders) and
 * how many days a week and how long each session. From those it picks:
 *
 *   1. a weekly structure that fits the number of days (full body, upper and
 *      lower, push pull legs, strength plus cardio, and so on);
 *   2. the exercises for each session, taken from a small library per place;
 *   3. as many exercises as the session time allows, always with a warm up and a stretch;
 *   4. the doses (sets, reps, holds) for the person's level;
 *   5. gentler swaps where a limit applies.
 *
 * It is plain data and pure functions, so every rule can be tested. It only ever
 * proposes a starting point: every routine and task stays editable.
 */

export type Place = 'gym' | 'home' | 'homegear' | 'outdoors';
export type Level = 'beginner' | 'returning' | 'some' | 'experienced';
export type Aim = 'muscle' | 'strength' | 'fat' | 'stamina' | 'mobility' | 'active';
export type Limit = 'knees' | 'back' | 'shoulders' | 'breath';

type Pattern = 'squat' | 'hinge' | 'lunge' | 'glute' | 'pushH' | 'pushV' | 'triceps' | 'pullH' | 'pullV' | 'biceps' | 'core' | 'finisher';

/** One exercise. `hold` moves are timed holds; the rest are counted in reps. `safer` replaces it when a limit applies. */
interface Move {
  name: string;
  hold?: boolean;
  avoid?: Limit;
  safer?: string;
  /** Whether the gentler swap is a timed hold. */
  saferHold?: boolean;
}

const PLACES: Place[] = ['gym', 'home', 'homegear', 'outdoors'];
const LEVELS: Level[] = ['beginner', 'returning', 'some', 'experienced'];
const AIMS: Aim[] = ['muscle', 'strength', 'fat', 'stamina', 'mobility', 'active'];

/** The exercise library: for each place, one good exercise per movement pattern. */
const LIBRARY: Record<Place, Record<Pattern, Move>> = {
  gym: {
    squat: { name: 'Squats', avoid: 'knees', safer: 'Leg press with a short, easy range' },
    hinge: { name: 'Romanian deadlift', avoid: 'back', safer: 'Bird dog' },
    lunge: { name: 'Walking lunges', avoid: 'knees', safer: 'Leg curls, light' },
    glute: { name: 'Hip thrusts' },
    pushH: { name: 'Bench press' },
    pushV: { name: 'Shoulder press', avoid: 'shoulders', safer: 'Light lateral raises' },
    triceps: { name: 'Triceps pushdowns' },
    pullH: { name: 'Seated rows' },
    pullV: { name: 'Lat pulldown', avoid: 'shoulders', safer: 'Straight-arm pulldowns, light' },
    biceps: { name: 'Biceps curls' },
    core: { name: 'Plank', hold: true },
    finisher: { name: 'Rower or bike: 5 minutes, steady' },
  },
  home: {
    squat: { name: 'Bodyweight squats', avoid: 'knees', safer: 'Sit-to-stand from a chair, slowly' },
    hinge: { name: 'Good mornings with a light bag', avoid: 'back', safer: 'Bird dog' },
    lunge: { name: 'Reverse lunges', avoid: 'knees', safer: 'Standing side leg raises' },
    glute: { name: 'Glute bridges' },
    pushH: { name: 'Push-ups (knees down if you need)' },
    pushV: { name: 'Pike push-ups', avoid: 'shoulders', safer: 'Wall push-ups' },
    triceps: { name: 'Chair dips' },
    pullH: { name: 'Table rows (lie under a sturdy table)' },
    pullV: { name: 'Towel pulls against a door frame', avoid: 'shoulders', safer: 'Superman holds', saferHold: true },
    biceps: { name: 'Biceps curls with a loaded bag' },
    core: { name: 'Dead bug' },
    finisher: { name: 'Mountain climbers: 3 rounds of 30 seconds' },
  },
  homegear: {
    squat: { name: 'Goblet squats', avoid: 'knees', safer: 'Box squats to a chair' },
    hinge: { name: 'Dumbbell Romanian deadlift', avoid: 'back', safer: 'Bird dog' },
    lunge: { name: 'Dumbbell split squats', avoid: 'knees', safer: 'Calf raises, holding a dumbbell' },
    glute: { name: 'Dumbbell hip thrusts' },
    pushH: { name: 'Dumbbell floor press' },
    pushV: { name: 'Dumbbell shoulder press', avoid: 'shoulders', safer: 'Light lateral raises' },
    triceps: { name: 'Overhead triceps extension' },
    pullH: { name: 'One-arm dumbbell rows' },
    pullV: { name: 'Band pull-downs', avoid: 'shoulders', safer: 'Band pull-aparts' },
    biceps: { name: 'Dumbbell curls' },
    core: { name: 'Plank', hold: true },
    finisher: { name: 'Dumbbell swings or jumping jacks: 3 rounds of 30 seconds' },
  },
  outdoors: {
    squat: { name: 'Squats', avoid: 'knees', safer: 'Sit-to-stand from a park bench, slowly' },
    hinge: { name: 'Single-leg reaches (no weight)', avoid: 'back', safer: 'Bird dog' },
    lunge: { name: 'Walking lunges', avoid: 'knees', safer: 'Standing side leg raises' },
    glute: { name: 'Glute bridges' },
    pushH: { name: 'Push-ups (hands on a bench if you need)' },
    pushV: { name: 'Pike push-ups', avoid: 'shoulders', safer: 'Incline push-ups on a bench' },
    triceps: { name: 'Bench dips' },
    pullH: { name: 'Inverted rows on a low bar' },
    pullV: { name: 'Pull-ups or bar hangs', avoid: 'shoulders', safer: 'Assisted hangs with your feet on the ground' },
    biceps: { name: 'Chin-up holds' },
    core: { name: 'Plank', hold: true },
    finisher: { name: 'Hill or stair sprints: 6 rounds' },
  },
};

/** Which movements each kind of session is made of, most important first. */
const SESSIONS: Record<string, Pattern[]> = {
  'Full body': ['squat', 'pushH', 'pullH', 'hinge', 'pushV', 'core'],
  'Full body A': ['squat', 'pushH', 'pullH', 'core', 'finisher'],
  'Full body B': ['hinge', 'pushV', 'pullV', 'glute', 'core', 'finisher'],
  'Full body C': ['lunge', 'pushH', 'pullH', 'glute', 'core', 'finisher'],
  Push: ['pushH', 'pushV', 'triceps', 'core', 'finisher'],
  Pull: ['pullH', 'pullV', 'biceps', 'core', 'finisher'],
  Legs: ['squat', 'hinge', 'lunge', 'glute', 'core', 'finisher'],
  Upper: ['pushH', 'pullH', 'pushV', 'pullV', 'triceps', 'biceps'],
  Lower: ['squat', 'hinge', 'lunge', 'glute', 'core', 'finisher'],
  Circuit: ['squat', 'pushH', 'pullH', 'lunge', 'core', 'finisher'],
  'Strength support': ['squat', 'pushH', 'pullH', 'hinge', 'core'],
};

/** How many exercises fit in a session of this length (the warm up and stretch are extra). */
export const movesForMinutes = (minutes: number): number => (minutes <= 15 ? 3 : minutes <= 30 ? 4 : minutes <= 45 ? 5 : 6);

const roundsForMinutes = (minutes: number): number => (minutes <= 15 ? 4 : minutes <= 30 ? 6 : minutes <= 45 ? 8 : 10);

const asAim = (v: string | undefined): Aim | undefined => (AIMS as string[]).includes(v ?? '') ? (v as Aim) : undefined;
const asPlace = (v: string | undefined): Place => ((PLACES as string[]).includes(v ?? '') ? (v as Place) : 'gym');
const asLevel = (v: string | undefined): Level => ((LEVELS as string[]).includes(v ?? '') ? (v as Level) : 'beginner');

/** The dose for a move at this level and aim, e.g. "3 sets of 8" or "3 holds of 20 seconds". */
export const doseFor = (hold: boolean | undefined, level: Level, aim: Aim | undefined): string => {
  if (hold) return level === 'beginner' || level === 'returning' ? '3 holds of 20 seconds' : level === 'some' ? '3 holds of 40 seconds' : '3 holds of 60 seconds';
  if (aim === 'strength') return level === 'beginner' ? '3 sets of 6' : level === 'returning' ? '2 sets of 8, start light' : level === 'some' ? '4 sets of 5' : '5 sets of 3 to 5';
  if (aim === 'fat' || aim === 'active') return level === 'beginner' ? '3 sets of 10' : level === 'returning' ? '2 sets of 12, start light' : '3 sets of 12';
  return level === 'beginner' ? '3 sets of 8' : level === 'returning' ? '2 sets of 10, start light' : level === 'some' ? '4 sets of 8' : '4 sets of 6 to 10';
};

/** One exercise as a task, with a gentler swap when a limit applies to it. */
const exercise = (move: Move, level: Level, aim: Aim | undefined, limits: Limit[]): string => {
  const swapped = !!move.avoid && limits.includes(move.avoid) && !!move.safer;
  const name = swapped ? (move.safer as string) : move.name;
  // A name that already carries its own amount ("5 minutes", "6 rounds") is left as it is.
  if (/\d/.test(name)) return name;
  const hold = swapped ? move.saferHold : move.hold;
  return `${name}: ${doseFor(hold, level, aim)}`;
};

const cardioPlace = (place: Place, limits: Limit[]): string => {
  if (limits.includes('knees')) return place === 'gym' ? 'Bike or rower' : 'Cycling or a brisk walk';
  return place === 'gym' ? 'Treadmill, bike or rower' : place === 'outdoors' ? 'Run or brisk walk' : 'Brisk walk, skipping or marching on the spot';
};

/** A strength-style session: warm up, as many exercises as the time allows, then a stretch. */
const strengthSession = (kind: string, name: string, place: Place, level: Level, aim: Aim | undefined, limits: Limit[], minutes: number): RoutineDraft => {
  const patterns = SESSIONS[kind];
  const count = Math.min(movesForMinutes(minutes), patterns.length);
  const moves = patterns.slice(0, count).map((p) => exercise(LIBRARY[place][p], level, aim, limits));
  // A gentler swap can land on an exercise the session already has: keep it once.
  const nameOf = (m: string) => m.split(':')[0];
  const unique = moves.filter((m, i) => moves.findIndex((x) => nameOf(x) === nameOf(m)) === i);
  const warm = minutes <= 15 ? 'Warm up for 3 minutes' : 'Warm up for 5 minutes';
  const circuit = kind === 'Circuit' ? ['Go round all the exercises, rest 30 seconds, then repeat 3 times'] : [];
  return { name, tasks: [warm, ...circuit, ...unique, minutes <= 15 ? 'Stretch for 2 minutes' : 'Cool down and stretch'] };
};

const easyCardio = (place: Place, level: Level, limits: Limit[], minutes: number, name = 'Easy cardio'): RoutineDraft => {
  const gentle = level === 'beginner' || level === 'returning' || limits.includes('breath');
  const length = gentle ? Math.max(15, minutes - 5) : Math.max(20, minutes);
  return {
    name,
    tasks: ['Easy 5-minute warm up', `${cardioPlace(place, limits)}: ${length} minutes at an easy pace`, 'Finish with a slow 3 minutes', 'Stretch your legs', 'Drink water'],
  };
};

const intervals = (place: Place, level: Level, limits: Limit[], minutes: number): RoutineDraft => {
  const rounds = roundsForMinutes(minutes);
  const easier = level === 'beginner' || level === 'returning' || limits.includes('breath');
  return {
    name: 'Intervals',
    tasks: [
      'Warm up for 5 minutes',
      `${cardioPlace(place, limits)}: ${easier ? '20 seconds fast, then 100 seconds easy' : '30 seconds hard, then 90 seconds easy'}, repeat ${rounds} times`,
      'Cool down for 5 minutes',
      'Stretch your legs',
    ],
  };
};

const mobility = (name: string, tasks: string[]): RoutineDraft => ({ name, tasks });

const MOBILITY_LEGS = mobility('Mobility: hips and legs', ['Hip flexor stretch: 2 minutes each side', 'Hamstring stretch: 2 minutes each side', 'Deep squat hold: 3 times, 30 seconds', 'Calf and ankle circles', 'Foam roll or self-massage']);
const MOBILITY_UPPER = mobility('Mobility: back and shoulders', ['Cat and cow: 10 slow rounds', 'Thread the needle: 5 each side', 'Shoulder and chest opener against a wall', 'Neck and upper back release', 'Gentle spine twists']);
const CORE_POSTURE = mobility('Core and posture', ['Dead bug: 3 sets of 8 each side', 'Bird dog: 3 sets of 8 each side', 'Side plank: 3 holds each side', 'Wall angels: 2 sets of 10', 'Walk tall for 10 minutes']);
const RECOVERY = mobility('Active recovery', ['Easy walk for 20 minutes', 'Full-body stretch for 10 minutes', 'Drink plenty of water', 'Go to bed at your usual time']);
const FUN_MOVEMENT = mobility('Fun movement', ['Dance, swim, cycle or play a sport for 30 minutes', 'Keep it easy enough to chat', 'Stretch afterwards', 'Drink water']);

/** The names of the sessions in a week for this aim and number of training days, most important first. */
type Slot = { kind: 'strength'; session: string; name: string } | { kind: 'other'; make: () => RoutineDraft };

/** The choices that decide which exercises the AI may use: where, how experienced, and what to work around. */
export const fitnessInputs = (r: AnswerReader): { place: Place; level: Level; limits: Limit[] } => ({
  place: asPlace(r.one('where')),
  level: asLevel(r.one('level')),
  limits: r.many('limits').filter((l): l is Limit => l === 'knees' || l === 'back' || l === 'shoulders' || l === 'breath'),
});

/**
 * Builds a fitness plan from the answers and the common answers (days and time).
 * Every routine gets the weekdays the engine spreads over the chosen days.
 */
export const buildFitnessPlan = (r: AnswerReader, common: CommonAnswers): { title: string; description: string; routines: RoutineDraft[]; sized: true } => {
  const aim = asAim(r.one('aim'));
  const place = asPlace(r.one('where'));
  const level = asLevel(r.one('level'));
  const limits = r.many('limits').filter((l): l is Limit => l === 'knees' || l === 'back' || l === 'shoulders' || l === 'breath');
  const days = common.days.length > 0 ? common.days : [1, 3, 5];
  const n = days.length;
  const minutes = common.minutes ?? 30;

  const strong = (session: string, name = session === 'Push' || session === 'Pull' || session === 'Legs' || session === 'Upper' || session === 'Lower' ? `Strength: ${session.toLowerCase()}` : session): Slot => ({ kind: 'strength', session, name });
  const other = (make: () => RoutineDraft): Slot => ({ kind: 'other', make });
  const cardio = other(() => easyCardio(place, level, limits, minutes));
  const hiit = other(() => intervals(place, level, limits, minutes));
  const steady = other(() => easyCardio(place, level, limits, minutes + 15, 'Long steady cardio'));

  let week: Slot[];
  if (aim === 'muscle' || aim === 'strength' || aim === undefined) {
    const beginner = level === 'beginner' || level === 'returning';
    week =
      n <= 1 ? [strong('Full body')]
      : n === 2 ? [strong('Full body A'), strong('Full body B')]
      : n === 3 ? (beginner ? [strong('Full body A'), strong('Full body B'), strong('Full body C')] : [strong('Push'), strong('Pull'), strong('Legs')])
      : n === 4 ? [strong('Upper'), strong('Lower')]
      : n === 5 ? [strong('Push'), strong('Pull'), strong('Legs'), strong('Upper'), strong('Lower')]
      : n === 6 ? [strong('Push'), strong('Pull'), strong('Legs')]
      : [strong('Push'), strong('Pull'), strong('Legs'), other(() => RECOVERY)];
  } else if (aim === 'fat') {
    week =
      n <= 1 ? [strong('Circuit', 'Full-body circuit')]
      : n === 2 ? [strong('Circuit', 'Full-body circuit'), hiit]
      : n === 3 ? [strong('Full body A', 'Strength: full body'), hiit, strong('Circuit', 'Full-body circuit')]
      : n === 4 ? [strong('Upper', 'Strength: upper body'), hiit, strong('Lower', 'Strength: lower body'), cardio]
      : n === 5 ? [strong('Full body A', 'Strength: full body A'), hiit, strong('Full body B', 'Strength: full body B'), cardio, strong('Circuit', 'Full-body circuit')]
      : [strong('Upper', 'Strength: upper body'), hiit, strong('Lower', 'Strength: lower body'), cardio, strong('Circuit', 'Full-body circuit'), other(() => RECOVERY)];
  } else if (aim === 'stamina') {
    const support = strong('Strength support');
    week =
      n <= 1 ? [cardio]
      : n === 2 ? [cardio, hiit]
      : n === 3 ? [cardio, hiit, support]
      : n === 4 ? [cardio, hiit, support, steady]
      : n === 5 ? [cardio, hiit, support, steady, other(() => MOBILITY_LEGS)]
      : [cardio, hiit, support, steady, other(() => MOBILITY_LEGS), other(() => RECOVERY)];
  } else if (aim === 'mobility') {
    week =
      n <= 1 ? [other(() => MOBILITY_LEGS)]
      : n === 2 ? [other(() => MOBILITY_LEGS), other(() => MOBILITY_UPPER)]
      : n === 3 ? [other(() => MOBILITY_LEGS), other(() => MOBILITY_UPPER), other(() => CORE_POSTURE)]
      : [other(() => MOBILITY_LEGS), other(() => MOBILITY_UPPER), other(() => CORE_POSTURE), other(() => RECOVERY)];
  } else {
    // Stay active and healthy: a bit of everything, kept easy.
    week =
      n <= 1 ? [strong('Full body', 'Full-body strength')]
      : n === 2 ? [cardio, strong('Full body', 'Full-body strength')]
      : n === 3 ? [cardio, strong('Full body', 'Full-body strength'), other(() => MOBILITY_LEGS)]
      : [cardio, strong('Full body', 'Full-body strength'), other(() => MOBILITY_LEGS), other(() => FUN_MOVEMENT)];
  }

  const routines = week.map((slot) =>
    slot.kind === 'strength' ? strengthSession(slot.session, slot.name, place, level, aim, limits, minutes) : slot.make(),
  );

  const titles: Record<Aim, string> = {
    muscle: 'Build strength and muscle',
    strength: 'Get stronger',
    fat: 'Lose fat and feel strong',
    stamina: 'Get fitter and faster',
    mobility: 'Move better and loosen up',
    active: 'Stay active and healthy',
  };
  const placeText: Record<Place, string> = { gym: 'at the gym', home: 'at home with no equipment', homegear: 'at home with dumbbells or bands', outdoors: 'outdoors' };
  /** "Mon · Wed · Fri" reads fine after "on"; the named groups need a small touch. */
  const onDays = (list: number[]): string => {
    const text = describeDays(list);
    return text === 'Every day' ? 'every day' : text === 'Weekdays' ? 'weekdays' : text === 'Weekends' ? 'weekends' : text;
  };
  const trainText = days.length === 7 ? 'Train every day.' : `Train on ${onDays(days)}.`;
  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
  const rest = restDays.length > 0 ? ` Rest on ${onDays(restDays)}: an easy walk, a stretch and good sleep.` : ' Take the recovery session easy.';
  const time = common.minutes ? ` Sessions are about ${common.minutes} minutes.` : '';

  const aimTitle = aim ? titles[aim] : 'Get stronger and fitter';
  const typed = r.one('aim') === 'other' ? r.other('aim', 70) : '';
  return {
    title: typed || aimTitle,
    description: `${n} training ${n === 1 ? 'day' : 'days'} a week, ${placeText[place]}. ${trainText}${rest}${time} Swap exercises freely.`.slice(0, 600),
    routines,
    sized: true,
  };
};
