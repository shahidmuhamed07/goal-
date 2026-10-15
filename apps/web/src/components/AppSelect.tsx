import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface AppSelectOption {
  value: string;
  label: string;
  /** Muted second line under the label, for disambiguating two similar entries. */
  hint?: string;
}

interface AppSelectProps {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Trigger styling. Sizing stays with the caller so each spot keeps its shape. */
  className?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

/**
 * A dropdown that matches the app's own surfaces.
 *
 * A native <select> hands its open list to the browser, so it inherits the
 * browser's font, highlight colour and width rules and can clip long names.
 * This renders the trigger and the list ourselves instead, which keeps the
 * typography, colours and rounding consistent with the rest of the interface.
 */
export const AppSelect: React.FC<AppSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  align = 'right',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const pick = (next: string) => {
    setIsOpen(false);
    triggerRef.current?.focus();
    if (next !== value) onChange(next);
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-1.5 text-left cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate">{selected ? selected.label : ''}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Click-away catcher, same pattern as the account menu */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            role="listbox"
            aria-label={ariaLabel}
            className={`neu absolute z-50 mt-1.5 w-max min-w-full max-w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl p-1.5 max-h-72 overflow-y-auto ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(option.value)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'neu-inset-sm text-emerald-800'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{option.label}</span>
                    {option.hint && (
                      <span className="block text-[10px] font-medium text-slate-400 break-all mt-0.5">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  <Check
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isSelected ? 'text-emerald-600' : 'text-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
