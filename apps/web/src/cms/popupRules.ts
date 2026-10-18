import type { PublicPopup } from '@goalpath/shared';

/** The day each popup was last closed, by popup id ("YYYY-MM-DD" on the person's calendar). */
export type PopupMemory = Record<string, string>;

/**
 * The one popup to show now, or null. `once` never returns after it was closed,
 * `daily` comes back the next day, `every-visit` shows once per visit (the app
 * passes the ones already closed in this visit as `closedThisVisit`). Only one
 * popup is shown at a time, newest first, so nobody is stacked with windows.
 */
export const pickPopup = (
  popups: PublicPopup[],
  memory: PopupMemory,
  today: string,
  closedThisVisit: string[]
): PublicPopup | null =>
  popups.find((popup) => {
    if (closedThisVisit.includes(popup.id)) return false;
    const lastClosed = memory[popup.id];
    if (popup.frequency === 'once') return !lastClosed;
    if (popup.frequency === 'daily') return lastClosed !== today;
    return true;
  }) ?? null;
