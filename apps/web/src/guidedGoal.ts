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
}

export interface GuidedQuestion {
  id: string;
  title: string;
  hint?: string;
  /** `single`: tap one. `multi`: tap any (none is fine). Nothing here ever has to be typed. */
  kind: 'single' | 'multi';
  options: GuidedOption[];
  /** Adds a "Something else" choice. Typing a name for it is optional. */
  allowOther?: boolean;
  /** Ask this question only when it applies to the answers so far. */
  showIf?: (answers: Answers) => boolean;
}

/** What every niche asks last: when, for how long each time, and for how many months. */
export interface CommonAnswers {
  days: number[];
  minutes: number;
  months: number;
}

export interface RoutineDraft {
  name: string;
  tasks: string[];
}

/** The niches people can start from. `custom` is "Something else": a generic starting point for any goal. */
export type NicheKey = 'career' | 'business' | 'health' | 'fitness' | 'money' | 'learning' | 'custom';

export interface Niche {
  key: NicheKey;
  label: string;
  tagline: string;
  /** The goal category the app files it under. */
  category: string;
  questions: GuidedQuestion[];
  /** Turns the answers into a title, a description and routines in order of importance. */
  plan: (answers: AnswerReader) => { title: string; description: string; routines: RoutineDraft[] };
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
  label: 'Career',
  tagline: 'A new job, a promotion or a new direction',
  category: 'Career',
  questions: [
    {
      id: 'aim',
      title: 'What is your main aim?',
      kind: 'single',
      allowOther: true,
      options: [
        opt('job', 'Get a new job'),
        opt('promo', 'Get promoted'),
        opt('switch', 'Switch to a new field'),
        opt('grow', 'Grow my skills and profile'),
      ],
    },
    {
      id: 'level',
      title: 'Where are you right now?',
      kind: 'single',
      options: [
        opt('early', 'Early in my career', '0 to 2 years'),
        opt('mid', 'Some experience', '2 to 6 years'),
        opt('senior', 'Very experienced', 'More than 6 years'),
        opt('between', 'Between jobs'),
      ],
    },
    {
      id: 'focus',
      title: 'What would help you most?',
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
  plan: (r) => {
    const aim = r.one('aim');
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

const business: Niche = {
  key: 'business',
  label: 'Business',
  tagline: 'Launch, get customers or grow sales',
  category: 'Business',
  questions: [
    {
      id: 'aim',
      title: 'What do you want most?',
      kind: 'single',
      allowOther: true,
      options: [opt('customers', 'My first customers'), opt('sales', 'More sales'), opt('systems', 'To get organised'), opt('launch', 'To launch my product')],
    },
    {
      id: 'stage',
      title: 'Where is your business?',
      kind: 'single',
      options: [opt('idea', 'Just an idea'), opt('started', 'Started, no sales yet'), opt('selling', 'Making some sales'), opt('growing', 'Growing steadily')],
    },
    {
      id: 'focus',
      title: 'Where do you need the most help?',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('marketing', 'Getting seen'), opt('outreach', 'Talking to customers'), opt('product', 'The product or service'), opt('money', 'Money and admin')],
    },
  ],
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

/* ---------------------------------------------------------------- health */

const notEating = (a: Answers) => a.aim !== 'eat';
const eating = (a: Answers) => a.aim === 'eat';

const health: Niche = {
  key: 'health',
  label: 'Health',
  tagline: 'Eating, sleep, stress and energy',
  category: 'Health',
  questions: [
    {
      id: 'aim',
      title: 'What do you want to improve?',
      kind: 'single',
      allowOther: true,
      options: [opt('eat', 'Eat better'), opt('sleep', 'Sleep better'), opt('stress', 'Feel less stressed'), opt('energy', 'Have more energy')],
    },
    {
      id: 'style',
      title: 'Do you follow an eating style?',
      kind: 'single',
      showIf: eating,
      options: [opt('any', 'No particular style'), opt('vegetarian', 'Vegetarian'), opt('vegan', 'Vegan'), opt('protein', 'High-protein'), opt('lowcarb', 'Low-carb')],
    },
    {
      id: 'meals',
      title: 'Where do most meals come from?',
      kind: 'single',
      showIf: eating,
      options: [opt('home', 'I cook at home'), opt('mixed', 'A mix of both'), opt('out', 'Mostly eating out or ordering')],
    },
    {
      id: 'issues',
      title: 'What gets in the way?',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      showIf: notEating,
      options: [opt('phone', 'Phone late at night'), opt('caffeine', 'Too much caffeine'), opt('schedule', 'An uneven schedule'), opt('mind', 'A busy mind'), opt('movement', 'Not enough movement')],
    },
    {
      id: 'day',
      title: 'What is your day like?',
      kind: 'single',
      showIf: notEating,
      options: [opt('early', 'I start early'), opt('regular', 'Fairly regular hours'), opt('late', 'I go to bed late'), opt('irregular', 'It changes a lot')],
    },
  ],
  plan: (r) => {
    const aim = r.one('aim');

    if (aim === 'eat') {
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
    }

    const issues = r.many('issues');
    const routines: RoutineDraft[] = [];
    if (aim === 'sleep' || issues.includes('phone') || issues.includes('schedule') || r.has('day', 'late')) {
      routines.push({ name: 'Wind-down', tasks: ['Screens off 30 minutes before bed', 'Dim the lights in the evening', 'Write tomorrow’s top 3 tasks', 'Go to bed at the same time', 'Read a few pages'] });
    }
    if (aim === 'stress' || issues.includes('mind')) {
      routines.push({ name: 'Stress break', tasks: ['Breathe slowly for 5 minutes', 'Take a short walk outside', 'Write down what is on your mind', 'Stretch your neck and shoulders', 'Do one thing just for fun'] });
    }
    if (aim === 'energy' || issues.includes('caffeine') || issues.includes('movement')) {
      routines.push({ name: 'Energy boost', tasks: ['Drink a glass of water first thing', 'No caffeine after lunch', 'Move for 10 minutes', 'Eat something with protein', 'Stand up every hour'] });
    }
    routines.push({ name: 'Morning reset', tasks: ['Get 10 minutes of daylight', 'Drink water', 'Stretch for 3 minutes', 'Pick one thing that matters today', 'No phone for the first 15 minutes'] });

    const titles: Record<string, string> = { sleep: 'Sleep better, wake up rested', stress: 'Feel calmer day to day', energy: 'Have steady energy all day' };
    return {
      title: aim === 'other' ? or(r.other('aim', 70), 'Feel better every day') : titles[aim ?? 'energy'] ?? 'Feel better every day',
      description: 'Gentle daily routines for rest and energy. Keep what helps and drop the rest.',
      routines: ensure(routines, [
        { name: 'Wind-down', tasks: ['Screens off before bed', 'Dim the lights', 'Plan tomorrow', 'Same bedtime', 'Read a little'] },
        { name: 'Stress break', tasks: ['Breathe for 5 minutes', 'Short walk', 'Write down worries', 'Stretch', 'Do something fun'] },
        { name: 'Energy boost', tasks: ['Drink water first', 'Less caffeine', 'Move for 10 minutes', 'Eat protein', 'Stand every hour'] },
      ]),
    };
  },
};

/* --------------------------------------------------------------- fitness */

const fitness: Niche = {
  key: 'fitness',
  label: 'Fitness',
  tagline: 'Build strength, stamina or both',
  category: 'Fitness',
  questions: [
    {
      id: 'aim',
      title: 'What is your main aim?',
      kind: 'single',
      allowOther: true,
      options: [opt('muscle', 'Build muscle'), opt('fat', 'Lose fat'), opt('stamina', 'Get fitter and faster'), opt('active', 'Stay active and healthy')],
    },
    { id: 'where', title: 'Where will you train?', kind: 'single', options: [opt('gym', 'At a gym'), opt('home', 'At home'), opt('outdoors', 'Outdoors')] },
    {
      id: 'level',
      title: 'How experienced are you?',
      kind: 'single',
      options: [opt('beginner', 'Beginner', 'New or coming back'), opt('some', 'Some experience'), opt('experienced', 'Experienced')],
    },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const where = r.one('where') ?? 'gym';
    const level = r.one('level') ?? 'beginner';
    const sets = level === 'beginner' ? '3 sets of 8' : level === 'some' ? '4 sets of 8' : '4 sets of 6 to 10';
    const warm = 'Warm up for 5 minutes';

    const lifts: Record<string, { push: string[]; pull: string[]; legs: string[] }> = {
      gym: {
        push: [`Bench press: ${sets}`, `Shoulder press: ${sets}`, 'Triceps pushdowns: 3 sets', 'Cool down and stretch'],
        pull: [`Rows: ${sets}`, `Lat pulldown: ${sets}`, 'Biceps curls: 3 sets', 'Cool down and stretch'],
        legs: [`Squats: ${sets}`, `Romanian deadlift: ${sets}`, 'Lunges: 3 sets', 'Cool down and stretch'],
      },
      home: {
        push: [`Push-ups: ${sets}`, 'Pike push-ups: 3 sets', 'Chair dips: 3 sets', 'Cool down and stretch'],
        pull: ['Backpack or towel rows: 4 sets', 'Superman holds: 3 sets', 'Biceps curls with a bag: 3 sets', 'Cool down and stretch'],
        legs: [`Bodyweight squats: ${sets}`, 'Split squats: 3 sets', 'Glute bridges: 3 sets', 'Cool down and stretch'],
      },
      outdoors: {
        push: [`Push-ups: ${sets}`, 'Bench dips: 3 sets', 'Plank: 3 holds', 'Cool down and stretch'],
        pull: ['Pull-ups or bar hangs: 4 sets', 'Inverted rows if you can: 3 sets', 'Farmer carry: 3 rounds', 'Cool down and stretch'],
        legs: ['Hill or stair walking: 10 minutes', `Squats: ${sets}`, 'Step-ups: 3 sets', 'Cool down and stretch'],
      },
    };
    const set = lifts[where] ?? lifts.gym;
    const withWarm = (tasks: string[]) => [warm, ...tasks];

    const cardio: RoutineDraft = {
      name: 'Cardio',
      tasks: ['Easy 5-minute warm up', level === 'beginner' ? 'Brisk walk or light jog: 20 minutes' : 'Steady run, ride or swim: 30 minutes', 'Finish with a slow 3 minutes', 'Stretch your legs', 'Drink water'],
    };
    const mobility: RoutineDraft = { name: 'Mobility', tasks: ['Hip and hamstring stretches', 'Shoulder and chest opener', 'Gentle spine twists', 'Foam roll or self-massage', 'Walk for 10 minutes'] };

    const routines: RoutineDraft[] =
      aim === 'stamina' || aim === 'active'
        ? [cardio, { name: 'Strength: legs', tasks: withWarm(set.legs) }, { name: 'Strength: upper body', tasks: withWarm(set.push) }, mobility]
        : aim === 'fat'
        ? [{ name: 'Strength: push', tasks: withWarm(set.push) }, cardio, { name: 'Strength: pull', tasks: withWarm(set.pull) }, { name: 'Strength: legs', tasks: withWarm(set.legs) }]
        : [{ name: 'Strength: push', tasks: withWarm(set.push) }, { name: 'Strength: pull', tasks: withWarm(set.pull) }, { name: 'Strength: legs', tasks: withWarm(set.legs) }, cardio];

    const titles: Record<string, string> = { muscle: 'Build strength and muscle', fat: 'Lose fat and feel strong', stamina: 'Get fitter and faster', active: 'Stay active and healthy' };
    return {
      title: aim === 'other' ? or(r.other('aim', 70), 'Get stronger and fitter') : titles[aim ?? 'active'] ?? 'Get stronger and fitter',
      description: 'A weekly training split you can keep up. Swap exercises freely.',
      routines: ensure(routines, [mobility]),
    };
  },
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
      kind: 'single',
      allowOther: true,
      options: [opt('save', 'Save more'), opt('debt', 'Pay off debt'), opt('invest', 'Start investing'), opt('track', 'Know where my money goes')],
    },
    {
      id: 'now',
      title: 'How do you handle money today?',
      kind: 'single',
      options: [opt('none', 'No real system'), opt('loose', 'I keep a rough eye on it'), opt('budget', 'I already use a budget')],
    },
    {
      id: 'focus',
      title: 'What do you want to work on?',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('budget', 'A simple budget'), opt('spending', 'Cutting spending'), opt('income', 'Earning more'), opt('learn', 'Learning the basics')],
    },
  ],
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
      kind: 'single',
      options: [opt('none', 'Complete beginner'), opt('basics', 'I know the basics'), opt('mid', 'Intermediate')],
    },
    {
      id: 'style',
      title: 'How do you like to learn?',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('read', 'Reading'), opt('watch', 'Videos and courses'), opt('practice', 'Practising and projects'), opt('teach', 'Explaining it to others')],
    },
  ],
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
      kind: 'single',
      allowOther: true,
      options: [opt('habit', 'Build a habit'), opt('finish', 'Finish something'), opt('learn', 'Learn something'), opt('improve', 'Get better at something')],
    },
    {
      id: 'help',
      title: 'What would help you most?',
      hint: 'Pick as many as you like, or none.',
      kind: 'multi',
      options: [opt('steps', 'Breaking it into small steps'), opt('checkin', 'A daily nudge to keep going'), opt('review', 'A weekly look at my progress')],
    },
  ],
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
export const NICHES: Niche[] = [career, business, health, fitness, money, learning, custom];

export const nicheByKey = (key: NicheKey): Niche => NICHES.find((n) => n.key === key) ?? NICHES[0];

/** The niche that goes with a category chosen in the plain form, so the questions can start where the person already is. */
export const nicheForCategory = (category: string | null | undefined): NicheKey | undefined =>
  NICHES.find((n) => n.key !== 'custom' && n.category === category)?.key;

/** The questions that apply to these answers (some are only asked after an earlier answer). */
export const visibleQuestions = (niche: Niche, answers: Answers): GuidedQuestion[] =>
  niche.questions.filter((q) => !q.showIf || q.showIf(answers));

/** The most routines a single goal starts with: enough to cover the week, not so many it overwhelms. */
const MAX_ROUTINES = 4;

/** Whether a question has been answered well enough to move on. Typing is never needed. */
export const isAnswered = (question: GuidedQuestion, answers: Answers): boolean => {
  if (question.kind === 'multi') return true; // picking none is fine: the plan falls back to sensible defaults
  const a = answers[question.id];
  return typeof a === 'string' && a.length > 0;
};

/** The choices offered for how long each session is and how long the goal runs. */
export const MINUTE_CHOICES = [15, 30, 45, 60];
export const MONTH_CHOICES = [1, 3, 6, 12];

/**
 * Builds the starter plan from a niche, its answers and the common answers.
 * Pure and instant. Routines are spread over the chosen days, and each carries
 * as many tasks as the time available allows.
 */
export const buildGuidedPlan = (key: NicheKey, answers: Answers, common: CommonAnswers): StarterPlan => {
  const niche = nicheByKey(key);
  const drafted = niche.plan(new AnswerReader(niche.questions, answers));
  const days = common.days.length > 0 ? common.days : [1, 3, 5];
  const count = Math.max(1, Math.min(MAX_ROUTINES, drafted.routines.length, days.length));
  const chosen = drafted.routines.slice(0, count);
  const spread = spreadOverDays(chosen.length, days);
  const perRoutine = tasksForMinutes(common.minutes);

  return {
    focus: niche.key === 'custom' ? 'custom' : niche.key,
    title: cleanText(drafted.title, 100) || niche.label,
    category: niche.category,
    description: drafted.description,
    months: common.months,
    routines: chosen.map((routine, index) => ({
      name: routine.name,
      weekdays: spread[index],
      tasks: routine.tasks.map((t) => cleanText(t, 160)).filter(Boolean).slice(0, perRoutine),
    })),
  };
};

/**
 * Something that turns answers into a plan. The rules above are one; an AI
 * could be another. The screens only ever call this, so switching changes no screen.
 */
export type PlanMaker = (key: NicheKey, answers: Answers, common: CommonAnswers) => Promise<StarterPlan>;

export const makePlanWithRules: PlanMaker = async (key, answers, common) => buildGuidedPlan(key, answers, common);
