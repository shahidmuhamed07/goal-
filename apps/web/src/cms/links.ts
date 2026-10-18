/** Where a banner, popup or page button leads. */
export type CmsLink = { kind: 'page'; slug: string } | { kind: 'web'; href: string };

/**
 * Reads a link the admin typed. `/pages/summer` opens the admin's page "summer"
 * inside the app; a full web address opens in a new tab. Anything else
 * (including `javascript:`) is ignored, so a typo can never become a button.
 */
export function parseCmsLink(url?: string): CmsLink | null {
  const value = (url ?? '').trim();
  if (!value) return null;
  const page = /^\/pages\/([a-z0-9][a-z0-9-]*)\/?$/i.exec(value);
  if (page) return { kind: 'page', slug: page[1].toLowerCase() };
  return /^https?:\/\//i.test(value) ? { kind: 'web', href: value } : null;
}
