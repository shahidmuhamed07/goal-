import type { Level, Limit, Place } from './fitnessPlan';

/**
 * The exercises the AI may choose from, each with a short "works" line and a few lines on how to do it.
 *
 * The AI never invents an exercise: it is given the names that fit this person (their place, level,
 * limits and, in a gym, the kind of equipment they like) and picks and orders them, week by week.
 * The words are written here, once, so they are consistent and safe, and they show even when the AI
 * is off. Nothing here asks for a heavy weight: lifts say to use a weight that feels comfortable.
 * To add an exercise, add one line to `LIST`.
 */

/** What an exercise needs: a machine or cable, free weights (dumbbells, barbell, bands), or just the body. */
export type Kit = 'machine' | 'free' | 'body';
/** The gym equipment a person likes: machines, free weights, or both. */
export type GymKit = 'machines' | 'free' | 'both';

interface Exercise {
  name: string;
  places: Place[];
  kit: Kit;
  /** The muscles it works, in a few words. */
  muscles: string;
  /** Left out for anyone who named one of these limits. */
  avoid?: Limit[];
  /** Left out for beginners and people returning to training. */
  advanced?: boolean;
  steps: string[];
}

const ALL: Place[] = ['gym', 'home', 'homegear', 'outdoors'];
const GEAR: Place[] = ['gym', 'homegear'];
const NO_GYM: Place[] = ['home', 'homegear', 'outdoors'];

const ex = (name: string, places: Place[], kit: Kit, muscles: string, steps: string[], extra: { avoid?: Limit[]; advanced?: boolean } = {}): Exercise => ({
  name,
  places,
  kit,
  muscles,
  steps,
  ...extra,
});

const COMFORT = 'Pick a weight that feels comfortable';

const LIST: Exercise[] = [
  // ---- Push
  ex('Machine chest press', ['gym'], 'machine', 'Chest, front shoulders, triceps', ['Seat so the handles sit at mid chest', 'Press forward until your arms are straight, not locked', 'Return slowly, count 2 seconds'], { avoid: ['shoulders'] }),
  ex('Pec deck', ['gym'], 'machine', 'Chest', ['Sit tall, forearms on the pads', 'Bring the pads together in front of you slowly', 'Open back only as far as feels comfortable'], { avoid: ['shoulders'] }),
  ex('Dumbbell bench press', ['gym'], 'free', 'Chest, front shoulders, triceps', ['Lie flat, a dumbbell in each hand over your chest', 'Lower until your elbows are just below the bench', `Press up smoothly. ${COMFORT}`], { avoid: ['shoulders'] }),
  ex('Bench press', ['gym'], 'free', 'Chest, front shoulders, triceps', ['Lie flat, feet on the floor, shoulder blades pinched', 'Lower the bar to mid chest in 2 seconds', 'Press up smoothly. No spotter? Use dumbbells'], { avoid: ['shoulders'], advanced: true }),
  ex('Incline dumbbell press', ['gym'], 'free', 'Upper chest, shoulders, triceps', ['Bench at a low slope, a dumbbell in each hand', 'Press up until your arms are straight, not locked', 'Lower slowly. Use a weight you control'], { avoid: ['shoulders'] }),
  ex('Machine shoulder press', ['gym'], 'machine', 'Shoulders, triceps', ['Back against the pad, handles at shoulder height', 'Press up without arching your back', 'Lower slowly to shoulder height'], { avoid: ['shoulders'] }),
  ex('Dumbbell shoulder press', GEAR, 'free', 'Shoulders, triceps', ['Sit tall, dumbbells at shoulder height', 'Press straight up without arching your back', 'Lower slowly. Keep the weight light enough to control'], { avoid: ['shoulders'] }),
  ex('Overhead press', ['gym'], 'free', 'Shoulders, triceps, core', ['Bar at your collarbone, feet hip-width', 'Press straight up, your head moves through at the top', 'Squeeze your glutes so your back stays still'], { avoid: ['shoulders', 'back'], advanced: true }),
  ex('Lateral raise', GEAR, 'free', 'Side shoulders', ['Light dumbbells at your sides, a small bend in your elbows', 'Lift out to shoulder height, no higher', 'Lower slowly. Use less weight than you think']),
  ex('Triceps pushdown', ['gym'], 'machine', 'Back of the arms', ['Elbows tucked at your sides', 'Push the handle down until your arms are straight', 'Let it rise slowly, elbows stay still']),
  ex('Dumbbell floor press', ['homegear'], 'free', 'Chest, triceps', ['Lie on the floor, knees bent, a dumbbell in each hand', 'Press up until your arms are straight', 'Lower until your elbows touch the floor, then press again']),
  ex('Overhead triceps extension', GEAR, 'free', 'Back of the arms', ['Hold one dumbbell with both hands behind your head', 'Straighten your arms up, elbows pointing forward', 'Lower slowly. Keep your ribs down'], { avoid: ['shoulders'] }),
  ex('Push-ups', ['home', 'homegear', 'outdoors', 'gym'], 'body', 'Chest, shoulders, triceps, core', ['Hands under your shoulders, body in a straight line', 'Lower your chest toward the floor, elbows at about 45 degrees', 'Push up. Too hard? Knees down, or hands on a bench'], { avoid: ['shoulders'] }),
  ex('Incline push-ups', NO_GYM, 'body', 'Chest, shoulders, triceps', ['Hands on a sturdy table, bench or step', 'Keep your body in one straight line', 'Lower your chest to the edge and press away']),
  ex('Pike push-ups', NO_GYM, 'body', 'Shoulders, triceps', ['Hips high, hands and feet on the floor like an upside-down V', 'Bend your elbows until your head nears the floor', 'Push back up'], { avoid: ['shoulders'], advanced: true }),
  ex('Chair dips', ['home', 'homegear'], 'body', 'Back of the arms, chest', ['Hands on the edge of a sturdy chair, legs out in front', 'Bend your elbows to lower, keep your back close to the chair', 'Press up until your arms are straight'], { avoid: ['shoulders'] }),
  ex('Bench dips', ['outdoors'], 'body', 'Back of the arms, chest', ['Hands on a park bench behind you, legs out in front', 'Bend your elbows to lower, keep your back close to the bench', 'Press up until your arms are straight'], { avoid: ['shoulders'] }),
  // ---- Pull
  ex('Seated row', ['gym'], 'machine', 'Mid back, rear shoulders, biceps', ['Sit tall with your chest up', 'Pull the handles to your ribs, squeeze for 1 second', 'Return slowly, do not lean back']),
  ex('Cable row', ['gym'], 'machine', 'Mid back, biceps', ['Sit tall, knees soft, chest up', 'Pull the handle to your belly, elbows close', 'Pause 1 second, then return slowly']),
  ex('Lat pulldown', ['gym'], 'machine', 'Wide back muscles, biceps', ['Grip a little wider than your shoulders', 'Pull the bar to your upper chest, elbows down', 'Let it rise slowly until your arms are straight'], { avoid: ['shoulders'] }),
  ex('Assisted pull-ups', ['gym'], 'machine', 'Back, biceps', ['Kneel on the pad, grip the bars a little wider than your shoulders', 'Pull your chest up toward the bar', 'Lower slowly. More assistance makes it easier'], { avoid: ['shoulders'] }),
  ex('Face pull', ['gym'], 'machine', 'Rear shoulders, upper back', ['Rope at face height, step back until it is tight', 'Pull toward your face, elbows high and wide', 'Return slowly. Keep the weight light']),
  ex('Barbell row', ['gym'], 'free', 'Back, biceps', ['Hinge forward with a flat back, bar below your knees', 'Pull the bar to your lower ribs', 'Lower slowly, do not swing your body'], { avoid: ['back'], advanced: true }),
  ex('One-arm dumbbell row', GEAR, 'free', 'Back, biceps', ['One hand and knee on a bench or sofa, back flat', 'Pull the dumbbell to your hip', 'Lower slowly and keep your shoulders level']),
  ex('Table rows', ['home'], 'body', 'Back, biceps', ['Lie under a sturdy table and hold the edge', 'Keep your body straight and pull your chest up to the table', 'Lower slowly']),
  ex('Inverted rows on a low bar', ['outdoors'], 'body', 'Back, biceps', ['Hang under a low bar, body straight, heels on the ground', 'Pull your chest up to the bar', 'Lower slowly']),
  ex('Pull-ups or bar hangs', ['outdoors'], 'body', 'Back, biceps, grip', ['Hang from a bar, hands a little wider than your shoulders', 'Pull up as far as you can, or simply hang and breathe', 'Lower slowly. Keep your shoulders pulled down'], { avoid: ['shoulders'], advanced: true }),
  ex('Band pull-aparts', ['homegear'], 'free', 'Rear shoulders, upper back', ['Hold a light band in front of you at chest height', 'Pull it apart until your arms are out to the sides', 'Return slowly']),
  ex('Band rows', ['homegear'], 'free', 'Back, biceps', ['Loop a band around a sturdy post, sit or stand tall', 'Pull your hands to your ribs, squeeze your back', 'Return slowly']),
  ex('Superman holds', ['home', 'outdoors'], 'body', 'Lower back, glutes', ['Lie face down, arms out in front', 'Lift your arms and legs a few centimetres', 'Hold, breathe, and lower slowly'], { avoid: ['back'] }),
  ex('Biceps curl', GEAR, 'free', 'Front of the arms', ['Elbows pinned to your sides', 'Curl up until your hands reach your shoulders', 'Lower for 2 seconds, no swinging']),
  ex('Hammer curl', GEAR, 'free', 'Front of the arms, forearms', ['Hold dumbbells with palms facing each other', 'Curl up with your elbows pinned to your sides', 'Lower slowly']),
  ex('Cable curl', ['gym'], 'machine', 'Front of the arms', ['Stand tall, elbows pinned to your sides', 'Curl the handle up to your shoulders', 'Lower for 2 seconds']),
  // ---- Legs and hips
  ex('Leg press', ['gym'], 'machine', 'Thighs, glutes', ['Feet shoulder-width, middle of the platform', 'Lower until your knees are bent about 90 degrees', 'Push through your heels, do not lock your knees']),
  ex('Leg extension', ['gym'], 'machine', 'Front of the thighs', ['Pad just above your ankles, back against the seat', 'Straighten your legs slowly, squeeze at the top', 'Lower for 2 seconds. Keep the weight light'], { avoid: ['knees'] }),
  ex('Leg curl', ['gym'], 'machine', 'Back of the thighs', ['Pad just above your heels', 'Curl your heels toward you, squeeze for 1 second', 'Lower slowly for 2 seconds']),
  ex('Goblet squat', GEAR, 'free', 'Thighs, glutes, core', ['Hold one dumbbell at your chest', 'Sit down between your knees, chest up', 'Stand up by pushing the floor away'], { avoid: ['knees'] }),
  ex('Back squat', ['gym'], 'free', 'Thighs, glutes, core', ['Bar across your upper back, feet shoulder-width', 'Sit down and back until your thighs are parallel', 'Stand up by pushing the floor away. Start light'], { avoid: ['knees', 'back'], advanced: true }),
  ex('Bodyweight squats', ['home', 'homegear', 'outdoors', 'gym'], 'body', 'Thighs, glutes', ['Feet shoulder-width, chest up', 'Sit back and down until your thighs are about parallel', 'Stand up by pushing the floor away'], { avoid: ['knees'] }),
  ex('Box squats', ['home', 'homegear', 'outdoors', 'gym'], 'body', 'Thighs, glutes', ['Stand in front of a chair or bench', 'Sit back until you just touch it, chest up', 'Stand up without using your hands']),
  ex('Romanian deadlift', ['gym'], 'free', 'Back of the thighs, glutes', ['Hold the weight close, knees slightly bent', 'Push your hips back until the back of your legs stretches', 'Keep your back flat, stand up by squeezing your glutes'], { avoid: ['back'] }),
  ex('Dumbbell Romanian deadlift', ['homegear'], 'free', 'Back of the thighs, glutes', ['Hold a dumbbell in each hand, knees slightly bent', 'Push your hips back until the back of your legs stretches', 'Keep your back flat, stand up by squeezing your glutes'], { avoid: ['back'] }),
  ex('Deadlift', ['gym'], 'free', 'Back, glutes, thighs', ['Bar over mid-foot, back flat, chest up', 'Push the floor away and stand tall', 'Lower the bar back along your legs. Start light'], { avoid: ['back'], advanced: true }),
  ex('Hip thrust', ['gym', 'homegear'], 'free', 'Glutes, back of the thighs', ['Upper back on a bench, feet flat, knees bent', 'Drive your hips up until your body is straight', 'Squeeze your glutes for 1 second at the top']),
  ex('Glute bridges', ['home', 'homegear', 'outdoors', 'gym'], 'body', 'Glutes, back of the thighs', ['Lie on your back, knees bent, feet flat', 'Lift your hips until your body is straight', 'Squeeze your glutes for 1 second, lower slowly']),
  ex('Single-leg glute bridge', NO_GYM, 'body', 'Glutes, back of the thighs', ['Lie on your back, one foot flat, the other leg straight up', 'Lift your hips by pushing through the flat foot', 'Lower slowly, then switch legs'], { advanced: true }),
  ex('Walking lunges', ['gym', 'outdoors', 'home'], 'body', 'Thighs, glutes', ['Take a long step forward, chest up', 'Lower until both knees are bent about 90 degrees', 'Push off the front foot into the next step'], { avoid: ['knees'] }),
  ex('Reverse lunges', ['home', 'homegear', 'gym'], 'body', 'Thighs, glutes', ['Step one foot back, chest up', 'Lower until both knees are bent about 90 degrees', 'Push through the front foot to stand'], { avoid: ['knees'] }),
  ex('Dumbbell split squats', ['homegear', 'gym'], 'free', 'Thighs, glutes', ['One foot forward, one back, a dumbbell in each hand', 'Lower straight down until your front thigh is parallel', 'Push up through the front heel'], { avoid: ['knees'] }),
  ex('Step-ups', ['home', 'outdoors', 'homegear', 'gym'], 'body', 'Thighs, glutes', ['Place a whole foot on a sturdy step or bench', 'Stand up by pushing through that foot, not the back foot', 'Lower slowly'], { avoid: ['knees'] }),
  ex('Wall sit', ['home', 'outdoors', 'homegear'], 'body', 'Thighs', ['Back flat against a wall, knees bent about 90 degrees', 'Keep your weight in your heels', 'Hold, breathing slowly'], { avoid: ['knees'] }),
  ex('Calf raise', ALL, 'body', 'Calves', ['Balls of your feet on a step, hold a rail', 'Rise as high as you can, pause 1 second', 'Lower slowly below the step']),
  ex('Kettlebell swings', ['homegear', 'gym'], 'free', 'Glutes, back of the thighs, core', ['Feet wider than your shoulders, kettlebell in both hands', 'Push your hips back, then snap them forward to swing it', 'Let it float to chest height, arms stay loose'], { avoid: ['back'], advanced: true }),
  // ---- Core and carries
  ex('Plank', ALL, 'body', 'Core, shoulders', ['Forearms down, elbows under your shoulders', 'Keep your body in one straight line', 'Squeeze belly and glutes. Too hard? Knees down']),
  ex('Side plank', ALL, 'body', 'Side of the core', ['Lie on your side, elbow under your shoulder', 'Lift your hips until your body is straight', 'Hold, then switch sides. Too hard? Knees down'], { avoid: ['shoulders'] }),
  ex('Dead bug', ALL, 'body', 'Deep core', ['Lie on your back, arms up, knees over hips', 'Lower the opposite arm and leg slowly', 'Keep your lower back pressed into the floor']),
  ex('Bird dog', ALL, 'body', 'Core, lower back, glutes', ['On hands and knees, back flat', 'Reach one arm and the opposite leg out long', 'Hold 2 seconds, return, switch sides']),
  ex('Lying leg raises', ALL, 'body', 'Lower belly', ['Lie on your back, legs straight, hands under your hips', 'Lift your legs up slowly, lower without touching the floor', 'Bend your knees if your back arches'], { avoid: ['back'] }),
  ex('Hanging knee raise', ['gym', 'outdoors'], 'body', 'Lower belly, grip', ['Hang from a bar, shoulders pulled down', 'Lift your knees toward your chest slowly', 'Lower without swinging'], { avoid: ['shoulders'] }),
  ex('Mountain climbers', ['home', 'outdoors', 'homegear'], 'body', 'Core, shoulders, legs', ['Start in a high plank, hands under your shoulders', 'Drive one knee toward your chest, then switch', 'Keep your hips low and breathe'], { avoid: ['breath', 'shoulders'] }),
  ex("Farmer's walk", ['gym', 'homegear', 'outdoors'], 'free', 'Grip, core, shoulders', ['Hold something moderately heavy in each hand', 'Stand tall, shoulders back, walk with small steps', 'Do not let the weights swing']),
  ex('Bear crawl', ['home', 'outdoors', 'homegear'], 'body', 'Whole body, core', ['On hands and knees, lift your knees a hand-width off the floor', 'Crawl forward slowly, opposite hand and foot', 'Keep your back flat'], { avoid: ['shoulders'] }),
  // ---- Cardio
  ex('Steady bike or rower', ['gym'], 'machine', 'Heart and legs', ['Easy start for 3 minutes', 'Hold a pace where you could talk in short sentences', 'Finish with 3 slow minutes']),
  ex('Treadmill incline walk', ['gym'], 'machine', 'Heart, glutes, calves', ['Set a gentle slope and a pace you could keep for 30 minutes', 'Walk tall, do not hold the rails', 'Slow down for the last 3 minutes']),
  ex('Brisk walk', ALL, 'body', 'Heart and legs', ['Walk fast enough that your breathing picks up', 'Swing your arms and keep your head up', 'Slow down for the last 3 minutes']),
  ex('Jumping jacks', NO_GYM, 'body', 'Heart, legs, shoulders', ['Stand tall, feet together', 'Jump your feet out as your arms go overhead', 'Land softly. Step side to side if jumping is hard'], { avoid: ['knees', 'breath'] }),
  ex('Skipping rope', NO_GYM, 'body', 'Heart, calves', ['Small hops, elbows close to your body', 'Turn the rope with your wrists', 'Rest when your breathing is too fast to talk'], { avoid: ['knees', 'breath'] }),
  ex('Jog and walk intervals', NO_GYM, 'body', 'Heart and legs', ['Jog easily for 1 minute, walk for 2', 'Repeat for the whole session', 'Keep the jog slow enough to breathe through your nose'], { avoid: ['knees', 'breath'] }),
  ex('Hill or stair sprints', ['outdoors'], 'body', 'Heart, thighs, glutes', ['Warm up with an easy walk first', 'Run hard up the hill or stairs, walk down slowly', 'Rest fully before the next one'], { avoid: ['knees', 'breath'], advanced: true }),
  // ---- Stretch and mobility
  ex('Cat and cow', ALL, 'body', 'Spine, back', ['On hands and knees, round your back up and tuck your chin', 'Then lower your belly and look up', 'Move slowly with your breath']),
  ex('Hip flexor stretch', ALL, 'body', 'Front of the hips', ['Kneel on one knee, the other foot in front', 'Tuck your tailbone and lean forward gently', 'Hold 30 seconds, then switch']),
  ex("Child's pose", ALL, 'body', 'Back, hips', ['Kneel, sit back toward your heels', 'Reach your arms forward along the floor', 'Hold and breathe slowly']),
  ex('Hamstring stretch', ALL, 'body', 'Back of the thighs', ['Sit with one leg straight, the other bent', 'Reach toward your toes with a flat back', 'Hold 30 seconds, then switch'], { avoid: ['back'] }),
  ex('Thoracic rotation', ALL, 'body', 'Upper back', ['On hands and knees, one hand behind your head', 'Turn your elbow up toward the ceiling', 'Return slowly, then switch sides']),
];

const BY_NAME = new Map(LIST.map((e) => [e.name.toLowerCase(), e]));

/** The warm up and cool down every session gets. They are written here, not by the AI. */
export const WARM_UP = {
  text: 'Warm up: 5 minutes',
  steps: ['Easy march on the spot: 1 minute', 'Jumping jacks or step-jacks: 30 seconds', 'Arm circles: 10 forward, 10 back', 'Leg swings: 10 each leg, hold a wall'],
};
export const COOL_DOWN = {
  text: 'Cool down and stretch: 5 minutes',
  steps: ['Chest stretch in a doorway: 30 seconds', 'Quad stretch: 30 seconds each leg', 'Hamstring reach: 30 seconds', 'Five slow, deep breaths'],
};

/**
 * The exercise names that suit this place, level and limits, and in a gym the equipment the person likes.
 * This is exactly what the AI may choose from. Body-weight moves and stretches are always allowed.
 */
export const menuFor = (place: Place, level: Level, limits: Limit[], gymKit: GymKit = 'both'): string[] => {
  const gentle = level === 'beginner' || level === 'returning';
  const wanted = (e: Exercise) => place !== 'gym' || gymKit === 'both' || e.kit === 'body' || (gymKit === 'machines' ? e.kit === 'machine' : e.kit === 'free');
  return LIST.filter(
    (e) => e.places.includes(place) && wanted(e) && !(gentle && e.advanced) && !(e.avoid ?? []).some((l) => limits.includes(l)),
  ).map((e) => e.name);
};

/** What an exercise is, then how to do it: the "works" line first, then a few short steps. Undefined when it is not on the menu. */
export const stepsFor = (name: string): string[] | undefined => {
  const e = BY_NAME.get(name.toLowerCase());
  return e ? [`Works: ${e.muscles}`, ...e.steps] : undefined;
};

export const ALL_EXERCISES = LIST.map((e) => e.name);
