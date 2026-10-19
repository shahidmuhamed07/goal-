import type { Level, Limit, Place } from './fitnessPlan';

/**
 * The exercises the AI may choose from, each with a few short lines on how to do it.
 *
 * The AI never invents an exercise: it is given the names that fit this person (their
 * place, level and limits) and picks and orders them, week by week. The "how" lines
 * are written here, once, so they are consistent and safe, and they show even when the
 * AI is off. To add an exercise, add one line to `LIST`.
 */

interface Exercise {
  name: string;
  places: Place[];
  /** Left out for anyone who named one of these limits. */
  avoid?: Limit[];
  /** Left out for beginners and people returning to training. */
  advanced?: boolean;
  steps: string[];
}

const ALL: Place[] = ['gym', 'home', 'homegear', 'outdoors'];
const GEAR: Place[] = ['gym', 'homegear'];

const ex = (name: string, places: Place[], steps: string[], extra: { avoid?: Limit[]; advanced?: boolean } = {}): Exercise => ({ name, places, steps, ...extra });

const LIST: Exercise[] = [
  // Push
  ex('Machine chest press', ['gym'], ['Seat so the handles sit at mid chest', 'Press forward until your arms are straight, not locked', 'Return slowly, count 2 seconds'], { avoid: ['shoulders'] }),
  ex('Dumbbell bench press', ['gym'], ['Lie flat, a dumbbell in each hand over your chest', 'Lower until your elbows are just below the bench', 'Press up smoothly, no bounce'], { avoid: ['shoulders'] }),
  ex('Bench press', ['gym'], ['Lie flat, feet on the floor, shoulder blades pinched', 'Lower the bar to mid chest in 2 seconds', 'Press up smoothly. No spotter? Use dumbbells'], { avoid: ['shoulders'] }),
  ex('Incline dumbbell press', ['gym'], ['Bench at a low slope, a dumbbell in each hand', 'Press up until your arms are straight, not locked', 'Lower slowly until your elbows are just below the bench'], { avoid: ['shoulders'] }),
  ex('Machine shoulder press', ['gym'], ['Back against the pad, handles at shoulder height', 'Press up without arching your back', 'Lower slowly to shoulder height'], { avoid: ['shoulders'] }),
  ex('Dumbbell shoulder press', GEAR, ['Sit tall, dumbbells at shoulder height', 'Press straight up without arching your back', 'Lower slowly to your shoulders'], { avoid: ['shoulders'] }),
  ex('Overhead press', ['gym'], ['Bar at your collarbone, feet hip-width', 'Press straight up, your head moves through at the top', 'Squeeze your glutes so your back stays still'], { avoid: ['shoulders', 'back'], advanced: true }),
  ex('Lateral raise', GEAR, ['Light dumbbells at your sides, a small bend in your elbows', 'Lift out to shoulder height, no higher', 'Lower slowly. Use less weight than you think']),
  ex('Triceps pushdown', ['gym'], ['Elbows tucked at your sides', 'Push the handle down until your arms are straight', 'Let it rise slowly, elbows stay still']),
  ex('Dumbbell floor press', ['homegear'], ['Lie on the floor, knees bent, a dumbbell in each hand', 'Press up until your arms are straight', 'Lower until your elbows touch the floor, then press again']),
  ex('Overhead triceps extension', ['homegear'], ['Hold one dumbbell with both hands behind your head', 'Straighten your arms up, elbows pointing forward', 'Lower slowly. Keep your ribs down'], { avoid: ['shoulders'] }),
  ex('Push-ups', ['home', 'outdoors'], ['Hands under your shoulders, body in a straight line', 'Lower your chest to the floor, elbows at about 45 degrees', 'Push up. Too hard? Put your knees down or your hands on a bench'], { avoid: ['shoulders'] }),
  ex('Pike push-ups', ['home', 'outdoors'], ['Hips high, hands and feet on the floor like an upside-down V', 'Bend your elbows until your head nears the floor', 'Push back up'], { avoid: ['shoulders'], advanced: true }),
  ex('Chair dips', ['home'], ['Hands on the edge of a sturdy chair, legs out in front', 'Bend your elbows to lower, keep your back close to the chair', 'Press up until your arms are straight'], { avoid: ['shoulders'] }),
  ex('Bench dips', ['outdoors'], ['Hands on a park bench behind you, legs out in front', 'Bend your elbows to lower, keep your back close to the bench', 'Press up until your arms are straight'], { avoid: ['shoulders'] }),
  // Pull
  ex('Seated row', ['gym'], ['Sit tall with your chest up', 'Pull the handles to your ribs, squeeze for 1 second', 'Return slowly, do not lean back']),
  ex('Cable row', ['gym'], ['Sit tall, knees soft, chest up', 'Pull the handle to your belly, elbows close', 'Pause 1 second, then return slowly']),
  ex('Lat pulldown', ['gym'], ['Grip a little wider than your shoulders', 'Pull the bar to your upper chest, elbows down', 'Let it rise slowly until your arms are straight'], { avoid: ['shoulders'] }),
  ex('Barbell row', ['gym'], ['Hinge forward with a flat back, bar below your knees', 'Pull the bar to your lower ribs', 'Lower slowly, do not swing your body'], { avoid: ['back'], advanced: true }),
  ex('One-arm dumbbell row', ['homegear', 'gym'], ['One hand and knee on a bench or sofa, back flat', 'Pull the dumbbell to your hip', 'Lower slowly and keep your shoulders level']),
  ex('Table rows', ['home'], ['Lie under a sturdy table and hold the edge', 'Keep your body straight and pull your chest up to the table', 'Lower slowly']),
  ex('Inverted rows on a low bar', ['outdoors'], ['Hang under a low bar, body straight, heels on the ground', 'Pull your chest up to the bar', 'Lower slowly']),
  ex('Pull-ups or bar hangs', ['outdoors'], ['Hang from a bar, hands a little wider than your shoulders', 'Pull up as far as you can, or simply hang and breathe', 'Lower slowly. Keep your shoulders pulled down'], { avoid: ['shoulders'], advanced: true }),
  ex('Band pull-aparts', ['homegear'], ['Hold a light band in front of you at chest height', 'Pull it apart until your arms are out to the sides', 'Return slowly']),
  ex('Superman holds', ['home'], ['Lie face down, arms out in front', 'Lift your arms and legs a few centimetres', 'Hold, breathe, and lower slowly'], { avoid: ['back'] }),
  ex('Biceps curl', GEAR, ['Elbows pinned to your sides', 'Curl up until your hands reach your shoulders', 'Lower for 2 seconds, no swinging']),
  // Legs and hips
  ex('Leg press', ['gym'], ['Feet shoulder-width, middle of the platform', 'Lower until your knees are bent about 90 degrees', 'Push through your heels, do not lock your knees']),
  ex('Goblet squat', GEAR, ['Hold one dumbbell at your chest', 'Sit down between your knees, chest up', 'Stand up by pushing the floor away'], { avoid: ['knees'] }),
  ex('Back squat', ['gym'], ['Bar across your upper back, feet shoulder-width', 'Sit down and back until your thighs are parallel', 'Stand up by pushing the floor away. Start light'], { avoid: ['knees', 'back'], advanced: true }),
  ex('Bodyweight squats', ['home', 'outdoors'], ['Feet shoulder-width, chest up', 'Sit back and down until your thighs are about parallel', 'Stand up by pushing the floor away'], { avoid: ['knees'] }),
  ex('Romanian deadlift', ['gym'], ['Hold the weight close, knees slightly bent', 'Push your hips back until the back of your legs stretches', 'Keep your back flat, stand up by squeezing your glutes'], { avoid: ['back'] }),
  ex('Dumbbell Romanian deadlift', ['homegear'], ['Hold a dumbbell in each hand, knees slightly bent', 'Push your hips back until the back of your legs stretches', 'Keep your back flat, stand up by squeezing your glutes'], { avoid: ['back'] }),
  ex('Deadlift', ['gym'], ['Bar over mid-foot, back flat, chest up', 'Push the floor away and stand tall', 'Lower the bar back along your legs. Start light'], { avoid: ['back'], advanced: true }),
  ex('Hip thrust', ['gym', 'homegear'], ['Upper back on a bench, feet flat, knees bent', 'Drive your hips up until your body is straight', 'Squeeze your glutes for 1 second at the top']),
  ex('Glute bridges', ['home', 'outdoors', 'homegear'], ['Lie on your back, knees bent, feet flat', 'Lift your hips until your body is straight', 'Squeeze your glutes for 1 second, lower slowly']),
  ex('Leg curl', ['gym'], ['Pad just above your heels', 'Curl your heels toward you, squeeze for 1 second', 'Lower slowly for 2 seconds']),
  ex('Walking lunges', ['gym', 'outdoors'], ['Take a long step forward, chest up', 'Lower until both knees are bent about 90 degrees', 'Push off the front foot into the next step'], { avoid: ['knees'] }),
  ex('Reverse lunges', ['home', 'homegear'], ['Step one foot back, chest up', 'Lower until both knees are bent about 90 degrees', 'Push through the front foot to stand'], { avoid: ['knees'] }),
  ex('Dumbbell split squats', ['homegear'], ['One foot forward, one back, a dumbbell in each hand', 'Lower straight down until your front thigh is parallel', 'Push up through the front heel'], { avoid: ['knees'] }),
  ex('Step-ups', ['home', 'outdoors', 'homegear'], ['Place a whole foot on a sturdy step or bench', 'Stand up by pushing through that foot, do not push off the back foot', 'Lower slowly'], { avoid: ['knees'] }),
  ex('Wall sit', ['home', 'outdoors'], ['Back flat against a wall, knees bent about 90 degrees', 'Keep your weight in your heels', 'Hold, breathing slowly'], { avoid: ['knees'] }),
  ex('Calf raise', ALL, ['Balls of your feet on a step, hold a rail', 'Rise as high as you can, pause 1 second', 'Lower slowly below the step']),
  // Core and carries
  ex('Plank', ALL, ['Forearms down, elbows under your shoulders', 'Keep your body in one straight line', 'Squeeze belly and glutes. Too hard? Knees down']),
  ex('Side plank', ALL, ['Lie on your side, elbow under your shoulder', 'Lift your hips until your body is straight', 'Hold, then switch sides. Too hard? Knees down'], { avoid: ['shoulders'] }),
  ex('Dead bug', ALL, ['Lie on your back, arms up, knees over hips', 'Lower the opposite arm and leg slowly', 'Keep your lower back pressed into the floor']),
  ex('Bird dog', ALL, ['On hands and knees, back flat', 'Reach one arm and the opposite leg out long', 'Hold 2 seconds, return, switch sides']),
  ex('Hanging knee raise', ['gym', 'outdoors'], ['Hang from a bar, shoulders pulled down', 'Lift your knees toward your chest slowly', 'Lower without swinging'], { avoid: ['shoulders'] }),
  ex('Mountain climbers', ['home', 'outdoors'], ['Start in a high plank, hands under your shoulders', 'Drive one knee toward your chest, then switch quickly', 'Keep your hips low and breathe'], { avoid: ['breath', 'shoulders'] }),
  ex("Farmer's walk", ['gym', 'homegear', 'outdoors'], ['Hold something heavy in each hand', 'Stand tall, shoulders back, walk with small steps', 'Do not let the weights swing']),
  // Cardio
  ex('Steady bike or rower', ['gym'], ['Easy start for 3 minutes', 'Hold a pace where you could talk in short sentences', 'Finish with 3 slow minutes']),
  ex('Brisk walk', ['home', 'homegear', 'outdoors', 'gym'], ['Walk fast enough that your breathing picks up', 'Swing your arms and keep your head up', 'Slow down for the last 3 minutes']),
  ex('Hill or stair sprints', ['outdoors'], ['Warm up with an easy walk first', 'Run hard up the hill or stairs, walk down slowly', 'Rest fully before the next one'], { avoid: ['knees', 'breath'], advanced: true }),
];

/** Short names of exercises a person might be handed that are not in a menu (never the case for the AI's picks). */
const BY_NAME = new Map(LIST.map((e) => [e.name.toLowerCase(), e]));

/** The warm up and cool down every session gets. They are written here, not by the AI. */
export const WARM_UP = {
  text: 'Warm up: 5 minutes',
  steps: ['Easy march on the spot: 1 minute', 'Arm circles: 10 forward, 10 back', 'Leg swings: 10 each leg, hold a wall', 'Bodyweight squats: 8 slow reps'],
};
export const COOL_DOWN = {
  text: 'Cool down and stretch: 5 minutes',
  steps: ['Chest stretch in a doorway: 30 seconds', 'Quad stretch: 30 seconds each leg', 'Hamstring reach: 30 seconds', 'Five slow, deep breaths'],
};

/** The exercise names that suit this place, level and limits. This is exactly what the AI may choose from. */
export const menuFor = (place: Place, level: Level, limits: Limit[]): string[] => {
  const gentle = level === 'beginner' || level === 'returning';
  return LIST.filter(
    (e) => e.places.includes(place) && !(gentle && e.advanced) && !(e.avoid ?? []).some((l) => limits.includes(l)),
  ).map((e) => e.name);
};

/** The "how" lines for an exercise, or undefined when it is not on the menu. */
export const stepsFor = (name: string): string[] | undefined => BY_NAME.get(name.toLowerCase())?.steps;

export const ALL_EXERCISES = LIST.map((e) => e.name);
