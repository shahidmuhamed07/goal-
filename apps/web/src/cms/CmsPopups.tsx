import { useState } from 'react';
import type { PageBlock, PublicPage, PublicPopup } from '@goalpath/shared';
import { Dialog } from '../components/Dialog';
import { getTodayDateString } from '../utils';
import { parseCmsLink } from './links';
import { pickPopup, type PopupMemory } from './popupRules';

const MEMORY_KEY = 'gp-popup-closed';

function readMemory(): PopupMemory {
  try {
    const value = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
    return value && typeof value === 'object' ? (value as PopupMemory) : {};
  } catch {
    return {};
  }
}

function writeMemory(memory: PopupMemory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* storage blocked: the popup may come back next visit */
  }
}

/** A link button from the admin: a web address opens a new tab, `/pages/x` opens the page in the app. */
function CmsButton({
  label,
  url,
  onOpenPage,
  onDone,
}: {
  label?: string;
  url?: string;
  onOpenPage?: (slug: string) => void;
  onDone?: () => void;
}) {
  const link = parseCmsLink(url);
  if (!label || !link) return null;
  if (link.kind === 'web') {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn-tone inline-flex items-center px-4 py-2 text-sm" onClick={onDone}>
        {label}
      </a>
    );
  }
  if (!onOpenPage) return null;
  return (
    <button
      type="button"
      className="btn-tone px-4 py-2 text-sm"
      onClick={() => {
        onDone?.();
        onOpenPage(link.slug);
      }}
    >
      {label}
    </button>
  );
}

/**
 * The popup the admin has put live, shown over the app. One at a time. How often
 * it comes back (once, daily, every visit) follows the admin's setting.
 */
export function CmsPopups({ popups, onOpenPage }: { popups: PublicPopup[]; onOpenPage?: (slug: string) => void }) {
  const [memory, setMemory] = useState<PopupMemory>(readMemory);
  const [closedThisVisit, setClosedThisVisit] = useState<string[]>([]);

  const popup = pickPopup(popups, memory, getTodayDateString(), closedThisVisit);
  if (!popup) return null;

  const close = () => {
    const next = { ...memory, [popup.id]: getTodayDateString() };
    setMemory(next);
    writeMemory(next);
    setClosedThisVisit((prev) => [...prev, popup.id]);
  };

  return (
    <Dialog
      title={popup.title}
      size="sm"
      onClose={close}
      closeOnScrim
      footer={
        <>
          <button type="button" className="chip px-4 py-2.5 text-sm" onClick={close}>
            Not now
          </button>
          <CmsButton label={popup.ctaLabel} url={popup.ctaUrl} onOpenPage={onOpenPage} onDone={close} />
        </>
      }
    >
      <div className="space-y-3">
        {popup.imageUrl && /^https?:\/\//i.test(popup.imageUrl) && (
          <img src={popup.imageUrl} alt="" loading="lazy" className="w-full max-h-48 object-cover rounded-2xl" />
        )}
        {popup.body && <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{popup.body}</p>}
      </div>
    </Dialog>
  );
}

function Block({ block, onOpenPage }: { block: PageBlock; onOpenPage?: (slug: string) => void }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="card-title">{block.text}</h3>;
    case 'text':
      return <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{block.text}</p>;
    case 'image':
      return /^https?:\/\//i.test(block.url) ? (
        <img src={block.url} alt={block.alt} loading="lazy" className="w-full rounded-2xl" />
      ) : null;
    case 'button':
      return (
        <div>
          <CmsButton label={block.label} url={block.url} onOpenPage={onOpenPage} />
        </div>
      );
    case 'divider':
      return <hr className="border-0 h-px bg-[color:var(--hairline)]" />;
    default:
      return null;
  }
}

/** A page from the admin, opened from a banner, popup or button. */
export function CmsPageDialog({
  page,
  onClose,
  onOpenPage,
}: {
  page: PublicPage;
  onClose: () => void;
  onOpenPage?: (slug: string) => void;
}) {
  return (
    <Dialog title={page.title} size="md" onClose={onClose} closeOnScrim>
      <div className="space-y-4">
        {page.blocks.map((block) => (
          <Block key={block.id} block={block} onOpenPage={onOpenPage} />
        ))}
      </div>
    </Dialog>
  );
}
