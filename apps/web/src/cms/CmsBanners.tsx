import { useState } from 'react';
import { X } from 'lucide-react';
import type { BannerPlacement, PublicBanner, Tone } from '@goalpath/shared';
import { parseCmsLink } from './links';

const DISMISSED_KEY = 'gp-dismissed-banners';

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * A banner's button: a web address opens in a new tab, `/pages/x` opens the
 * admin's page inside the app (only where the screen can do that), and anything
 * else (such as `javascript:`) is ignored.
 */
function BannerButton({
  label,
  url,
  onOpenPage,
  className,
}: {
  label?: string;
  url?: string;
  onOpenPage?: (slug: string) => void;
  className: string;
}) {
  const link = parseCmsLink(url);
  if (!label || !link) return null;
  if (link.kind === 'web') {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  if (!onOpenPage) return null;
  return (
    <button type="button" className={className} data-plain={className.includes('underline') ? true : undefined} onClick={() => onOpenPage(link.slug)}>
      {label}
    </button>
  );
}

const TONE: Record<Tone, string> = {
  brand: 'bg-violet-100 text-violet-900',
  pink: 'bg-pink-100 text-pink-900',
  neutral: 'bg-white text-slate-900',
};

/**
 * The banners the admin put in one place of the app. Renders nothing when there
 * are none. The announcement bar can be closed for the rest of the visit.
 */
export function CmsBanners({
  banners,
  placement,
  limit = 2,
  onOpenPage,
}: {
  banners: PublicBanner[];
  placement: BannerPlacement;
  limit?: number;
  /** Opens the admin's page for a `/pages/x` button. Without it such buttons are left out. */
  onOpenPage?: (slug: string) => void;
}) {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const shown = banners.filter((b) => b.placement === placement && !dismissed.includes(b.id)).slice(0, limit);
  if (shown.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: it just comes back on the next visit */
    }
  };

  if (placement === 'announcement-bar') {
    return (
      <div role="status" className="space-y-px">
        {shown.map((b) => {
          return (
            <div key={b.id} className={`${TONE[b.tone]} flex items-center justify-center gap-3 px-4 py-2 text-xs font-bold`}>
              <span className="text-center">{b.title}</span>
              <BannerButton label={b.ctaLabel} url={b.ctaUrl} onOpenPage={onOpenPage} className="underline underline-offset-2 shrink-0 cursor-pointer" />
              <button type="button" onClick={() => dismiss(b.id)} aria-label="Dismiss" data-plain className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shown.map((b) => {
        return (
          <section key={b.id} className={`${TONE[b.tone]} rounded-3xl p-4 space-y-2 shadow-sm ring-1 ring-black/5`}>
            {b.imageUrl && <img src={b.imageUrl} alt="" loading="lazy" className="w-full max-h-40 object-cover rounded-2xl" />}
            <h3 className="font-display text-lg leading-snug font-bold">{b.title}</h3>
            {b.body && <p className="text-sm leading-relaxed opacity-90">{b.body}</p>}
            <BannerButton label={b.ctaLabel} url={b.ctaUrl} onOpenPage={onOpenPage} className="btn-tone inline-flex items-center px-4 py-2 text-sm" />
          </section>
        );
      })}
    </div>
  );
}
