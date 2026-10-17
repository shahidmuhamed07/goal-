import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * The way back out of a screen. A clear 44px pill with an arrow and a word,
 * placed on its own row at the top. Use it on every screen you go "into".
 */
export const BackButton: React.FC<{ label?: string; onClick: () => void }> = ({ label = 'Back', onClick }) => (
  <button type="button" className="back-btn" onClick={onClick}>
    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
    {label}
  </button>
);
