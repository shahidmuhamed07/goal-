import {
  LENGTH_OPTIONS,
  TIME_OPTIONS,
  spreadOverDays,
  tasksForMinutes,
  type Focus,
  type StarterPlan,
} from './starterPlan';

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
  /** `single`: pick one. `multi`: pick any. `text`: type an answer. */
  kind: 'single' | 'multi' | 'text';
  options?: GuidedOption[];
  /** Adds a "Something else" choice that opens a box to type in. */
  allowOther?: boolean;
  placeholder?: string;
  /** A question the person may leave empty. Choices are always optional to refine, text is required unless this is set. */
  optional?: boolean;
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

export interface Niche {
  key: Focus;
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

  /** Typed text for a text question, or what was typed under "Something else". */
  text(id: string, max = 60): string {
    const typed = this.answers[id];
    if (typeof typed === 'string' && this.questions.find((q) => q.id === id)?.kind === 'text') {
      return cleanText(typed, max);
    }
    const other = this.answers[`${id}_other`];
    return typeof other === 'string' ? cleanText(other, max) : '';
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
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [
        opt('skills', 'Learning skills'),
        opt('network', 'Meeting people in my field'),
        opt('profile', 'CV, profile and portfolio'),
        opt('interviews', 'Interview practice'),
      ],
    },
    {
      id: 'target',
      title: 'Which role or field?',
      hint: 'Optional. It goes into your goal and tasks.',
      kind: 'text',
      optional: true,
      placeholder: 'e.g. product designer',
    },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const target = r.text('target');
    const focus = r.many('focus');
    const searching = aim === 'job' || aim === 'switch' || r.has('level', 'between');

    const routines: RoutineDraft[] = [];
    if (searching) {
      routines.push({
        name: 'Job search',
        tasks: [
          `Apply to 3 ${target ? `${target} ` : ''}roles that fit you`,
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
          `Study for 30 minutes: ${or(target, 'a skill your next role needs')}`,
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
      job: target ? `Land a ${target} role` : 'Land a new job',
      promo: 'Earn my next promotion',
      switch: target ? `Move into ${target}` : 'Switch to a new field',
      grow: 'Grow my career',
    };
    const title = aim === 'other' ? or(r.text('aim', 70), 'Reach my career goal') : titles[aim ?? 'grow'] ?? 'Grow my career';

    return {
      title,
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
      id: 'stage',
      title: 'Where is your business?',
      kind: 'single',
      options: [opt('idea', 'Just an idea'), opt('started', 'Started, no sales yet'), opt('selling', 'Making some sales'), opt('growing', 'Growing steadily')],
    },
    {
      id: 'aim',
      title: 'What do you want most?',
      kind: 'single',
      allowOther: true,
      options: [opt('customers', 'My first customers'), opt('sales', 'More sales'), opt('systems', 'To get organised'), opt('launch', 'To launch my product')],
    },
    {
      id: 'focus',
      title: 'Where do you need the most help?',
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [opt('marketing', 'Getting seen'), opt('outreach', 'Talking to customers'), opt('product', 'The product or service'), opt('money', 'Money and admin')],
    },
    { id: 'what', title: 'What is the business?', hint: 'Optional. A few words.', kind: 'text', optional: true, placeholder: 'e.g. home bakery' },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const what = r.text('what');
    const focus = r.many('focus');
    const routines: RoutineDraft[] = [];

    if (aim === 'customers' || aim === 'sales' || focus.includes('outreach')) {
      routines.push({
        name: 'Customer outreach',
        tasks: ['Reach out to 5 possible customers', 'Follow up with 2 earlier contacts', 'Ask one customer for feedback', 'Note the questions people ask', 'Write down one objection and a reply'],
      });
    }
    if (focus.includes('marketing') || aim === 'launch') {
      routines.push({
        name: 'Marketing',
        tasks: [`Post once about ${or(what, 'your business')}`, 'Reply to every comment or message', 'Share one customer story', 'Plan next week’s content', 'Look at what worked last week'],
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
      customers: `Win my first customers${what ? ` for my ${what}` : ''}`,
      sales: `Grow sales${what ? ` for my ${what}` : ''}`,
      systems: 'Get my business organised',
      launch: `Launch${what ? ` my ${what}` : ' my product'}`,
    };

    return {
      title: aim === 'other' ? or(r.text('aim', 70), 'Grow my business') : titles[aim ?? 'sales'] ?? 'Grow my business',
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

const health: Niche = {
  key: 'health',
  label: 'Sleep and wellbeing',
  tagline: 'Sleep, stress and steady energy',
  category: 'Health',
  questions: [
    {
      id: 'aim',
      title: 'What do you want to improve?',
      kind: 'single',
      allowOther: true,
      options: [opt('sleep', 'Sleep better'), opt('stress', 'Feel less stressed'), opt('energy', 'Have more energy'), opt('habits', 'Build healthier habits')],
    },
    {
      id: 'issues',
      title: 'What gets in the way?',
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [opt('phone', 'Phone late at night'), opt('caffeine', 'Too much caffeine'), opt('schedule', 'An uneven schedule'), opt('mind', 'A busy mind'), opt('movement', 'Not enough movement')],
    },
    {
      id: 'day',
      title: 'What is your day like?',
      kind: 'single',
      options: [opt('early', 'I start early'), opt('regular', 'Fairly regular hours'), opt('late', 'I go to bed late'), opt('irregular', 'It changes a lot')],
    },
    { id: 'note', title: 'Anything we should know?', hint: 'Optional.', kind: 'text', optional: true, placeholder: 'e.g. I work night shifts' },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const issues = r.many('issues');
    const routines: RoutineDraft[] = [];

    if (aim === 'sleep' || issues.includes('phone') || issues.includes('schedule') || r.has('day', 'late')) {
      routines.push({
        name: 'Wind-down',
        tasks: ['Screens off 30 minutes before bed', 'Dim the lights in the evening', 'Write tomorrow’s top 3 tasks', 'Go to bed at the same time', 'Read a few pages'],
      });
    }
    if (aim === 'stress' || issues.includes('mind')) {
      routines.push({
        name: 'Stress break',
        tasks: ['Breathe slowly for 5 minutes', 'Take a short walk outside', 'Write down what is on your mind', 'Stretch your neck and shoulders', 'Do one thing just for fun'],
      });
    }
    if (aim === 'energy' || issues.includes('caffeine') || issues.includes('movement')) {
      routines.push({
        name: 'Energy boost',
        tasks: ['Drink a glass of water first thing', 'No caffeine after lunch', 'Move for 10 minutes', 'Eat something with protein', 'Stand up every hour'],
      });
    }
    routines.push({
      name: 'Morning reset',
      tasks: ['Get 10 minutes of daylight', 'Drink water', 'Stretch for 3 minutes', 'Pick one thing that matters today', 'No phone for the first 15 minutes'],
    });

    const titles: Record<string, string> = { sleep: 'Sleep better, wake up rested', stress: 'Feel calmer day to day', energy: 'Have steady energy all day', habits: 'Build healthier daily habits' };
    return {
      title: aim === 'other' ? or(r.text('aim', 70), 'Feel better every day') : titles[aim ?? 'habits'] ?? 'Feel better every day',
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
    { id: 'note', title: 'Injuries or things to avoid?', hint: 'Optional. We add it as a reminder.', kind: 'text', optional: true, placeholder: 'e.g. sore left knee' },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const where = r.one('where') ?? 'gym';
    const level = r.one('level') ?? 'beginner';
    const note = r.text('note');
    const sets = level === 'beginner' ? '3 sets of 8' : level === 'some' ? '4 sets of 8' : '4 sets of 6 to 10';
    const warm = note ? `Warm up for 5 minutes (go easy: ${note})` : 'Warm up for 5 minutes';

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
      title: aim === 'other' ? or(r.text('aim', 70), 'Get stronger and fitter') : titles[aim ?? 'active'] ?? 'Get stronger and fitter',
      description: 'A weekly training split you can keep up. Swap exercises freely.',
      routines: ensure(routines, [mobility]),
    };
  },
};

/* ------------------------------------------------------------------ diet */

const diet: Niche = {
  key: 'diet',
  label: 'Eating better',
  tagline: 'Meals and habits that fit your life',
  category: 'Health',
  questions: [
    {
      id: 'aim',
      title: 'What do you want from your food?',
      kind: 'single',
      allowOther: true,
      options: [opt('lose', 'Lose weight'), opt('healthy', 'Eat healthier'), opt('gain', 'Gain weight or muscle'), opt('energy', 'More steady energy')],
    },
    {
      id: 'style',
      title: 'Do you follow an eating style?',
      kind: 'single',
      options: [opt('any', 'No particular style'), opt('vegetarian', 'Vegetarian'), opt('vegan', 'Vegan'), opt('protein', 'High-protein'), opt('lowcarb', 'Low-carb')],
    },
    {
      id: 'meals',
      title: 'Where do most meals come from?',
      kind: 'single',
      options: [opt('home', 'I cook at home'), opt('mixed', 'A mix of both'), opt('out', 'Mostly eating out or ordering')],
    },
    { id: 'note', title: 'Allergies or foods to avoid?', hint: 'Optional. We add it as a reminder.', kind: 'text', optional: true, placeholder: 'e.g. no peanuts' },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const style = r.one('style') ?? 'any';
    const meals = r.one('meals') ?? 'mixed';
    const note = r.text('note');
    const protein: Record<string, string> = {
      any: 'Protein with every meal',
      vegetarian: 'Protein with every meal (eggs, paneer, lentils)',
      vegan: 'Protein with every meal (tofu, beans, lentils)',
      protein: 'Aim for 30 g of protein at every meal',
      lowcarb: 'Protein and vegetables at every meal',
    };
    const reminder = note ? [`Check labels and menus first (${note})`] : [];

    const routines: RoutineDraft[] = [];
    if (meals !== 'out') {
      routines.push({
        name: 'Plan and prep',
        tasks: ['Plan the week’s meals', 'Grocery shop for fresh food', 'Batch-cook lunches for the week', ...reminder, 'Wash and chop vegetables', 'Portion out healthy snacks'].slice(0, 5),
      });
    }
    routines.push({
      name: 'High-protein day',
      tasks: [protein[style] ?? protein.any, 'A protein-rich snack', 'Drink 2 to 3 litres of water', 'Log what you ate', 'Take a 10-minute walk after dinner'],
    });
    routines.push({
      name: 'Veggie-forward day',
      tasks: ['Half of every plate is vegetables', 'No sugary drinks', 'Try one new vegetable', 'Eat slowly, away from screens', 'Go for an evening walk'],
    });
    if (meals !== 'home') {
      routines.unshift({
        name: 'Eating out, smartly',
        tasks: ['Check the menu before you go', 'Choose a protein and a vegetable', 'Skip the sugary drink', ...reminder, 'Stop when you feel 80% full'].slice(0, 5),
      });
    }

    const titles: Record<string, string> = { lose: 'Lose weight, steadily', healthy: 'Eat well, feel great', gain: 'Gain weight and muscle', energy: 'Eat for steady energy' };
    return {
      title: aim === 'other' ? or(r.text('aim', 70), 'Eat well, feel great') : titles[aim ?? 'healthy'] ?? 'Eat well, feel great',
      description: 'Simple weekly habits for steady, healthy eating.',
      routines,
    };
  },
};

/* ----------------------------------------------------------------- money */

const money: Niche = {
  key: 'money',
  label: 'Money',
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
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [opt('budget', 'A simple budget'), opt('spending', 'Cutting spending'), opt('income', 'Earning more'), opt('learn', 'Learning the basics')],
    },
    { id: 'target', title: 'Is there a number you are aiming for?', hint: 'Optional.', kind: 'text', optional: true, placeholder: 'e.g. save 5,000 by June' },
  ],
  plan: (r) => {
    const aim = r.one('aim');
    const target = r.text('target');
    const focus = r.many('focus');
    const routines: RoutineDraft[] = [
      {
        name: 'Money check-in',
        tasks: ['Look at your balance and recent spending', 'Note anything that surprised you', 'Check upcoming bills', 'Update your budget if needed', 'Pick one money action for next week'],
      },
    ];
    if (aim === 'save' || focus.includes('budget')) {
      routines.push({ name: 'Saving move', tasks: [`Move money to savings${target ? ` (${target})` : ''}`, 'Set aside next week’s spending', 'Cancel one unused subscription', 'Compare one bill for a better price', 'Note the total saved so far'] });
    }
    if (aim === 'debt') {
      routines.push({ name: 'Debt plan', tasks: ['List every debt with its rate', 'Make the payment that is due', 'Put any extra money on the highest rate', 'Avoid new debt this week', 'Note the balance left'] });
    }
    if (aim === 'invest' || focus.includes('learn')) {
      routines.push({ name: 'Learn investing', tasks: ['Read or watch one beginner lesson', 'Write down one thing you learned', 'Check you have an emergency fund first', 'Compare one fund or option', 'Note one question to answer'] });
    }
    if (aim === 'track' || focus.includes('spending')) {
      routines.push({ name: 'Spending review', tasks: ['Record this week’s spending', 'Sort it into categories', 'Find the biggest category', 'Choose one thing to cut', 'Reward yourself with something small and free'] });
    }
    if (focus.includes('income')) {
      routines.push({ name: 'Earning more', tasks: ['Work on one way to earn more', 'Reach out to one possible client or employer', 'Update your rates or skills list', 'Track the hours you put in', 'Plan the next step'] });
    }

    const titles: Record<string, string> = {
      save: target ? `Save: ${target}` : 'Save more, steadily',
      debt: 'Pay off my debt',
      invest: 'Start investing with confidence',
      track: 'Know where my money goes',
    };
    return {
      title: aim === 'other' ? or(r.text('aim', 70), 'Take control of my money') : titles[aim ?? 'save'] ?? 'Take control of my money',
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
  label: 'Learning a skill',
  tagline: 'Pick up something new, step by step',
  category: 'Learning & Skills',
  questions: [
    { id: 'what', title: 'What do you want to learn?', kind: 'text', placeholder: 'e.g. Spanish, guitar, Python' },
    {
      id: 'why',
      title: 'Why does it matter to you?',
      kind: 'single',
      allowOther: true,
      options: [opt('career', 'For my career'), opt('hobby', 'For fun'), opt('exam', 'For an exam or course'), opt('curious', 'I am just curious')],
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
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [opt('read', 'Reading'), opt('watch', 'Videos and courses'), opt('practice', 'Practising and projects'), opt('teach', 'Explaining it to others')],
    },
  ],
  plan: (r) => {
    const what = r.text('what', 40) || 'a new skill';
    const level = r.one('level') ?? 'none';
    const style = r.many('style');
    const why = r.one('why');
    const start = level === 'none' ? 'the very basics' : level === 'basics' ? 'the next step up' : 'a harder topic';

    const routines: RoutineDraft[] = [];
    routines.push({
      name: 'Study session',
      tasks: [`Learn ${start} of ${what}`, style.includes('watch') ? 'Watch one lesson or tutorial' : 'Read one chapter or article', 'Write notes in your own words', 'Note one question to look up', 'Review yesterday’s notes'],
    });
    routines.push({
      name: 'Practice',
      tasks: [`Practise ${what} for 20 minutes`, 'Repeat the part you found hardest', 'Try it without looking at notes', 'Record how it went', 'Do one extra exercise'],
    });
    if (style.includes('practice') || style.length === 0) {
      routines.push({ name: 'Mini project', tasks: [`Work on a small ${what} project`, 'Finish one small part', 'Write down what was hard', 'Ask for help on one thing', 'Share your progress'] });
    }
    if (style.includes('teach')) {
      routines.push({ name: 'Teach it back', tasks: ['Explain one idea out loud', 'Write a short summary', 'Teach a friend or post it', 'Fix what you could not explain', 'Make one flash card'] });
    }
    routines.push({ name: 'Review and recall', tasks: ['Quiz yourself without notes', 'Re-read your notes once', 'Mark what to revisit', 'Plan next week’s topic', why === 'exam' ? 'Do one past paper question' : 'Note one thing you can now do'] });

    return {
      title: `Learn ${what}`,
      description: 'Short, regular sessions beat long, rare ones. Keep it light.',
      routines,
    };
  },
};

/* -------------------------------------------------------------- creative */

const creative: Niche = {
  key: 'creative',
  label: 'Creative projects',
  tagline: 'Write, draw, make music or build something',
  category: 'Creative Writing',
  questions: [
    {
      id: 'craft',
      title: 'What do you want to make?',
      kind: 'single',
      allowOther: true,
      options: [opt('writing', 'Writing'), opt('art', 'Drawing or painting'), opt('music', 'Music'), opt('making', 'Something I build or craft')],
    },
    {
      id: 'aim',
      title: 'What would make you proud?',
      kind: 'single',
      options: [opt('finish', 'Finishing a project'), opt('habit', 'A steady creative habit'), opt('share', 'Sharing my work'), opt('improve', 'Getting better at my craft')],
    },
    {
      id: 'blockers',
      title: 'What slows you down?',
      hint: 'Pick as many as you like.',
      kind: 'multi',
      options: [opt('ideas', 'Running out of ideas'), opt('time', 'Finding the time'), opt('confidence', 'Doubting myself'), opt('finishing', 'Finishing things')],
    },
    { id: 'project', title: 'What is the project?', hint: 'Optional.', kind: 'text', optional: true, placeholder: 'e.g. a short story collection' },
  ],
  plan: (r) => {
    const craft = r.one('craft');
    const aim = r.one('aim');
    const blockers = r.many('blockers');
    const project = r.text('project');
    const word = craft === 'writing' ? 'write' : craft === 'art' ? 'draw or paint' : craft === 'music' ? 'play or compose' : craft === 'making' ? 'build' : 'create';

    const routines: RoutineDraft[] = [
      {
        name: 'Make time',
        tasks: [`Set a timer and ${word} for 25 minutes`, 'Keep going even if it is rough', 'Do not edit while you work', 'Write down where you stopped', 'Save or photograph what you made'],
      },
    ];
    if (aim === 'finish' || blockers.includes('finishing') || project) {
      routines.push({ name: 'Finish line', tasks: [`Take one clear step on ${or(project, 'your project')}`, 'List what is left to finish', 'Pick the smallest piece and do it', 'Cross one thing off the list', 'Set a date for the next milestone'] });
    }
    if (blockers.includes('ideas') || aim === 'improve') {
      routines.push({ name: 'Ideas and study', tasks: ['Collect 5 ideas in a notebook', 'Study one piece you admire', 'Copy a technique you liked', 'Try something unfamiliar', 'Note what you learned'] });
    }
    if (aim === 'share' || blockers.includes('confidence')) {
      routines.push({ name: 'Share it', tasks: ['Show one piece to a friend', 'Ask for one honest comment', 'Post or submit something small', 'Thank anyone who replied', 'Note what to improve next'] });
    }

    const titles: Record<string, string> = {
      finish: project ? `Finish ${project}` : 'Finish my creative project',
      habit: 'Make creating a daily habit',
      share: 'Share my work with the world',
      improve: 'Get better at my craft',
    };
    return {
      title: titles[aim ?? 'habit'] ?? 'Make my creative project',
      description: 'Small, regular creative sessions add up. Be kind to yourself.',
      routines: ensure(routines, [
        { name: 'Ideas and study', tasks: ['Collect 5 ideas', 'Study one piece you admire', 'Copy a technique', 'Try something unfamiliar', 'Note what you learned'] },
        { name: 'Finish line', tasks: ['Take one clear step', 'List what is left', 'Do the smallest piece', 'Cross off one thing', 'Set the next milestone'] },
        { name: 'Share it', tasks: ['Show one piece to a friend', 'Ask for a comment', 'Post something small', 'Thank anyone who replied', 'Note what to improve'] },
      ]),
    };
  },
};

/* ---------------------------------------------------------------- engine */

/** The niches in the order they are offered. */
export const NICHES: Niche[] = [career, business, health, fitness, diet, money, learning, creative];

export const nicheByKey = (key: Focus): Niche => NICHES.find((n) => n.key === key) ?? NICHES[0];

/** The most routines a single goal starts with: enough to cover the week, not so many it overwhelms. */
const MAX_ROUTINES = 4;

/** Whether a question has been answered well enough to move on. */
export const isAnswered = (question: GuidedQuestion, answers: Answers): boolean => {
  const a = answers[question.id];
  if (question.kind === 'text') return question.optional || (typeof a === 'string' && cleanText(a).length > 0);
  if (question.kind === 'multi') return true; // picking none is fine: the plan falls back to sensible defaults
  if (typeof a !== 'string' || !a) return false;
  if (a === 'other') {
    const typed = answers[`${question.id}_other`];
    return typeof typed === 'string' && cleanText(typed).length > 0;
  }
  return true;
};

export const COMMON_TIME_OPTIONS = TIME_OPTIONS;
export const COMMON_LENGTH_OPTIONS = LENGTH_OPTIONS;

/**
 * Builds the starter plan from a niche, its answers and the common answers.
 * Pure and instant. Routines are spread over the chosen days, and each carries
 * as many tasks as the time available allows.
 */
export const buildGuidedPlan = (key: Focus, answers: Answers, common: CommonAnswers): StarterPlan => {
  const niche = nicheByKey(key);
  const drafted = niche.plan(new AnswerReader(niche.questions, answers));
  const days = common.days.length > 0 ? common.days : [1, 3, 5];
  const count = Math.max(1, Math.min(MAX_ROUTINES, drafted.routines.length, days.length));
  const chosen = drafted.routines.slice(0, count);
  const spread = spreadOverDays(chosen.length, days);
  const perRoutine = tasksForMinutes(common.minutes);

  return {
    focus: niche.key,
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
export type PlanMaker = (key: Focus, answers: Answers, common: CommonAnswers) => Promise<StarterPlan>;

export const makePlanWithRules: PlanMaker = async (key, answers, common) => buildGuidedPlan(key, answers, common);
