/**
 * Where the bottom bar and the back button can take someone. Pure functions, so
 * the rules are tested without opening the app.
 */
export type TabKey = 'dashboard' | 'today' | 'detail' | 'connect' | 'professional';

/** The first screen: Today, because that is what people open the app to do. */
export const HOME_TAB: TabKey = 'today';

/** The order the tabs appear in the bar, and the order a swipe moves through them. */
export function tabOrder(isOwner: boolean): Array<'today' | 'dashboard' | 'connect' | 'professional'> {
  const tabs: Array<'today' | 'dashboard' | 'connect' | 'professional'> = ['today', 'dashboard', 'connect'];
  if (isOwner) tabs.push('professional');
  return tabs;
}

/**
 * Where the back button goes. A goal page goes back to the Goals list, any other
 * tab goes back to Today, and null means "already home" (ask before leaving).
 */
export function backTarget(tab: TabKey, hasGoalOpen: boolean): TabKey | null {
  if (tab === 'detail' || hasGoalOpen) return 'dashboard';
  if (tab !== HOME_TAB) return HOME_TAB;
  return null;
}
