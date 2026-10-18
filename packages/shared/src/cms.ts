/**
 * The content people manage in the admin dashboard.
 *
 * These shapes are the contract between three programs: the admin writes them,
 * the API stores and serves them, and the app reads them. Change one here and
 * TypeScript shows every place in every program that needs to follow.
 */

/** Draft items are only visible in the admin; published items can go live. */
export type PublishStatus = 'draft' | 'published';

/** Who sees an item. `owners` plan their own goals; `professionals` coach others. */
export type Audience = 'everyone' | 'owners' | 'professionals';

/** The accent colour of a banner or popup. */
export type Tone = 'brand' | 'pink' | 'neutral';

export interface Option<T extends string> {
  value: T;
  label: string;
  hint: string;
}

/** Fields every piece of content has. */
export interface ContentMeta {
  id: string;
  status: PublishStatus;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Optional window in which an item may be shown. ISO timestamps. */
export interface Schedule {
  startsAt?: string;
  endsAt?: string;
}

/* ------------------------------------------------------------------ banners */

/** The places in the app where a banner can appear. */
export const BANNER_PLACEMENTS: Option<BannerPlacement>[] = [
  { value: 'announcement-bar', label: 'Announcement bar', hint: 'A thin strip under the header, on every screen.' },
  { value: 'goals-banner', label: 'Goals screen', hint: 'A card above the goal list.' },
  { value: 'today-card', label: 'Today screen', hint: 'A card under the day’s progress bar.' },
  { value: 'login-notice', label: 'Login screen', hint: 'A message on the sign-in screen, before anyone logs in.' },
];

export type BannerPlacement = 'announcement-bar' | 'goals-banner' | 'today-card' | 'login-notice';

export interface Banner extends ContentMeta, Schedule {
  /** Internal name, only shown in the admin. */
  name: string;
  placement: BannerPlacement;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  tone: Tone;
  audience: Audience;
  /** Higher shows first when several banners share a placement. */
  priority: number;
}

/* ------------------------------------------------------------------- popups */

/** How often the same person sees a popup. */
export type PopupFrequency = 'once' | 'daily' | 'every-visit';

export const POPUP_FREQUENCIES: Option<PopupFrequency>[] = [
  { value: 'once', label: 'Once per person', hint: 'Never shown again after they close it.' },
  { value: 'daily', label: 'Once a day', hint: 'Comes back the next day until the end date.' },
  { value: 'every-visit', label: 'Every visit', hint: 'Use sparingly. Can feel pushy.' },
];

/** A window that opens over the app on start, such as "What's new" or an offer. */
export interface Popup extends ContentMeta, Schedule {
  name: string;
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  tone: Tone;
  audience: Audience;
  frequency: PopupFrequency;
}

/* -------------------------------------------------------------------- pages */

/** One building block of a page. */
export type PageBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; alt: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'divider' };

export type PageBlockType = PageBlock['type'];

export const PAGE_BLOCK_TYPES: Option<PageBlockType>[] = [
  { value: 'heading', label: 'Heading', hint: 'A large title for a section.' },
  { value: 'text', label: 'Text', hint: 'A paragraph.' },
  { value: 'image', label: 'Image', hint: 'A picture from a web address.' },
  { value: 'button', label: 'Button', hint: 'A link people can tap.' },
  { value: 'divider', label: 'Divider', hint: 'A thin line between sections.' },
];

/** A new window in the app, built from blocks. Opened from a banner or a tab. */
export interface Page extends ContentMeta {
  /** URL-friendly name, unique, such as `summer-challenge`. */
  slug: string;
  title: string;
  audience: Audience;
  blocks: PageBlock[];
}

/* ------------------------------------------------------------ plan templates */

export type PlanFocus =
  | 'diet'
  | 'fitness'
  | 'health'
  | 'career'
  | 'business'
  | 'money'
  | 'learning'
  | 'creative';

export const PLAN_FOCUSES: Option<PlanFocus>[] = [
  { value: 'diet', label: 'Eating better', hint: 'Meal plans and habits.' },
  { value: 'fitness', label: 'Getting fitter', hint: 'Training splits.' },
  { value: 'health', label: 'Sleep & wellbeing', hint: 'Sleep, stress, recovery.' },
  { value: 'career', label: 'Growing my career', hint: 'Skills and visibility.' },
  { value: 'business', label: 'Building a business', hint: 'Sales and operations.' },
  { value: 'money', label: 'Managing money', hint: 'Budgeting and saving.' },
  { value: 'learning', label: 'Learning a skill', hint: 'Practice routines.' },
  { value: 'creative', label: 'Creative projects', hint: 'Writing, art, music.' },
];

export interface RoutineTemplate {
  id: string;
  name: string;
  /** Suggested weekdays, 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  tasks: string[];
}

/** A starter plan the first-run questions can offer. Replaces the lists in the app's code. */
export interface PlanTemplate extends ContentMeta {
  name: string;
  focus: PlanFocus;
  /** Optional eating style this plan suits, such as `vegetarian`. Empty means any. */
  eating?: string;
  /** Goal title the person ends up with. */
  title: string;
  category: string;
  description: string;
  routines: RoutineTemplate[];
}

/* ---------------------------------------------------------- what the app gets */

/** The four kinds of content the admin manages. Used as route and collection names. */
export const CONTENT_COLLECTIONS = ['banners', 'popups', 'pages', 'plans'] as const;
export type ContentCollection = (typeof CONTENT_COLLECTIONS)[number];

/**
 * A banner as the app receives it: only what is needed to draw it. Internal
 * fields (name, status, dates, audience) stay on the server.
 */
export type PublicBanner = Pick<
  Banner,
  'id' | 'placement' | 'title' | 'body' | 'imageUrl' | 'ctaLabel' | 'ctaUrl' | 'tone' | 'priority'
>;

/** A popup as the app receives it. `frequency` lets the app decide whether to show it again. */
export type PublicPopup = Pick<Popup, 'id' | 'title' | 'body' | 'imageUrl' | 'ctaLabel' | 'ctaUrl' | 'tone' | 'frequency'>;

/** A page as the app receives it: its address, title and blocks. */
export type PublicPage = Pick<Page, 'id' | 'slug' | 'title' | 'blocks'>;

/** The reply of the public "what is live right now" route. */
export interface LiveContent {
  /** The server's clock, so the app can tell how fresh this is. ISO. */
  serverTime: string;
  banners: PublicBanner[];
  /** Newest first. An older API may leave this out. */
  popups?: PublicPopup[];
  /** An older API may leave this out. */
  pages?: PublicPage[];
}
