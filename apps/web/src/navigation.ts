/**
 * Where the bottom bar and the back button can take someone. Pure functions, so
 * the rules are tested without opening the app.
 */
export type TabKey = 'dashboard' | 'today' | 'detail' | 'connect' | 'professional';

/** The first screen: the Goals list, because the goals are what everything else is about. */
export const HOME_TAB: TabKey = 'dashboard';

/** The order the tabs appear in the bar, and the order a swipe moves through them. */
export function tabOrder(isOwner: boolean): Array<'dashboard' | 'today' | 'connect' | 'professional'> {
  const tabs: Array<'dashboard' | 'today' | 'connect' | 'professional'> = ['dashboard', 'today', 'connect'];
  if (isOwner) tabs.push('professional');
  return tabs;
}

/**
 * Where the back button goes. A goal page goes back to the Goals list (home), any
 * other tab goes back to Goals, and null means "already home" (ask before leaving).
 */
export function backTarget(tab: TabKey, hasGoalOpen: boolean): TabKey | null {
  if (tab === 'detail' || hasGoalOpen) return 'dashboard';
  if (tab !== HOME_TAB) return HOME_TAB;
  return null;
}
