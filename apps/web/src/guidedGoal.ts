import { buildFitnessPlan } from './fitnessPlan';
import { spreadOverDays, tasksForMinutes, type StarterPlan } from './starterPlan';

/**
 * The guided way to create a goal.
 *
 * Each niche (Career, Fitness…) has its own short list of questions. The answers
 * become a starter plan: a goal with weekly routines and tasks that the person
 * then keeps editing. It is a starting point, never a finished program.
 *
 * Everything here is data plus one small engine, with no React and no database.
 * To change what a niche asks, edit its `questions` and `plan` below. To let an
 * AI write the plan instead, supply another `PlanMaker` (see the end of the file);
 * the screens do not change.
 */

export type Answer = string | string[];
export type Answers = Record<string, Answer>;

export interface GuidedOption {
  value: string;
  label: string;
  hint?: string;
  /** Tapping it clears the other choices, and tapping another clears it ("No pain or problems"). */
  exclusive?: boolean;
}

/**
 * Something extra a person may tell us about their goal. Each area lists only what its plan can use
 * (age and weight for fitness and eating, an amount to save for money, an exam date for learning), and
 * everything here is optional. The answers go to the AI as plain question and answer text.
 */
export interface ExtraField {
  id: string;
  /** What the person sees. */
  label: string;
  kind: 'number' | 'text' | 'single' | 'multi';
  unit?: string;
  min?: number;
  max?: number;
  options?: GuidedOption[];
  /** Only shown for some answers. */
  showIf?: (answers: Answers) => boolean;
  /** How the AI is told about it, as a question it answers. */
  ask: string;
}

export interface GuidedQuestion {
  id: string;
  title: string;
  hint?: string;
  /** `single`: tap one. `multi`: tap any (none is fine). Nothing here ever has to be typed. */
  kind: 'single' | 'multi';
  options: GuidedOption[];
  /** Adds a "Something else" choice (pick-any questions too). Typing a name for it is optional. */
  allowOther?: boolean;
  /** What that extra choice says, when "Something else" does not fit (for example "I have a pain or limit"). */
  otherLabel?: string;
  /** One short line shown under the choices: why we ask. Every question has one. */
  why: string;
  /** Ask this question only when it applies to the answers so far. */
  showIf?: (answers: Answers) => boolean;
}

/**
 * What every niche asks last: which days and for how many months. The time for each
 * session is optional: `null` means the person did not add one, and the plan uses a normal amount.
 */
export interface CommonAnswers {
  days: number[];
  minutes: number | null;
  months: number;
}

export interface RoutineDraft {
  name: string;
  tasks: string[];
}

/** The niches people can start from. `custom` is "Something else": a generic starting point for any goal. */
export type NicheKey = 'career' | 'business' | 'fitness' | 'money' | 'learning' | 'custom';

export interface Niche {
  key: NicheKey;
  label: string;
  tagline: string;
  /** The goal category the app files it under. */
  category: string;
  questions: GuidedQuestion[];
  /** Optional extras for this area (the "anything to add?" step) and the reason we ask for them. */
  extras: ExtraField[];
  extrasWhy: string;
  /**
   * Turns the answers into a title, a description and routines in order of importance.
   * The common answers (days and time) are passed too, for a niche that shapes its plan by them.
   * A niche that already sized each routine to the time (`sized`) keeps all its tasks.
   */
  plan: (answers: AnswerReader, common: CommonAnswers) => { title: string; description: string; routines: RoutineDraft[]; sized?: boolean };
}

/** Typed text is shortened and stripped of control characters before it goes into a title or task. */
export const cleanText = (value: string, max = 60): string =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Reads answers safely: a missing or odd answer is just "nothing chosen". */
export class AnswerReader {
  constructor(
    private readonly questions: GuidedQuestion[],
    private readonly answers: Answers
  ) {}

  one(id: string): string | undefined {
    const a = this.answers[id];
    return typeof a === 'string' && a ? a : undefined;
  }

  many(id: string): string[] {
    const a = this.answers[id];
    return Array.isArray(a) ? a : typeof a === 'string' && a ? [a] : [];
  }

  has(id: string, value: string): boolean {
    return this.one(id) === value || this.many(id).includes(value);
  }

  /** What was typed under "Something else", if anything. Always optional. */
  other(id: string, max = 60): string {
    const typed = this.answers[`${id}_other`];
    return typeof typed === 'string' ? cleanText(typed, max) : '';
  }

  /** The label of the chosen option (for titles), or what was typed under "Something else". */
  label(id: string, max = 60): string {
    const value = this.one(id);
    if (value === 'other') return this.other(id, max);
    return this.questions.find((q) => q.id === id)?.options.find((o) => o.value === value)?.label ?? '';
  }
}

const opt = (value: string, label: string, hint?: string): GuidedOption => ({ value, label, hint });
/** The "none of these" choice of a pick-any question: a clear answer of its own, never left blank. */
const nothing = (label: string, hint?: string): GuidedOption => ({ value: 'none', label, hint, exclusive: true });

/** Keeps the first `min` routines coming from the answers and tops up from `fallback` so a plan is never thin. */
const ensure = (routines: RoutineDraft[], fallback: RoutineDraft[], min = 4): RoutineDraft[] => {
  const result = [...routines];
  for (const r of fallback) {
    if (result.length >= min) break;
    if (!result.some((x) => x.name === r.name)) result.push(r);
  }
  return result;
};

const or = (value: string, fallback: string) => (value ? value : fallback);

/* ---------------------------------------------------------------- career */

const career: Niche = {
  key: 'career',
  label: 'Business & Career',
  tagline: 'A job, a promotion, or growing a business',
  category: 'Business & Career',
  questions: [
    {
      id: 'aim',
      title: 'What is your main aim?',
      why: 'Your aim decides which weekly steps we start with.',
      kind: 'single',
      allowOther: true,
      options: [
        opt('job', 'Get a new job'),
        opt('promo', 'Get promoted'),
        opt('switch', 'Switch to a new field'),
        opt('grow', 'Grow my skills and profile'),
        opt('business', 'Start or grow a business'),
      ],
    },
    {
      id: 'level',
      title: 'Where are you right now?',
      why: 'We match the steps to how far along you are.',
      kind: 'single',
      options: [
        opt('early', 'Early in my career', '0 to 2 years'),
        opt('mid', 'Some experience', '2 to 6 years'),
        opt('senior', 'Very experienced', 'More than 6 years'),
        opt('between', 'Between jobs', 'Looking for the next role'),
      ],
    },
    {
      id: 'focus',
      title: 'What would help you most?',
      why: 'We add routines for the things you pick.',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [
        opt('skills', 'Learning skills'),
        opt('network', 'Meeting people in my field'),
        opt('profile', 'CV, profile and portfolio'),
        opt('interviews', 'Interview practice'),
      ],
    },
  ],
  extras: [
    { id: 'field', label: 'Your field or role', kind: 'text', ask: 'Their field or role.' },
    { id: 'deadline', label: 'A date you are working toward', kind: 'text', ask: 'A date they are working toward.' },
    { id: 'sells', label: 'What your business sells', kind: 'text', showIf: (a) => a.aim === 'business', ask: 'What their business sells.' },
    {
      id: 'customers',
      label: 'Customers so far',
      kind: 'single',
      showIf: (a) => a.aim === 'business',
      options: [opt('none', 'None yet'), opt('few', 'A few'), opt('regular', 'Regular customers')],
      ask: 'How many customers the business has so far.',
    },
  ],
  extrasWhy: 'The more we know about your work, the better the steps fit it.',
  plan: (r, common) => {
    const aim = r.one('aim');
    // Growing a business has its own starting plan.
    if (aim === 'business') return business.plan(r, common);
    const focus = r.many('focus');
    const searching = aim === 'job' || aim === 'switch' || r.has('level', 'between');

    const routines: RoutineDraft[] = [];
    if (searching) {
      routines.push({
        name: 'Job search',
        tasks: [
          'Apply to 3 roles that fit you',
          'Tailor your CV for one role',
          'Save 5 new openings to look at',
          'Follow up on one application',
          'Note what employers keep asking for',
        ],
      });
    }
    if (aim === 'promo') {
      routines.push({
        name: 'Promotion plan',
        tasks: [
          'Write down this week’s wins',
          'Ask someone for feedback',
          'Take on one task above your level',
          'Update your manager on progress',
          'List what the next level needs',
        ],
      });
    }
    if (focus.includes('skills') || aim === 'grow' || aim === 'switch') {
      routines.push({
        name: 'Skill building',
        tasks: [
          'Study for 30 minutes: a skill your next role needs',
          'Practise with one small exercise',
          'Write notes on what you learned',
          'Build one small piece of work',
          'Review something from last week',
        ],
      });
    }
    if (focus.includes('network')) {
      routines.push({
        name: 'Networking',
        tasks: [
          'Message one person in your field',
          'Comment on two relevant posts',
          'Book one coffee or call',
          'Thank someone who helped you',
          'Join one community or event',
        ],
      });
    }
    if (focus.includes('profile')) {
      routines.push({
        name: 'Profile and portfolio',
        tasks: [
          'Improve one line on your CV with a result',
          'Polish one portfolio item',
          'Refresh your profile headline',
          'Ask for one recommendation',
          'Add one number that shows your impact',
        ],
      });
    }
    if (focus.includes('interviews') || searching) {
      routines.push({
        name: 'Interview practice',
        tasks: [
          'Answer 3 common questions out loud',
          'Write one story: situation, action, result',
          'Research one company',
          'Do a mock interview with a friend',
          'Prepare 3 questions to ask',
        ],
      });
    }

    const titles: Record<string, string> = {
      job: 'Land a new job',
      promo: 'Earn my next promotion',
      switch: 'Switch to a new field',
      grow: 'Grow my career',
    };
    return {
      title: aim === 'other' ? or(r.other('aim', 70), 'Reach my career goal') : titles[aim ?? 'grow'] ?? 'Grow my career',
      description: 'Small weekly steps toward your next move. Change anything that does not fit.',
      routines: ensure(routines, [
        { name: 'Skill building', tasks: ['Study for 30 minutes', 'Practise one small exercise', 'Write notes', 'Review last week', 'Build something small'] },
        { name: 'Networking', tasks: ['Message one person in your field', 'Comment on two posts', 'Book one call', 'Thank someone', 'Join one event'] },
        { name: 'Profile and portfolio', tasks: ['Improve one CV line', 'Polish one portfolio item', 'Refresh your headline', 'Ask for a recommendation', 'Add one result'] },
        { name: 'Weekly review', tasks: ['List what you did this week', 'Pick next week’s top 3', 'Note one win', 'Note one lesson', 'Tidy your task list'] },
      ]),
    };
  },
};

/* -------------------------------------------------------------- business */

/** Not offered on its own: "Start or grow a business" is one of the aims under Business & Career. */
const business: Niche = {
  key: 'business',
  label: 'Business',
  tagline: 'Launch, get customers or grow sales',
  category: 'Business & Career',
  questions: [
    {
      id: 'aim',
      title: 'What do you want most?',
      why: 'Your aim decides which weekly steps we start with.',
      kind: 'single',
      allowOther: true,
      options: [opt('customers', 'My first customers'), opt('sales', 'More sales'), opt('systems', 'To get organised'), opt('launch', 'To launch my product')],
    },
    {
      id: 'stage',
      title: 'Where is your business?',
      why: 'We start from where the business is today.',
      kind: 'single',
      options: [opt('idea', 'Just an idea'), opt('started', 'Started, no sales yet'), opt('selling', 'Making some sales'), opt('growing', 'Growing steadily')],
    },
    {
      id: 'focus',
      title: 'Where do you need the most help?',
      why: 'We add routines for the things you pick.',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('marketing', 'Getting seen'), opt('outreach', 'Talking to customers'), opt('product', 'The product or service'), opt('money', 'Money and admin')],
    },
  ],
  extras: [],
  extrasWhy: '',
  plan: (r) => {
    const aim = r.one('aim');
    const focus = r.many('focus');
    const routines: RoutineDraft[] = [];

    if (r.has('stage', 'idea')) {
      routines.push({
        name: 'Test the idea',
        tasks: ['Talk to 3 people who might buy it', 'Write down what they said in their own words', 'List the biggest risk', 'Sketch the simplest version', 'Decide one thing to test this week'],
      });
    }
    if (aim === 'customers' || aim === 'sales' || focus.includes('outreach')) {
      routines.push({
        name: 'Customer outreach',
        tasks: ['Reach out to 5 possible customers', 'Follow up with 2 earlier contacts', 'Ask one customer for feedback', 'Note the questions people ask', 'Write down one objection and a reply'],
      });
    }
    if (focus.includes('marketing') || aim === 'launch') {
      routines.push({
        name: 'Marketing',
        tasks: ['Post once about your business', 'Reply to every comment or message', 'Share one customer story', 'Plan next week’s content', 'Look at what worked last week'],
      });
    }
    if (focus.includes('product') || aim === 'launch') {
      routines.push({
        name: 'Product',
        tasks: ['Improve one thing customers noticed', 'Test it as a customer would', 'List the next 3 fixes', 'Talk to one user', 'Remove one thing that is not needed'],
      });
    }
    if (focus.includes('money') || aim === 'systems') {
      routines.push({
        name: 'Money and admin',
        tasks: ['Record income and costs', 'Send any invoices due', 'Answer pending emails', 'Check next week’s deadlines', 'Move one task into a checklist'],
      });
    }

    const titles: Record<string, string> = {
      customers: 'Win my first customers',
      sales: 'Grow my sales',
      systems: 'Get my business organised',
      launch: 'Launch my product',
    };
    return {
      title: aim === 'other' ? or(r.other('aim', 70), 'Grow my business') : titles[aim ?? 'sales'] ?? 'Grow my business',
      description: 'Weekly habits that move the business forward. Adjust them as you learn what works.',
      routines: ensure(routines, [
        { name: 'Customer outreach', tasks: ['Reach out to 5 people', 'Follow up with 2 contacts', 'Ask for feedback', 'Note common questions', 'Write down one objection'] },
        { name: 'Marketing', tasks: ['Post once', 'Reply to comments', 'Share one story', 'Plan next week’s content', 'Review what worked'] },
        { name: 'Money and admin', tasks: ['Record income and costs', 'Send invoices', 'Answer emails', 'Check deadlines', 'Tidy one process'] },
        { name: 'Weekly review', tasks: ['List this week’s results', 'Pick next week’s top 3', 'Note one win', 'Note one lesson', 'Clear your inbox'] },
      ]),
    };
  },
};

/* --------------------------------------------------------------- fitness */

/** The starting plan for "Eat healthier": simple weekly habits shaped by the eating style and where meals come from. */
const eatingPlan = (r: AnswerReader): { title: string; description: string; routines: RoutineDraft[] } => {
  const style = r.one('style') ?? 'any';
  const meals = r.one('meals') ?? 'mixed';
  const protein: Record<string, string> = {
    any: 'Protein with every meal',
    vegetarian: 'Protein with every meal (eggs, paneer, lentils)',
    vegan: 'Protein with every meal (tofu, beans, lentils)',
    protein: 'Aim for 30 g of protein at every meal',
    lowcarb: 'Protein and vegetables at every meal',
  };
  const routines: RoutineDraft[] = [];
  if (meals !== 'home') {
    routines.push({ name: 'Eating out, smartly', tasks: ['Check the menu before you go', 'Choose a protein and a vegetable', 'Skip the sugary drink', 'Stop when you feel 80% full', 'Share a dessert instead of ordering your own'] });
  }
  if (meals !== 'out') {
    routines.push({ name: 'Plan and prep', tasks: ['Plan the week’s meals', 'Grocery shop for fresh food', 'Batch-cook lunches for the week', 'Wash and chop vegetables', 'Portion out healthy snacks'] });
  }
  routines.push({ name: 'High-protein day', tasks: [protein[style] ?? protein.any, 'A protein-rich snack', 'Drink 2 to 3 litres of water', 'Log what you ate', 'Take a 10-minute walk after dinner'] });
  routines.push({ name: 'Veggie-forward day', tasks: ['Half of every plate is vegetables', 'No sugary drinks', 'Try one new vegetable', 'Eat slowly, away from screens', 'Go for an evening walk'] });
  return { title: 'Eat well, feel great', description: 'Simple weekly habits for steady, healthy eating.', routines };
};

const eating = (a: Answers) => a.aim === 'eat';
const notEating = (a: Answers) => a.aim !== 'eat';

const fitness: Niche = {
  key: 'fitness',
  label: 'Health & Fitness',
  tagline: 'Build muscle, lose fat, stamina or flexibility',
  category: 'Health & Fitness',
  questions: [
    {
      id: 'aim',
      title: 'What is your main aim?',
      why: 'Your aim decides the kind of workouts and how hard to push.',
      kind: 'single',
      allowOther: true,
      options: [
        opt('muscle', 'Build muscle', 'Bigger, stronger muscles'),
        opt('fat', 'Lose fat', 'Burn more and feel lighter'),
        opt('stamina', 'Build stamina', 'Run, ride or swim for longer'),
        opt('mobility', 'Stretch and move better', 'Loosen up, fix stiffness'),
        opt('eat', 'Eat healthier', 'Simple, steady eating habits'),
      ],
    },
    {
      id: 'where',
      showIf: notEating,
      title: 'Where will you train?',
      why: 'We only use exercises you can do where you train.',
      kind: 'single',
      options: [
        opt('gym', 'At a gym', 'Machines and weights'),
        opt('home', 'At home, no equipment', 'Just your body'),
        opt('homegear', 'At home with weights', 'Dumbbells or bands'),
        opt('outdoors', 'Outdoors', 'A park, track or playground'),
      ],
    },
    {
      id: 'level',
      showIf: notEating,
      title: 'How experienced are you?',
      why: 'It sets how many sets, how heavy and how fast we build up.',
      kind: 'single',
      options: [
        opt('beginner', 'Beginner', 'New to training'),
        opt('returning', 'Coming back', 'After a long break'),
        opt('some', 'Some experience', 'You know the basic lifts'),
        opt('experienced', 'Experienced', 'You train regularly'),
      ],
    },
    {
      id: 'split',
      title: 'How do you like to split your training?',
      why: 'It decides what each day trains, so no day repeats the last.',
      hint: 'This shapes what each day trains.',
      kind: 'single',
      showIf: (answers) => ['muscle', 'fat'].includes(String(answers.aim)),
      options: [
        opt('auto', 'You decide for me', 'We pick what suits your days'),
        opt('full', 'Full body each time', 'A bit of everything, every session'),
        opt('upperlower', 'Upper body and lower body', 'Alternate the two'),
        opt('ppl', 'Push, pull and legs', 'Three kinds of day, repeated'),
      ],
    },
    {
      id: 'limits',
      showIf: notEating,
      title: 'Any pain or limits to be careful with?',
      hint: 'If you have one, tell us what it is.',
      why: 'We pick gentler exercises around anything that hurts.',
      kind: 'multi',
      allowOther: true,
      otherLabel: 'I have a pain or limit',
      options: [nothing('No pain or limits', 'I feel fine, go ahead')],
    },
    {
      id: 'style',
      title: 'Do you follow an eating style?',
      why: 'We shape the meals and the protein around it.',
      kind: 'single',
      showIf: eating,
      options: [opt('any', 'No particular style'), opt('vegetarian', 'Vegetarian'), opt('vegan', 'Vegan'), opt('protein', 'High-protein'), opt('lowcarb', 'Low-carb')],
    },
    {
      id: 'meals',
      title: 'Where do most meals come from?',
      why: 'Cooking at home and eating out need different habits.',
      kind: 'single',
      showIf: eating,
      options: [opt('home', 'I cook at home'), opt('mixed', 'A mix of both'), opt('out', 'Mostly eating out or ordering')],
    },
  ],
  extras: [
    { id: 'age', label: 'Age', kind: 'number', unit: 'years', min: 10, max: 100, ask: 'Age.' },
    { id: 'height', label: 'Height', kind: 'number', unit: 'cm', min: 100, max: 230, ask: 'Height.' },
    { id: 'weight', label: 'Weight', kind: 'number', unit: 'kg', min: 25, max: 300, ask: 'Weight.' },
    { id: 'target', label: 'Target weight (if you have one)', kind: 'number', unit: 'kg', min: 30, max: 300, showIf: (a) => a.aim === 'fat' || a.aim === 'eat', ask: 'Target weight.' },
    {
      id: 'parts',
      label: 'Parts you want to bring up',
      kind: 'multi',
      showIf: (a) => a.aim === 'muscle' || a.aim === 'fat',
      options: [opt('chest', 'Chest and arms'), opt('back', 'Back and shoulders'), opt('legs', 'Legs and glutes'), opt('core', 'Core and posture')],
      ask: 'Parts of the body they want to bring up.',
    },
    {
      id: 'kit',
      label: 'Gym equipment you like',
      kind: 'single',
      showIf: (a) => a.where === 'gym' && a.aim !== 'eat',
      options: [opt('machines', 'Machines and cables'), opt('free', 'Free weights and dumbbells'), opt('both', 'Both')],
      ask: 'Gym equipment they like.',
    },
    {
      id: 'pushups',
      label: 'How many push-ups can you do now?',
      kind: 'single',
      showIf: (a) => a.aim !== 'eat' && a.aim !== 'mobility',
      options: [opt('none', 'None yet'), opt('few', '1 to 5'), opt('some', '6 to 15'), opt('many', '16 or more')],
      ask: 'Push-ups they can do now.',
    },
    {
      id: 'walk',
      label: 'How far can you walk or jog without stopping?',
      kind: 'single',
      showIf: (a) => a.aim !== 'eat',
      options: [opt('short', 'About 10 minutes'), opt('half', 'About 30 minutes'), opt('hour', '1 hour or more'), opt('jog', 'I can jog 5 km')],
      ask: 'How far they can walk or jog without stopping.',
    },
    {
      id: 'movement',
      label: 'A normal day',
      kind: 'single',
      options: [opt('sitting', 'Mostly sitting', 'A desk or a lot of travel'), opt('some', 'Some walking', 'A few short walks'), opt('active', 'On my feet a lot', 'Standing or walking most of the day')],
      ask: 'How much they are on their feet in a normal day.',
    },
    { id: 'avoid', label: 'Foods you avoid or are allergic to', kind: 'text', showIf: eating, ask: 'Foods they avoid or are allergic to.' },
    {
      id: 'mealcount',
      label: 'Meals a day',
      kind: 'single',
      showIf: eating,
      options: [opt('2', 'Two'), opt('3', 'Three'), opt('4', 'Four or more')],
      ask: 'Meals a day.',
    },
  ],
  extrasWhy: 'These help us fit the plan to you and start at the right level. They stay inside this goal.',
  // The framework lives in fitnessPlan.ts: the number of training days, the place, the level, the
  // limits and the time for each session shape the week, the exercises and the doses.
  plan: (r, common) => (r.one('aim') === 'eat' ? eatingPlan(r) : buildFitnessPlan(r, common)),
};

/* ----------------------------------------------------------------- money */

const money: Niche = {
  key: 'money',
  label: 'Finance & Wealth',
  tagline: 'Save, pay off debt or start investing',
  category: 'Finance & Wealth',
  questions: [
    {
      id: 'aim',
      title: 'What is your money goal?',
      why: 'Your goal decides which money habits we start with.',
      kind: 'single',
      allowOther: true,
      options: [opt('save', 'Save more'), opt('debt', 'Pay off debt'), opt('invest', 'Start investing'), opt('track', 'Know where my money goes')],
    },
    {
      id: 'now',
      title: 'How do you handle money today?',
      why: 'We start from where you are, not from scratch.',
      kind: 'single',
      options: [opt('none', 'No real system'), opt('loose', 'I keep a rough eye on it'), opt('budget', 'I already use a budget')],
    },
    {
      id: 'focus',
      title: 'What do you want to work on?',
      why: 'We add routines for the things you pick.',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('budget', 'A simple budget'), opt('spending', 'Cutting spending'), opt('income', 'Earning more'), opt('learn', 'Learning the basics')],
    },
  ],
  extras: [
    { id: 'target', label: 'The amount you want to reach', kind: 'number', unit: 'amount', min: 1, max: 100000000, ask: 'The amount they want to reach.' },
    { id: 'monthly', label: 'What you can put aside each month', kind: 'number', unit: 'amount', min: 1, max: 100000000, ask: 'What they can put aside each month.' },
    { id: 'debt', label: 'The debt you want to clear', kind: 'number', unit: 'amount', min: 1, max: 100000000, showIf: (a) => a.aim === 'debt', ask: 'The debt they want to clear.' },
    { id: 'deadline', label: 'By when', kind: 'text', ask: 'The date they want to reach it by.' },
  ],
  extrasWhy: 'Numbers help us size the habits. Use any currency. Nothing here is shared.',
  plan: (r) => {
    const aim = r.one('aim');
    const focus = r.many('focus');
    const routines: RoutineDraft[] = [
      {
        name: 'Money check-in',
        tasks: ['Look at your balance and recent spending', 'Note anything that surprised you', 'Check upcoming bills', 'Update your budget if needed', 'Pick one money action for next week'],
      },
    ];
    if (aim === 'save' || focus.includes('budget')) {
      routines.push({ name: 'Saving move', tasks: ['Move money to savings', 'Set aside next week’s spending', 'Cancel one unused subscription', 'Compare one bill for a better price', 'Note the total saved so far'] });
    }
    if (aim === 'debt') {
      routines.push({ name: 'Debt plan', tasks: ['List every debt with its rate', 'Make the payment that is due', 'Put any extra money on the highest rate', 'Avoid new debt this week', 'Note the balance left'] });
    }
    if (aim === 'invest' || focus.includes('learn')) {
      routines.push({ name: 'Learn investing', tasks: ['Read or watch one beginner lesson', 'Write down one thing you learned', 'Check you have an emergency fund first', 'Compare one fund or option', 'Note one question to answer'] });
    }
    if (aim === 'track' || focus.includes('spending') || r.has('now', 'none')) {
      routines.push({ name: 'Spending review', tasks: ['Record this week’s spending', 'Sort it into categories', 'Find the biggest category', 'Choose one thing to cut', 'Reward yourself with something small and free'] });
    }
    if (focus.includes('income')) {
      routines.push({ name: 'Earning more', tasks: ['Work on one way to earn more', 'Reach out to one possible client or employer', 'Update your rates or skills list', 'Track the hours you put in', 'Plan the next step'] });
    }

    const titles: Record<string, string> = { save: 'Save more, steadily', debt: 'Pay off my debt', invest: 'Start investing with confidence', track: 'Know where my money goes' };
    return {
      title: aim === 'other' ? or(r.other('aim', 70), 'Take control of my money') : titles[aim ?? 'save'] ?? 'Take control of my money',
      description: 'A weekly money routine that is small enough to keep.',
      routines: ensure(routines, [
        { name: 'Spending review', tasks: ['Record spending', 'Sort into categories', 'Find the biggest one', 'Choose one thing to cut', 'Celebrate a small win'] },
        { name: 'Saving move', tasks: ['Move money to savings', 'Set aside next week’s spending', 'Cancel one unused subscription', 'Compare one bill', 'Note the total saved'] },
      ]),
    };
  },
};

/* -------------------------------------------------------------- learning */

const learning: Niche = {
  key: 'learning',
  label: 'Learning & Skills',
  tagline: 'Pick up something new, step by step',
  category: 'Learning & Skills',
  questions: [
    {
      id: 'what',
      title: 'What do you want to learn?',
      why: 'We shape the practice around what you want to learn.',
      kind: 'single',
      allowOther: true,
      options: [
        opt('language', 'A language'),
        opt('tech', 'Coding or a tech skill'),
        opt('music', 'Music or an instrument'),
        opt('school', 'A school or exam subject'),
        opt('work', 'A skill for work'),
      ],
    },
    {
      id: 'level',
      title: 'Where are you starting from?',
      why: 'Beginners and learners with some basics need different first steps.',
      kind: 'single',
      options: [opt('none', 'Complete beginner'), opt('basics', 'I know the basics'), opt('mid', 'Intermediate')],
    },
    {
      id: 'style',
      title: 'How do you like to learn?',
      why: 'We build the week around how you like to learn.',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('read', 'Reading'), opt('watch', 'Videos and courses'), opt('practice', 'Practising and projects'), opt('teach', 'Explaining it to others')],
    },
  ],
  extras: [
    { id: 'detail', label: 'What exactly? (a topic, exam or tool)', kind: 'text', ask: 'What exactly they want to learn.' },
    { id: 'deadline', label: 'An exam or date you are aiming for', kind: 'text', ask: 'A date they are aiming for, such as an exam.' },
    { id: 'have', label: 'A course, book or app you already have', kind: 'text', ask: 'A course, book or app they already have.' },
  ],
  extrasWhy: 'We build the practice around what you already have and when you need it.',
  plan: (r) => {
    const what = r.one('what');
    const subject: Record<string, string> = {
      language: 'a language',
      tech: 'a tech skill',
      music: 'music',
      school: 'my subject',
      work: 'a work skill',
    };
    const name = what === 'other' ? or(r.other('what', 40), 'something new') : subject[what ?? ''] ?? 'something new';
    const level = r.one('level') ?? 'none';
    const style = r.many('style');
    const start = level === 'none' ? 'the very basics' : level === 'basics' ? 'the next step up' : 'a harder topic';

    const routines: RoutineDraft[] = [];
    routines.push({
      name: 'Study session',
      tasks: [`Learn ${start} of ${name}`, style.includes('watch') ? 'Watch one lesson or tutorial' : 'Read one chapter or article', 'Write notes in your own words', 'Note one question to look up', 'Review yesterday’s notes'],
    });
    routines.push({
      name: 'Practice',
      tasks: [`Practise ${name} for 20 minutes`, 'Repeat the part you found hardest', 'Try it without looking at notes', 'Record how it went', 'Do one extra exercise'],
    });
    if (style.includes('practice') || style.length === 0) {
      routines.push({ name: 'Mini project', tasks: [`Work on a small project using ${name}`, 'Finish one small part', 'Write down what was hard', 'Ask for help on one thing', 'Share your progress'] });
    }
    if (style.includes('teach')) {
      routines.push({ name: 'Teach it back', tasks: ['Explain one idea out loud', 'Write a short summary', 'Teach a friend or post it', 'Fix what you could not explain', 'Make one flash card'] });
    }
    routines.push({ name: 'Review and recall', tasks: ['Quiz yourself without notes', 'Re-read your notes once', 'Mark what to revisit', 'Plan next week’s topic', what === 'school' ? 'Do one past paper question' : 'Note one thing you can now do'] });

    const titles: Record<string, string> = {
      language: 'Learn a new language',
      tech: 'Learn a tech skill',
      music: 'Learn music',
      school: 'Master my subject',
      work: 'Learn a skill for work',
    };
    return {
      title: what === 'other' ? `Learn ${name}` : titles[what ?? ''] ?? 'Learn something new',
      description: 'Short, regular sessions beat long, rare ones. Keep it light.',
      routines,
    };
  },
};

/* ---------------------------------------------------------------- custom */

const custom: Niche = {
  key: 'custom',
  label: 'Something else',
  tagline: 'Any goal that is not in the list',
  category: 'General',
  questions: [
    {
      id: 'kind',
      title: 'What kind of goal is it?',
      why: 'The kind of goal decides the shape of the plan.',
      kind: 'single',
      allowOther: true,
      options: [opt('habit', 'Build a habit'), opt('finish', 'Finish something'), opt('learn', 'Learn something'), opt('improve', 'Get better at something')],
    },
    {
      id: 'help',
      title: 'What would help you most?',
      why: 'We add the support you pick to the plan.',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('steps', 'Breaking it into small steps'), opt('checkin', 'A daily nudge to keep going'), opt('review', 'A weekly look at my progress')],
    },
  ],
  extras: [
    { id: 'detail', label: 'Tell us more about the goal', kind: 'text', ask: 'More about the goal, in their words.' },
    { id: 'deadline', label: 'A date it should be done by', kind: 'text', ask: 'A date they want it done by.' },
  ],
  extrasWhy: 'The more we know, the closer the plan gets to what you mean.',
  plan: (r) => {
    const kind = r.one('kind');
    const help = r.many('help');
    const routines: RoutineDraft[] = [
      { name: 'Focus time', tasks: ['Set a timer and work on it for 25 minutes', 'Start with the easiest part', 'Put your phone out of reach', 'Write down where you stopped', 'Take a short break'] },
    ];
    if (help.includes('steps') || help.length === 0) {
      routines.push({ name: 'Next step', tasks: ['Write the next small step', 'Do that step before anything else', 'Cross it off', 'Pick the step after it', 'Note anything that got in the way'] });
    }
    if (help.includes('checkin')) {
      routines.push({ name: 'Daily check-in', tasks: ['Did you work on it today? Note yes or no', 'Write one line about how it went', 'Decide when you will do it tomorrow', 'Reward yourself for showing up', 'Remove one distraction'] });
    }
    if (help.includes('review') || help.length === 0) {
      routines.push({ name: 'Weekly review', tasks: ['Look at what you did this week', 'Note one win', 'Note one thing to change', 'Pick next week’s top 3', 'Adjust the plan if it is too big'] });
    }

    const titles: Record<string, string> = {
      habit: 'Build a new habit',
      finish: 'Finish what I started',
      learn: 'Learn something new',
      improve: 'Get better at something',
    };
    return {
      title: kind === 'other' ? or(r.other('kind', 70), 'My goal') : titles[kind ?? ''] ?? 'My goal',
      description: 'A simple weekly rhythm for any goal. Rename it and make it yours.',
      routines: ensure(routines, [
        { name: 'Next step', tasks: ['Write the next small step', 'Do it first', 'Cross it off', 'Pick the next one', 'Note what got in the way'] },
        { name: 'Weekly review', tasks: ['Look at your week', 'Note one win', 'Note one change', 'Pick next week’s top 3', 'Adjust the plan'] },
        { name: 'Daily check-in', tasks: ['Note if you worked on it', 'Write one line', 'Plan tomorrow', 'Reward yourself', 'Remove a distraction'] },
      ], 3),
    };
  },
};

/* ---------------------------------------------------------------- engine */

/** The niches in the order they are offered. They match the categories in the plain form. */
export const NICHES: Niche[] = [fitness, career, money, learning, custom];

export const nicheByKey = (key: NicheKey): Niche => NICHES.find((n) => n.key === key) ?? NICHES[0];

/** The questions that apply to these answers (some are only asked after an earlier answer). */
export const visibleQuestions = (niche: Niche, answers: Answers): GuidedQuestion[] =>
  niche.questions.filter((q) => !q.showIf || q.showIf(answers));

/** The most routines a single goal starts with: enough to cover the week, not so many it overwhelms. */
const MAX_ROUTINES = 6;

/** Whether a question has been answered well enough to move on. Typing is never needed. */
export const isAnswered = (question: GuidedQuestion, answers: Answers): boolean => {
  // A question with a "none" choice wants one tap on something; any other pick-any question may be left empty.
  if (question.kind === 'multi') return !question.options.some((o) => o.exclusive) || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length > 0);
  const a = answers[question.id];
  return typeof a === 'string' && a.length > 0;
};

/** The choices offered for how long each session is and how long the goal runs. */
export const MINUTE_CHOICES = [15, 30, 45, 60];
/** Used when the person does not say how long each session is. */
export const DEFAULT_MINUTES = 30;
export const MONTH_CHOICES = [1, 3, 6, 12];

/**
 * Builds the starter plan from a niche, its answers and the common answers.
 * Pure and instant. Routines are spread over the chosen days, and each carries
 * as many tasks as the time available allows.
 */
export const buildGuidedPlan = (key: NicheKey, answers: Answers, common: CommonAnswers): StarterPlan => {
  const niche = nicheByKey(key);
  const days = common.days.length > 0 ? common.days : [1, 3, 5];
  const drafted = niche.plan(new AnswerReader(niche.questions, answers), { ...common, days });
  return shapePlan(niche, drafted, { ...common, days });
};

/**
 * Turns a drafted plan (a title and routines in order of importance) into a starter plan:
 * routines are spread over the chosen days and each keeps as many tasks as the time allows.
 * The rules and the AI both end here, so a plan always looks the same to the screens.
 */
const shapePlan = (
  niche: Niche,
  drafted: { title: string; description: string; routines: RoutineDraft[]; sized?: boolean },
  common: CommonAnswers
): StarterPlan => {
  const days = common.days.length > 0 ? common.days : [1, 3, 5];
  const count = Math.max(1, Math.min(MAX_ROUTINES, drafted.routines.length, days.length));
  const chosen = drafted.routines.slice(0, count);
  const spread = spreadOverDays(chosen.length, days);
  const perRoutine = tasksForMinutes(common.minutes ?? DEFAULT_MINUTES);

  return {
    focus: niche.key === 'custom' ? 'custom' : niche.key,
    title: cleanText(drafted.title, 100) || niche.label,
    category: niche.category,
    description: cleanText(drafted.description, 300),
    months: common.months,
    routines: chosen.map((routine, index) => ({
      name: cleanText(routine.name, 60),
      weekdays: spread[index],
      tasks: routine.tasks.map((t) => cleanText(t, 160)).filter(Boolean).slice(0, drafted.sized ? routine.tasks.length : perRoutine),
    })),
  };
};

/** What the person typed or tapped under "anything to add?", by field id. Every part is optional. */
export type ExtraValues = Record<string, string | string[]>;

/** The extras that apply to these answers. */
export const visibleExtras = (niche: Niche, answers: Answers): ExtraField[] => niche.extras.filter((f) => !f.showIf || f.showIf(answers));

/**
 * Keeps only extras that apply, are in range, and are made of plain text. A number outside its range
 * (an age of 400) or a choice that is not offered is dropped, so nothing odd ever reaches the AI or the plan.
 */
export const cleanExtras = (niche: Niche, answers: Answers, values: ExtraValues): ExtraValues => {
  const out: ExtraValues = {};
  for (const f of visibleExtras(niche, answers)) {
    const v = values[f.id];
    if (f.kind === 'number') {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      if (Number.isFinite(n) && n >= (f.min ?? 0) && n <= (f.max ?? Infinity)) out[f.id] = String(Math.round(n));
    } else if (f.kind === 'text') {
      const t = typeof v === 'string' ? cleanText(v, 80) : '';
      if (t) out[f.id] = t;
    } else if (f.kind === 'single') {
      if (typeof v === 'string' && f.options?.some((o) => o.value === v)) out[f.id] = v;
    } else {
      const picked = (Array.isArray(v) ? v : []).filter((x) => f.options?.some((o) => o.value === x));
      if (picked.length > 0) out[f.id] = picked;
    }
  }
  return out;
};

/** The extras as plain question and answer text for the AI. */
export const describeExtras = (niche: Niche, answers: Answers, values: ExtraValues): { q: string; a: string }[] => {
  const clean = cleanExtras(niche, answers, values);
  const out: { q: string; a: string }[] = [];
  for (const f of visibleExtras(niche, answers)) {
    const v = clean[f.id];
    if (v === undefined) continue;
    const label = (x: string) => f.options?.find((o) => o.value === x)?.label ?? x;
    const text = Array.isArray(v) ? v.map(label).join(', ') : f.kind === 'number' ? `${v}${f.unit && f.unit !== 'amount' ? ` ${f.unit}` : ''}` : label(v);
    out.push({ q: f.ask, a: text });
  }
  return out;
};

/**
 * What is sent to the AI: the area and every choice so far as plain question and
 * answer text. Typed "something else" text is included (it is the person's own
 * words); nothing about who the person is ever is.
 */
export const describeForAi = (
  key: NicheKey,
  answers: Answers,
  followUps: { id: string; title: string }[] = []
): { niche: string; answers: { q: string; a: string }[] } => {
  const niche = nicheByKey(key);
  const out: { q: string; a: string }[] = [];
  for (const question of visibleQuestions(niche, answers)) {
    const value = answers[question.id];
    const picked = (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []).map((v) => {
      if (v === 'other') {
        const typed = answers[`${question.id}_other`];
        return typeof typed === 'string' && typed.trim() ? cleanText(typed, 70) : 'something else';
      }
      return question.options.find((o) => o.value === v)?.label ?? v;
    });
    if (picked.length > 0) out.push({ q: question.title, a: picked.join(', ') });
  }
  for (const followUp of followUps) {
    const value = answers[`ai:${followUp.id}`];
    const typed = answers[`ai:${followUp.id}_other`];
    const text = value === 'other' ? (typeof typed === 'string' ? typed : '') : value;
    if (typeof text === 'string' && text.trim()) out.push({ q: followUp.title, a: cleanText(text, 100) });
  }
  return { niche: niche.label, answers: out };
};

/**
 * Something that turns answers into a plan. The rules above are one; an AI
 * could be another. The screens only ever call this, so switching changes no screen.
 */
export type PlanMaker = (key: NicheKey, answers: Answers, common: CommonAnswers) => Promise<StarterPlan>;

export const makePlanWithRules: PlanMaker = async (key, answers, common) => buildGuidedPlan(key, answers, common);
