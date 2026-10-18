import React from 'react';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  title: string;
  /** What will happen, in one or two plain sentences. */
  description: React.ReactNode;
  /** The button that does it, e.g. "Remove". */
  confirmLabel: string;
  /** Shown on that button while the work is running, e.g. "Removing…". */
  busyLabel?: string;
  busy?: boolean;
  /** `danger` (red) for anything that removes or disconnects; `tone` otherwise. */
  tone?: 'danger' | 'tone';
  /** Extra detail under the description, such as a person's name and role. */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The one way to ask "are you sure?". Built on <Dialog>, so it looks and behaves
 * like every other dialog and fits a phone screen. Use it for removing, leaving
 * and anything else that cannot be undone, instead of an inline Remove / Cancel pair.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  tone = 'danger',
  children,
  onConfirm,
  onCancel,
}) => (
  <Dialog
    size="sm"
    title={title}
    onClose={() => {
      if (!busy) onCancel();
    }}
    footer={
      <>
        <button type="button" disabled={busy} onClick={onCancel} className="chip px-4 py-2.5 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`${tone === 'danger' ? 'btn-danger' : 'btn-tone'} px-5 py-2.5 text-sm`}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </>
    }
  >
    <p className="text-sm leading-relaxed text-slate-600">{description}</p>
    {children}
  </Dialog>
);
