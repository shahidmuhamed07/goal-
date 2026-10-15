import React from 'react';
import { DayStats } from '../recurrence';

interface DayMarkProps {
  stats?: DayStats;
  isToday?: boolean;
}

/**
 * The one small mark under a day on a week strip, drawn in the colour of the key
 * it sits on:
 *   filled ring = every task is done      open ring = tasks are waiting
 *   dot         = planned, no tasks yet   ★         = today, nothing planned
 */
export const DayMark: React.FC<DayMarkProps> = ({ stats, isToday = false }) => {
  const hasTasks = !!stats && stats.total > 0;
  const allDone = hasTasks && stats!.done === stats!.total;

  return (
    <span className="h-2.5 flex items-center justify-center" aria-hidden="true">
      {hasTasks ? (
        <span className={`w-2 h-2 rounded-full border-2 border-current ${allDone ? 'bg-current' : ''}`} />
      ) : stats?.subs ? (
        <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      ) : isToday ? (
        <span className="text-[9px] leading-none">★</span>
      ) : null}
    </span>
  );
};
