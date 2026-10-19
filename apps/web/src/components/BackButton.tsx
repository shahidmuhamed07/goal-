import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * The way back out of a screen. A clear 44px pill with an arrow and a word,
 * placed on its own row at the top. Use it on every screen you go "into".
 */
export const BackButton: React.FC<{ label?: string; onClick: () => void; compact?: boolean }> = ({ label = 'Back', onClick, compact }) =>
  compact ? (
    // A plain text link for a screen where a big pill would only crowd the title.
    <button type="button" data-plain className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-0.5 text-sm font-semibold text-[color:var(--tone-700)]" onClick={onClick}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  ) : (
  <button type="button" className="back-btn" onClick={onClick}>
    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
    {label}
  </button>
);
