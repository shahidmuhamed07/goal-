/** A short unique id such as `ban_3f9a1c2e`. The prefix makes ids readable in logs. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/** `Summer Challenge!` becomes `summer-challenge`. Used for page addresses. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
