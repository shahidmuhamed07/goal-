import type { Audience, PublishStatus, Schedule } from './cms';

/** What the app knows about the person looking at it. */
export interface Viewer {
  /** `owners` plan their own goals; `professionals` work in clients' workspaces. */
  role: 'owner' | 'professional';
}

interface Showable extends Schedule {
  status: PublishStatus;
  audience?: Audience;
}

/** Is `item` inside its start and end dates at `now`? Missing dates mean "no limit". */
export function isInWindow(item: Schedule, now: Date): boolean {
  const t = now.getTime();
  if (item.startsAt && t < new Date(item.startsAt).getTime()) return false;
  if (item.endsAt && t > new Date(item.endsAt).getTime()) return false;
  return true;
}

/** Does this audience include the viewer? */
export function matchesAudience(audience: Audience | undefined, viewer: Viewer): boolean {
  if (!audience || audience === 'everyone') return true;
  return audience === (viewer.role === 'owner' ? 'owners' : 'professionals');
}

/**
 * Should this item be on screen right now? Published, inside its dates, and
 * meant for this viewer. The app and the API both use this one rule, so the
 * admin's "live now" count always agrees with what people actually see.
 */
export function isLive(item: Showable, now: Date, viewer?: Viewer): boolean {
  if (item.status !== 'published') return false;
  if (!isInWindow(item, now)) return false;
  return viewer ? matchesAudience(item.audience, viewer) : true;
}

export type Lifecycle = 'draft' | 'scheduled' | 'live' | 'ended';

/** The state to show in a list: draft, waiting for its start date, live, or finished. */
export function lifecycleOf(item: Showable, now: Date): Lifecycle {
  if (item.status !== 'published') return 'draft';
  const t = now.getTime();
  if (item.startsAt && t < new Date(item.startsAt).getTime()) return 'scheduled';
  if (item.endsAt && t > new Date(item.endsAt).getTime()) return 'ended';
  return 'live';
}
