import React from 'react';
import { WEEK_ORDER, WEEKDAY_LETTER, WEEKDAY_LONG } from '../recurrence';

interface WeekdayPickerProps {
  /** Selected weekdays, 0 = Sunday … 6 = Saturday. */
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

/**
 * The seven weekday keys, Monday first: M T W T F S S. Tap a letter to add or
 * remove that day of the week. Used wherever something can repeat weekly.
 */
export const WeekdayPicker: React.FC<WeekdayPickerProps> = ({ value, onChange, disabled }) => {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Repeat on these days of the week">
      {WEEK_ORDER.map((day) => {
        const selected = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            className="chip w-8 h-8 rounded-full! grid place-items-center text-xs"
            data-active={selected}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={WEEKDAY_LONG[day]}
            title={WEEKDAY_LONG[day]}
            onClick={() => toggle(day)}
          >
            {WEEKDAY_LETTER[day]}
          </button>
        );
      })}
    </div>
  );
};
