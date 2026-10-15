const pad = (n: number) => String(n).padStart(2, '0');

/** ISO string → the `YYYY-MM-DDTHH:mm` an `<input type="datetime-local">` needs, in local time. */
export function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The reverse: a local datetime-local value → ISO, or undefined when empty. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** `Oct 14, 3:30 PM` */
export function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** `Oct 14 → Oct 31`, `From Oct 14`, `Until Oct 31` or `No dates`. */
export function formatWindow(startsAt?: string, endsAt?: string): string {
  if (startsAt && endsAt) return `${formatWhen(startsAt)} → ${formatWhen(endsAt)}`;
  if (startsAt) return `From ${formatWhen(startsAt)}`;
  if (endsAt) return `Until ${formatWhen(endsAt)}`;
  return 'No dates';
}

/** `3 minutes ago`, `2 days ago`. */
export function timeAgo(iso: string, now = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
