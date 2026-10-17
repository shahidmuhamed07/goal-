import { Subcategory, TaskItem } from './types';
import { createSeries, sortWeekdays } from './recurrence';

/**
 * The first-run questions, and the plan they build.
 *
 * Answers go in; out come goals with weekly routines (and their tasks) already
 * written, so a new person lands on a plan instead of an empty screen. Pure:
 * nothing here touches React or Firestore.
 */

export type Focus =
  | 'diet'
  | 'fitness'
  | 'health'
  | 'career'
  | 'business'
  | 'money'
  | 'learning'
  | 'creative';

export interface FocusOption {
  key: Focus;
  label: string;
}

export const FOCUS_OPTIONS: FocusOption[] = [
  { key: 'diet', label: 'Eating better' },
  { key: 'fitness', label: 'Getting fitter' },
  { key: 'health', label: 'Sleep & wellbeing' },
  { key: 'career', label: 'Growing my career' },
  { key: 'business', label: 'Building a business' },
  { key: 'money', label: 'Managing money' },
  { key: 'learning', label: 'Learning a skill' },
  { key: 'creative', label: 'Creative projects' },
];

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

export const AGE_OPTIONS: ChoiceOption[] = [
  { value: 'under-25', label: 'Under 25' },
  { value: '25-34', label: '25 - 34' },
  { value: '35-44', label: '35 - 44' },
  { value: '45-60', label: '45 - 60' },
  { value: 'over-60', label: 'Over 60' },
];

export const EATING_OPTIONS: ChoiceOption[] = [
  { value: 'any', label: 'No particular style', hint: 'I eat a bit of everything' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'protein', label: 'High-protein' },
  { value: 'lowcarb', label: 'Low-carb' },
];

export const ACTIVITY_OPTIONS: ChoiceOption[] = [
  { value: 'rarely', label: 'Rarely', hint: 'Mostly sitting' },
  { value: 'light', label: '1 – 2 days a week' },
  { value: 'regular', label: '3 – 4 days a week' },
  { value: 'often', label: '5 or more days', hint: 'Already very active' },
];

export const TIME_OPTIONS: { minutes: number; label: string; hint: string }[] = [
  { minutes: 15, label: '15 minutes', hint: 'A quick daily habit' },
  { minutes: 30, label: '30 minutes', hint: 'Balanced and doable' },
  { minutes: 45, label: '45 minutes', hint: 'A solid session' },
  { minutes: 60, label: '1 hour or more', hint: 'All in' },
];

export const LENGTH_OPTIONS: { months: number; label: string }[] = [
  { months: 1, label: '1 month' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
];

export interface OnboardingAnswers {
  persona: 'client' | 'professional';
  focus: Focus[];
  age?: string;
  eating?: string;
  activity?: string;
  /** Weekdays the person can train or work on their goals, 0 = Sunday. */
  days: number[];
  minutes: number;
  months: number;
  /** Whether to write a starter plan into the new goals. */
  starter: boolean;
}

export interface StarterRoutine {
  name: string;
  weekdays: number[];
  tasks: string[];
}

export interface StarterPlan {
  /** What the plan is about. `custom` is a goal that fits none of the listed niches. */
  focus: Focus | 'custom';
  title: string;
  category: string;
  description: string;
  months: number;
  routines: StarterRoutine[];
}

interface Template {
  title: string;
  category: string;
  description: string;
  routines: { name: string; tasks: string[] }[];
}

const TEMPLATES: Record<Focus, Template> = {
  diet: {
    title: 'Eat well, feel great',
    category: 'Health',
    description: 'Simple weekly habits for steady, healthy eating.',
    routines: [
      {
        name: 'Plan & prep',
        tasks: [
          'Plan the week’s meals',
          'Grocery shop for fresh food',
          'Batch-cook lunches for the week',
          'Wash and chop vegetables',
          'Portion out healthy snacks',
        ],
      },
      {
        name: 'High-protein day',
        tasks: [
          'Protein with every meal',
          'A protein-rich snack',
          'Drink 2–3 litres of water',
          'Log what you ate',
          'Take a 10-minute walk after dinner',
        ],
      },
      {
        name: 'Veggie-forward day',
        tasks: [
          'Half of every plate is vegetables',
          'No sugary drinks',
          'Try one new vegetable',
          'Eat slowly, away from screens',
          'Go for an evening walk',
        ],
      },
    ],
  },
  fitness: {
    title: 'Get stronger and fitter',
    category: 'Fitness',
    description: 'A weekly training split you can actually keep up.',
    routines: [
      {
        name: 'Push day',
        tasks: [
          'Warm up for 5 minutes',
          'Bench or push-ups: 4 sets',
          'Shoulder press: 3 sets',
          'Triceps dips: 3 sets',
          'Cool down and stretch',
        ],
      },
      {
        name: 'Pull day',
        tasks: [
          'Warm up for 5 minutes',
          'Rows: 4 sets',
          'Pull-ups or pulldowns: 3 sets',
          'Biceps curls: 3 sets',
          'Cool down and stretch',
        ],
      },
      {
        name: 'Legs & core',
        tasks: [
          'Warm up for 5 minutes',
          'Squats: 4 sets',
          'Romanian deadlift: 3 sets',
          'Lunges: 3 sets',
          'Plank: 3 rounds',
        ],
      },
    ],
  },
  health: {
    title: 'Sleep better, feel better',
    category: 'Health',
    description: 'Small daily habits for energy, rest and calm.',
    routines: [
      {
        name: 'Wind-down evening',
        tasks: [
          'Screens off an hour before bed',
          'Dim the lights',
          'Write tomorrow’s top three',
          'In bed at the same time',
          'Five slow breaths',
        ],
      },
      {
        name: 'Move & breathe',
        tasks: [
          '8,000 steps',
          '10 minutes of stretching',
          '5 minutes of breathing',
          'Stand up every hour',
          'Get outside for fresh air',
        ],
      },
      {
        name: 'Morning reset',
        tasks: [
          'Drink water on waking',
          '10 minutes of daylight',
          'Note your energy and mood',
          'A proper breakfast',
          'Plan the day’s one priority',
        ],
      },
    ],
  },
  career: {
    title: 'Level up my career',
    category: 'Career',
    description: 'Focused time on the work that moves you forward.',
    routines: [
      {
        name: 'Deep work',
        tasks: [
          'Pick the one important task',
          'Phone away for a focused block',
          'Work in 25-minute sprints',
          'Write down what you finished',
          'Plan tomorrow’s first task',
        ],
      },
      {
        name: 'Skill building',
        tasks: [
          'Study or practise one skill',
          'Take notes on what you learned',
          'Apply it to a real task',
          'Ask for feedback',
          'Save a useful resource',
        ],
      },
      {
        name: 'Network & visibility',
        tasks: [
          'Message one person you admire',
          'Share something you worked on',
          'Update your profile or portfolio',
          'Follow up on an open conversation',
          'Note one win from this week',
        ],
      },
    ],
  },
  business: {
    title: 'Grow my business',
    category: 'Business',
    description: 'A weekly rhythm of selling, building and reviewing.',
    routines: [
      {
        name: 'Sales & outreach',
        tasks: [
          'Reach out to 5 new prospects',
          'Follow up with warm leads',
          'Ask a customer for feedback',
          'Post something useful',
          'Update your pipeline',
        ],
      },
      {
        name: 'Build & ship',
        tasks: [
          'Choose the one thing to ship',
          'Work on it without interruptions',
          'Test it with a real person',
          'Fix the biggest issue',
          'Release or share the update',
        ],
      },
      {
        name: 'Review & plan',
        tasks: [
          'Check the numbers',
          'What worked, what did not',
          'Pick next week’s top three',
          'Clear the admin backlog',
          'Celebrate one win',
        ],
      },
    ],
  },
  money: {
    title: 'Take charge of my money',
    category: 'Finance & Wealth',
    description: 'Weekly habits for spending, saving and investing.',
    routines: [
      {
        name: 'Track spending',
        tasks: [
          'Log today’s expenses',
          'Check subscriptions',
          'Review the weekly budget',
          'Cancel one thing you do not use',
          'Note one smart money choice',
        ],
      },
      {
        name: 'Save & invest',
        tasks: [
          'Move money to savings',
          'Top up the investment plan',
          'Check the emergency fund',
          'Review one debt payment',
          'Read about one money topic',
        ],
      },
      {
        name: 'Money review',
        tasks: [
          'Check account balances',
          'Compare spending with the plan',
          'Adjust next week’s budget',
          'File receipts and bills',
          'Set one money goal for the week',
        ],
      },
    ],
  },
  learning: {
    title: 'Learn a new skill',
    category: 'Learning & Skills',
    description: 'Short, regular practice that adds up.',
    routines: [
      {
        name: 'Study block',
        tasks: [
          'Pick today’s lesson',
          'Study without distractions',
          'Take notes in your own words',
          'Explain it out loud',
          'Mark what is still unclear',
        ],
      },
      {
        name: 'Practice',
        tasks: [
          'Do a hands-on exercise',
          'Build something small',
          'Fix one mistake',
          'Try a harder version',
          'Save what you made',
        ],
      },
      {
        name: 'Review & notes',
        tasks: [
          'Review last week’s notes',
          'Quiz yourself',
          'Fill the gaps you found',
          'Plan next week’s topics',
          'Share what you learned',
        ],
      },
    ],
  },
  creative: {
    title: 'Finish my creative project',
    category: 'Creative Writing',
    description: 'A steady weekly rhythm of making, editing and inspiration.',
    routines: [
      {
        name: 'Make',
        tasks: [
          'Set a timer and start',
          'Write or create before you judge',
          'Hit today’s small target',
          'Save your work',
          'Note where to begin tomorrow',
        ],
      },
      {
        name: 'Edit & improve',
        tasks: [
          'Re-read yesterday’s work',
          'Cut what does not help',
          'Strengthen one weak part',
          'Get one piece of feedback',
          'Save a clean version',
        ],
      },
      {
        name: 'Read & get inspired',
        tasks: [
          'Read or watch something great',
          'Note what you admire',
          'Collect three ideas',
          'Try one new technique',
          'Share a small piece',
        ],
      },
    ],
  },
};

/** Days that suit someone when they have not picked their own. */
export const defaultDays = (activity?: string): number[] => {
  switch (activity) {
    case 'often':
      return [1, 2, 4, 5, 6];
    case 'regular':
      return [1, 3, 5];
    default:
      return [2, 4];
  }
};

/** How many tasks each routine gets for the time someone can give. */
export const tasksForMinutes = (minutes: number): number =>
  minutes <= 15 ? 2 : minutes <= 30 ? 3 : minutes <= 45 ? 4 : 5;

/** What the eating style changes in the diet plan. */
const dietTweak = (eating?: string): string | null => {
  switch (eating) {
    case 'vegetarian':
      return 'Protein with every meal (eggs, paneer, lentils)';
    case 'vegan':
      return 'Protein with every meal (tofu, beans, lentils)';
    case 'lowcarb':
      return 'Swap one starchy side for greens';
    default:
      return null;
  }
};

/**
 * Spreads routines over the chosen days so every day has something and no
 * routine is left without one: routine i takes days i, i + k, i + 2k …
 */
export const spreadOverDays = (routineCount: number, days: number[]): number[][] => {
  const sorted = sortWeekdays(days);
  if (sorted.length === 0) return Array.from({ length: routineCount }, () => []);
  return Array.from({ length: routineCount }, (_, i) => {
    if (sorted.length < routineCount) return [sorted[i % sorted.length]];
    return sorted.filter((_day, index) => index % routineCount === i);
  });
};

const MAX_GOALS = 3;

/** One goal with weekly routines for each thing the person wants to work on. */
export const buildStarterPlans = (answers: OnboardingAnswers): StarterPlan[] => {
  const focuses = answers.focus.slice(0, MAX_GOALS);
  const days = answers.days.length > 0 ? answers.days : defaultDays(answers.activity);
  const perRoutine = tasksForMinutes(answers.minutes);
  // With several goals each takes fewer routines, so the week stays realistic.
  const routinesPerGoal = focuses.length > 1 ? 2 : 3;

  return focuses.map((focus) => {
    const template = TEMPLATES[focus];
    const chosen = template.routines.slice(0, routinesPerGoal);
    const spread = spreadOverDays(chosen.length, days);

    const routines: StarterRoutine[] = chosen.map((routine, index) => {
      const tasks = routine.tasks.slice(0, perRoutine);
      const tweak = focus === 'diet' && routine.name === 'High-protein day' ? dietTweak(answers.eating) : null;
      if (tweak) tasks[0] = tweak;
      return { name: routine.name, weekdays: spread[index], tasks };
    });

    return {
      focus,
      title: template.title,
      category: template.category,
      description: template.description,
      months: answers.months,
      routines,
    };
  });
};

/**
 * Writes a plan's routines onto the calendar: one dated subcategory per matching
 * day from `fromDate` to `endDate`, each carrying the routine's tasks.
 */
export const materializePlan = (
  plan: StarterPlan,
  { fromDate, endDate, seed = Date.now() }: { fromDate: string; endDate: string; seed?: number }
): { subcategories: Subcategory[]; tasks: TaskItem[] } => {
  let subcategories: Subcategory[] = [];
  const tasks: TaskItem[] = [];

  plan.routines.forEach((routine, routineIndex) => {
    if (routine.weekdays.length === 0) return;
    const created = createSeries({
      subcategories,
      tasks,
      name: routine.name,
      days: routine.weekdays,
      fromDate,
      endDate,
      editorRole: null,
      seed: seed + routineIndex,
    });
    if (!created) return;

    created.subcategories.slice(subcategories.length).forEach((sub, subIndex) => {
      routine.tasks.forEach((text, taskIndex) => {
        tasks.push({
          id: `t-${seed + routineIndex}-${subIndex}-${taskIndex}`,
          text,
          priority: taskIndex === 0 ? 'high' : 'medium',
          completed: false,
          date: sub.date as string,
          subcategoryId: sub.id,
        });
      });
    });
    subcategories = created.subcategories;
  });

  return { subcategories, tasks };
};
