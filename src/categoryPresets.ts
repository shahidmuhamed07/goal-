export interface CategoryPresetConfig {
  categoryName: string;
  presetGroupLabel: string;
  placeholder: string;
  subcategories: string[];
  suggestedTasks: { text: string; priority: 'high' | 'medium' | 'low'; defaultSub?: string }[];
  contextDescription: string;
  accentColor: string;
}

export const CATEGORY_PRESETS: Record<string, CategoryPresetConfig> = {
  'Finance & Wealth': {
    categoryName: 'Finance & Wealth',
    presetGroupLabel: 'Financial Focus Presets',
    placeholder: 'New financial routine (e.g. Budget Audit, Investment DCA, Debt Payoff)...',
    subcategories: [
      'Budget & Expense Audit',
      'Investment Portfolio Review',
      'Savings & Emergency Fund',
      'Debt Payoff Milestone',
      'Tax & Retirement Strategy',
      'Net Worth Tracking',
    ],
    suggestedTasks: [
      { text: 'Log and categorize daily receipts and expenses', priority: 'high', defaultSub: 'Budget & Expense Audit' },
      { text: 'Review recurring subscriptions and cancel unused services', priority: 'medium', defaultSub: 'Budget & Expense Audit' },
      { text: 'Execute scheduled dollar-cost averaging (DCA) index fund transfer', priority: 'high', defaultSub: 'Investment Portfolio Review' },
      { text: 'Transfer weekly allocation to high-yield savings account', priority: 'medium', defaultSub: 'Savings & Emergency Fund' },
      { text: 'Check debt payoff velocity and extra principal payment', priority: 'high', defaultSub: 'Debt Payoff Milestone' },
    ],
    contextDescription: 'Building financial freedom, increasing savings rate, and monitoring investments.',
    accentColor: 'emerald',
  },

  'Fitness': {
    categoryName: 'Fitness',
    presetGroupLabel: 'Workout Routine Presets',
    placeholder: 'New training session (e.g. Chest & Triceps, Legs & Core, HIIT)...',
    subcategories: [
      'Chest & Triceps',
      'Back & Biceps',
      'Legs & Glutes',
      'Shoulders & Abs',
      'Cardio & Conditioning',
      'Mobility & Active Recovery',
    ],
    suggestedTasks: [
      { text: 'Dumbbell Bench Press — 4 sets of 8-10 reps', priority: 'high', defaultSub: 'Chest & Triceps' },
      { text: 'Barbell Romanian Deadlifts — 3 sets of 10 reps', priority: 'high', defaultSub: 'Legs & Glutes' },
      { text: '25-minute zone-2 incline treadmill walk', priority: 'medium', defaultSub: 'Cardio & Conditioning' },
      { text: '15-minute foam rolling and hip mobility stretches', priority: 'low', defaultSub: 'Mobility & Active Recovery' },
      { text: 'Log daily protein target (150g minimum)', priority: 'medium', defaultSub: 'Cardio & Conditioning' },
    ],
    contextDescription: 'Targeting progressive overload, physical conditioning, and muscle endurance.',
    accentColor: 'indigo',
  },

  'Health': {
    categoryName: 'Health',
    presetGroupLabel: 'Wellness & Health Protocols',
    placeholder: 'New health protocol (e.g. Nutrition, Hydration, Sleep Hygiene)...',
    subcategories: [
      'Hydration & Clean Eating',
      'Sleep Hygiene & Circadian Rhythm',
      'Daily Steps & Mobility',
      'Mindfulness & Breathwork',
      'Supplements & Vital Signs',
      'Medical & Recovery Check',
    ],
    suggestedTasks: [
      { text: 'Drink 1L filtered water upon waking before caffeine', priority: 'high', defaultSub: 'Hydration & Clean Eating' },
      { text: 'Prepare high-fiber lunch packed with leafy greens and lean protein', priority: 'medium', defaultSub: 'Hydration & Clean Eating' },
      { text: 'Hit 8,000 to 10,000 baseline daily walking steps', priority: 'high', defaultSub: 'Daily Steps & Mobility' },
      { text: 'Dim blue screens 1 hour before bed and sleep 8 hours', priority: 'medium', defaultSub: 'Sleep Hygiene & Circadian Rhythm' },
      { text: '10-minute physiological sigh breathwork session', priority: 'low', defaultSub: 'Mindfulness & Breathwork' },
    ],
    contextDescription: 'Optimizing physical recovery, metabolic health, and daily vitality.',
    accentColor: 'teal',
  },

  'Career': {
    categoryName: 'Career',
    presetGroupLabel: 'Career Progression Presets',
    placeholder: 'New career action (e.g. Project Sprint, Portfolio, Interview Prep)...',
    subcategories: [
      'Project Delivery Sprint',
      'Resume & Portfolio Updates',
      'Interview Prep & Case Studies',
      'Professional Networking',
      'Industry Certification',
      'Leadership & Public Speaking',
    ],
    suggestedTasks: [
      { text: 'Finish and merge high-impact pull request / project deliverable', priority: 'high', defaultSub: 'Project Delivery Sprint' },
      { text: 'Connect with 2 industry leaders or former colleagues on LinkedIn', priority: 'medium', defaultSub: 'Professional Networking' },
      { text: 'Solve 1 complex system design problem or behavioral case', priority: 'high', defaultSub: 'Interview Prep & Case Studies' },
      { text: 'Update portfolio case study with measurable business impact metrics', priority: 'medium', defaultSub: 'Resume & Portfolio Updates' },
    ],
    contextDescription: 'Advancing career trajectory, high-visibility outputs, and executive presence.',
    accentColor: 'blue',
  },

  'Business': {
    categoryName: 'Business',
    presetGroupLabel: 'Business & Growth Presets',
    placeholder: 'New business sprint (e.g. Client Pipeline, Product MVP, Marketing)...',
    subcategories: [
      'Client Outreach & Pipeline',
      'Product Development & MVP',
      'Marketing & Content Creation',
      'Revenue, Invoicing & Cashflow',
      'Customer Support & Retention',
      'Operational Systems & SOPs',
    ],
    suggestedTasks: [
      { text: 'Send 10 personalized cold/warm outreach proposals to ideal clients', priority: 'high', defaultSub: 'Client Outreach & Pipeline' },
      { text: 'Follow up on pending client proposals and review outstanding invoices', priority: 'high', defaultSub: 'Revenue, Invoicing & Cashflow' },
      { text: 'Publish 1 insightful thought leadership breakdown or case study', priority: 'medium', defaultSub: 'Marketing & Content Creation' },
      { text: 'Review user feedback and prioritize next sprint features', priority: 'medium', defaultSub: 'Product Development & MVP' },
    ],
    contextDescription: 'Scaling enterprise value, customer acquisition, and repeatable systems.',
    accentColor: 'purple',
  },

  'Learning & Skills': {
    categoryName: 'Learning & Skills',
    presetGroupLabel: 'Study & Mastery Presets',
    placeholder: 'New study block (e.g. Course Lecture, Coding Exercises, Spaced Repetition)...',
    subcategories: [
      'Course Lectures & Notes',
      'Hands-On Coding & Practice',
      'Spaced Repetition & Flashcards',
      'Textbook Deep Reading',
      'Capstone Project Build',
      'Peer Discussion & Review',
    ],
    suggestedTasks: [
      { text: 'Complete 1 focused module lecture and summarize 3 core takeaways', priority: 'high', defaultSub: 'Course Lectures & Notes' },
      { text: 'Build functional code exercise without referring to solutions', priority: 'high', defaultSub: 'Hands-On Coding & Practice' },
      { text: 'Review 30 Anki/spaced repetition flashcards', priority: 'medium', defaultSub: 'Spaced Repetition & Flashcards' },
      { text: 'Read 25 pages of foundational reference manual', priority: 'low', defaultSub: 'Textbook Deep Reading' },
    ],
    contextDescription: 'Deliberate skill mastery, concept synthesis, and active recall.',
    accentColor: 'indigo',
  },

  'Creative Writing': {
    categoryName: 'Creative Writing',
    presetGroupLabel: 'Creative Studio Presets',
    placeholder: 'New writing block (e.g. Word Sprint, Chapter Outline, Scene Editing)...',
    subcategories: [
      'Daily Word Count Sprint',
      'Chapter & Scene Outline',
      'Character Arcs & Lore',
      'Editing & Dialogue Polish',
      'Beta Reader Feedback Review',
      'Query Letters & Submission',
    ],
    suggestedTasks: [
      { text: 'Write 800 unedited words for current chapter scene', priority: 'high', defaultSub: 'Daily Word Count Sprint' },
      { text: 'Outline emotional beats and conflict for next chapter transition', priority: 'medium', defaultSub: 'Chapter & Scene Outline' },
      { text: 'Line-edit previous scene for sensory detail and pacing', priority: 'medium', defaultSub: 'Editing & Dialogue Polish' },
    ],
    contextDescription: 'Fostering narrative consistency, daily word velocity, and artistic flow.',
    accentColor: 'violet',
  },

  'Personal Development': {
    categoryName: 'Personal Development',
    presetGroupLabel: 'Habit & Growth Presets',
    placeholder: 'New habit routine (e.g. Morning Clarity, Deep Work Block, Journaling)...',
    subcategories: [
      'Morning Clarity Routine',
      'Deep Work Focus Block',
      'Mindfulness & Journaling',
      'Reading & Knowledge Absorption',
      'Digital Detox & Walks',
      'Evening Reflection & Shutdown',
    ],
    suggestedTasks: [
      { text: '10-minute morning meditation and daily priority intention setting', priority: 'high', defaultSub: 'Morning Clarity Routine' },
      { text: '90-minute uninterrupted deep work block with phone in airplane mode', priority: 'high', defaultSub: 'Deep Work Focus Block' },
      { text: 'Write 1 page in evening journal reflecting on wins and lessons', priority: 'medium', defaultSub: 'Evening Reflection & Shutdown' },
      { text: 'Read 20 pages of inspiring book before bed', priority: 'low', defaultSub: 'Reading & Knowledge Absorption' },
    ],
    contextDescription: 'Cultivating mindfulness, cognitive discipline, and balanced daily habits.',
    accentColor: 'amber',
  },
};

export const getCategoryPresets = (category?: string, title?: string): CategoryPresetConfig => {
  const normCat = (category || '').trim();
  const normTitle = (title || '').toLowerCase();

  // Direct match
  if (CATEGORY_PRESETS[normCat]) {
    return CATEGORY_PRESETS[normCat];
  }

  // Heuristic match based on category or title keywords
  if (normCat.toLowerCase().includes('finance') || normCat.toLowerCase().includes('wealth') || normTitle.includes('money') || normTitle.includes('invest') || normTitle.includes('saving') || normTitle.includes('debt') || normTitle.includes('budget')) {
    return CATEGORY_PRESETS['Finance & Wealth'];
  }

  if (normCat.toLowerCase().includes('fit') || normTitle.includes('gym') || normTitle.includes('workout') || normTitle.includes('lift') || normTitle.includes('run') || normTitle.includes('sport') || normTitle.includes('muscle')) {
    return CATEGORY_PRESETS['Fitness'];
  }

  if (normCat.toLowerCase().includes('health') || normTitle.includes('diet') || normTitle.includes('nutrition') || normTitle.includes('sleep') || normTitle.includes('meditation')) {
    return CATEGORY_PRESETS['Health'];
  }

  if (normCat.toLowerCase().includes('career') || normTitle.includes('job') || normTitle.includes('promotion') || normTitle.includes('interview')) {
    return CATEGORY_PRESETS['Career'];
  }

  if (normCat.toLowerCase().includes('business') || normTitle.includes('startup') || normTitle.includes('sales') || normTitle.includes('client') || normTitle.includes('revenue')) {
    return CATEGORY_PRESETS['Business'];
  }

  if (normCat.toLowerCase().includes('learn') || normCat.toLowerCase().includes('skill') || normTitle.includes('study') || normTitle.includes('code') || normTitle.includes('exam')) {
    return CATEGORY_PRESETS['Learning & Skills'];
  }

  if (normCat.toLowerCase().includes('writ') || normTitle.includes('book') || normTitle.includes('novel') || normTitle.includes('story')) {
    return CATEGORY_PRESETS['Creative Writing'];
  }

  // Fallback to Personal Development
  return CATEGORY_PRESETS['Personal Development'];
};
