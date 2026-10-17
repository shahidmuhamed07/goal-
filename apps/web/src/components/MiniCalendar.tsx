import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_LETTER, WEEK_ORDER, weekdayOf } from '../recurrence';
import { shiftDateString } from '../utils';

interface MiniCalendarProps {
  /** First and last day that may be picked, `YYYY-MM-DD`. */
  min: string;
  max: string;
  /** The days picked so far. */
  selected: string[];
  onToggle: (date: string) => void;
  /** The month to show first: any day inside it. */
  startOn: string;
}

const monthLabel = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const shiftMonth = (monthKey: string, by: number): string => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * A small month calendar for picking individual days. Tap a day to add or
 * remove it. Days outside the goal are greyed out and cannot be picked.
 */
export const MiniCalendar: React.FC<MiniCalendarProps> = ({ min, max, selected, onToggle, startOn }) => {
  const [month, setMonth] = useState(startOn.slice(0, 7));
  const picked = useMemo(() => new Set(selected), [selected]);

  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7; // empty cells before the 1st, Monday-first
  const [y, m] = month.split('-').map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: length }, (_, i) => shiftDateString(first, i)),
  ];

  const canPrev = shiftMonth(month, -1) >= min.slice(0, 7);
  const canNext = shiftMonth(month, 1) <= max.slice(0, 7);

  return (
    <div className="neu-sm p-3 space-y-2 w-full max-w-[19rem]" role="group" aria-label="Pick days on the calendar">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="chip w-8 h-8 rounded-full! grid place-items-center"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-slate-800">{monthLabel(month)}</span>
        <button
          type="button"
          className="chip w-8 h-8 rounded-full! grid place-items-center"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
        {WEEK_ORDER.map((d) => (
          <span key={d}>{WEEKDAY_LETTER[d]}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) =>
          date === null ? (
            <span key={`gap-${i}`} aria-hidden="true" />
          ) : (
            <button
              key={date}
              type="button"
              className="chip h-8 rounded-full! px-0 text-xs"
              data-active={picked.has(date)}
              aria-pressed={picked.has(date)}
              disabled={date < min || date > max}
              aria-label={new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
              onClick={() => onToggle(date)}
            >
              {Number(date.slice(8))}
            </button>
          )
        )}
      </div>
    </div>
  );
};
