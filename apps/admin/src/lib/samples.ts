import type { Banner, Page, PlanTemplate, Popup } from '@goalpath/shared';

/** Sample content so every screen has something to show on first open. */
export interface SampleSet {
  banners: Banner[];
  popups: Popup[];
  pages: Page[];
  plans: PlanTemplate[];
}

const DAY = 24 * 60 * 60 * 1000;

export function buildSamples(now = new Date()): SampleSet {
  const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * DAY).toISOString();
  const stamp = { createdAt: iso(-7), updatedAt: iso(-2) };

  const banners: Banner[] = [
    {
      id: 'ban_welcome',
      name: 'Welcome offer',
      placement: 'goals-banner',
      title: 'Plan your first month free of clutter',
      body: 'Start from a ready-made routine and change anything you like.',
      ctaLabel: 'See starter plans',
      ctaUrl: '/pages/starter-plans',
      tone: 'brand',
      audience: 'owners',
      priority: 10,
      status: 'published',
      startsAt: iso(-3),
      endsAt: iso(25),
      ...stamp,
    },
    {
      id: 'ban_maintenance',
      name: 'Maintenance notice',
      placement: 'announcement-bar',
      title: 'Short maintenance on Sunday, 2:00 to 2:30 AM',
      tone: 'pink',
      audience: 'everyone',
      priority: 50,
      status: 'published',
      startsAt: iso(2),
      endsAt: iso(4),
      ...stamp,
    },
    {
      id: 'ban_tip',
      name: 'Hydration tip',
      placement: 'today-card',
      title: 'Drink a glass of water before each meal',
      body: 'A small habit that makes the rest of the day easier.',
      tone: 'neutral',
      audience: 'everyone',
      priority: 1,
      status: 'published',
      ...stamp,
    },
    {
      id: 'ban_pro',
      name: 'Coaches: client reports',
      placement: 'goals-banner',
      title: 'Weekly client reports are coming',
      body: 'Tell us what you would want in them.',
      tone: 'pink',
      audience: 'professionals',
      priority: 5,
      status: 'draft',
      ...stamp,
    },
  ];

  const popups: Popup[] = [
    {
      id: 'pop_whatsnew',
      name: 'What’s new: weekly routines',
      title: 'Routines now repeat every week',
      body: 'Set “Chest day” once and it appears every Tuesday and Thursday.',
      ctaLabel: 'Try it',
      ctaUrl: '/',
      tone: 'brand',
      audience: 'owners',
      frequency: 'once',
      status: 'published',
      startsAt: iso(-1),
      endsAt: iso(14),
      ...stamp,
    },
    {
      id: 'pop_challenge',
      name: 'Summer challenge teaser',
      title: 'A 30-day challenge starts soon',
      body: 'Get ready to join thousands of others.',
      tone: 'pink',
      audience: 'everyone',
      frequency: 'daily',
      status: 'draft',
      ...stamp,
    },
  ];

  const pages: Page[] = [
    {
      id: 'page_starter',
      slug: 'starter-plans',
      title: 'Starter plans',
      audience: 'everyone',
      status: 'published',
      blocks: [
        { id: 'b1', type: 'heading', text: 'Pick a plan to begin' },
        { id: 'b2', type: 'text', text: 'Each plan is a week of routines you can edit. Start small, then build.' },
        { id: 'b3', type: 'divider' },
        { id: 'b4', type: 'button', label: 'Create my plan', url: '/' },
      ],
      ...stamp,
    },
  ];

  const plans: PlanTemplate[] = [
    {
      id: 'plan_diet_any',
      name: 'Eat well: balanced',
      focus: 'diet',
      title: 'Eat well, feel great',
      category: 'Health',
      description: 'Simple weekly habits for steady, healthy eating.',
      routines: [
        { id: 'r1', name: 'Plan & prep', weekdays: [1, 5], tasks: ['Plan the week’s meals', 'Grocery shop for fresh food', 'Batch-cook lunches'] },
        { id: 'r2', name: 'High-protein day', weekdays: [3], tasks: ['Protein with every meal', 'A protein-rich snack', 'Log what you ate'] },
      ],
      status: 'published',
      ...stamp,
    },
    {
      id: 'plan_fit_any',
      name: 'Get fitter: push and pull',
      focus: 'fitness',
      title: 'Get stronger and fitter',
      category: 'Fitness',
      description: 'A weekly training split you can actually keep up.',
      routines: [
        { id: 'r3', name: 'Push day', weekdays: [1, 5], tasks: ['Warm up for 5 minutes', 'Bench or push-ups: 4 sets', 'Shoulder press: 3 sets'] },
        { id: 'r4', name: 'Pull day', weekdays: [3], tasks: ['Warm up for 5 minutes', 'Rows: 4 sets', 'Pull-ups or pulldowns: 3 sets'] },
      ],
      status: 'published',
      ...stamp,
    },
  ];

  return { banners, popups, pages, plans };
}
