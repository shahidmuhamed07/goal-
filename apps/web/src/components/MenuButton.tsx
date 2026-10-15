import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { GlassIconButton } from './UIElements';

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** A destructive action, drawn in rose. */
  danger?: boolean;
  /** The current choice in a pick-one list, drawn in the accent with a tick. */
  active?: boolean;
  disabled?: boolean;
}

export interface MenuSection {
  heading?: string;
  items: MenuItem[];
}

interface MenuButtonProps {
  sections: MenuSection[];
  /** Tooltip and accessible name for the ⋯ button. */
  title?: string;
}

/**
 * The ⋯ button on a card and the list of actions it opens.
 *
 * Sections are separated by a rule, and a section can carry a small heading, so
 * "what to do" and "who can edit" live in one place. Closes on an outside click,
 * on Escape, and after any item is chosen.
 */
export const MenuButton: React.FC<MenuButtonProps> = ({ sections, title = 'More actions' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const visible = sections.filter((section) => section.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <GlassIconButton
        variant="tone"
        size="sm"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="w-4 h-4" />
      </GlassIconButton>

      {open && (
        <div role="menu" className="menu pop">
          {visible.map((section, index) => (
            <div key={section.heading || index}>
              {index > 0 && <div className="menu-sep" />}
              {section.heading && <div className="menu-heading">{section.heading}</div>}
              {section.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  data-danger={item.danger ? 'true' : undefined}
                  data-active={item.active ? 'true' : undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.icon && <span className="shrink-0 w-4 h-4 grid place-items-center">{item.icon}</span>}
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                  {item.active && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
