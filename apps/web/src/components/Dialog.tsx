import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  /** A small label above the title, such as "Approve & assign goals". */
  kicker?: string;
  /** One or two sentences under the title. */
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClose: () => void;
  /** Close when the dimmed area is tapped. Off by default so a stray tap never loses typing. */
  closeOnScrim?: boolean;
  /** Buttons, right-aligned under a hairline. Cancel first, the main action last. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The one way to show a dialog.
 *
 * It is drawn on <body> so nothing can paint over it. It brings the shared look (a light dim with no blur, a white rounded panel), a
 * header (kicker, title, description, a clear close button), a body and a footer
 * with fixed spacing, Esc to close, and a locked page behind it. Build new
 * dialogs from this so they look and behave like every other one.
 */
export const Dialog: React.FC<DialogProps> = ({
  title,
  kicker,
  description,
  size = 'md',
  onClose,
  closeOnScrim = false,
  footer,
  children,
}) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // The dialog is drawn on <body>, not where it is written. Inside a screen it would sit in
  // that screen's stacking layer, and the header and the phone tab bar would paint over it.
  // The tone (owner or professional colours) is carried over from the app root.
  const tone = document.querySelector('[data-role]')?.getAttribute('data-role') ?? undefined;

  return createPortal(
    <div style={{ display: 'contents' }} data-role={tone}>
      <div
        className="scrim"
        onMouseDown={(event) => {
          if (closeOnScrim && event.target === event.currentTarget) onClose();
        }}
      >
        <div className="dialog" data-size={size} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="dialog-head">
            <div className="min-w-0 space-y-1.5">
              {kicker && <span className="badge uppercase tracking-wider">{kicker}</span>}
              <h2 id={titleId} className="card-title text-xl! leading-snug">
                {title}
              </h2>
              {description && <div className="meta max-w-prose">{description}</div>}
            </div>
            <button type="button" className="icon-action" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
