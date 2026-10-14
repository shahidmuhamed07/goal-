import React from 'react';

interface OrbProps {
  size?: number;
  /** Drift up and down gently. */
  float?: boolean;
  className?: string;
}

/**
 * The guide: a soft white sphere with a smile, who asks the questions and sits
 * beside the speech bubble. Drawn in SVG so it stays sharp at any size.
 */
export const Orb: React.FC<OrbProps> = ({ size = 64, float = false, className = '' }) => (
  <span
    className={`orb inline-grid place-items-center rounded-full shrink-0 ${float ? 'orb-float' : ''} ${className}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <svg
      width={size * 0.62}
      height={size * 0.62}
      viewBox="0 0 40 40"
      fill="none"
      stroke="#2d2a55"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 15c1.6-3.2 5.4-3.2 7 0" />
      <path d="M26 15c1.6-3.2 5.4-3.2 7 0" />
      <path d="M11 23c4.2 6.4 14.8 6.4 18 0" />
    </svg>
  </span>
);
