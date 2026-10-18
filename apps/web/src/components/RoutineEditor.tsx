import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { WEEKDAY_LETTER, WEEKDAY_LONG, WEEK_ORDER, describeDays } from '../recurrence';

/** One routine while the person is still shaping the plan. `uid` is only for the screen. */
export interface DraftRoutine {
  uid: string;
  name: string;
  weekdays: number[];
  tasks: string[];
  /** 1 is every week, 2 is every other week. */
  everyWeeks: number;
  /** Switched off means "left out", without losing what was written. */
  included: boolean;
}

export const MAX_TASKS_PER_ROUTINE = 12;

/** "Mon · Wed · Fri", with "every other week" when that is chosen. */
export const summarizeRoutine = (r: Pick<DraftRoutine, 'weekdays' | 'everyWeeks'>): string => {
  if (r.weekdays.length === 0) return 'Pick at least one day';
  const days = describeDays(r.weekdays);
  return r.everyWeeks > 1 ? `Every other week: ${days}` : days;
};

/** A routine is ready to save when it has a name and at least one day. */
export const isRoutineReady = (r: DraftRoutine): boolean => r.name.trim().length > 0 && r.weekdays.length > 0;

interface RoutineEditorProps {
  routine: DraftRoutine;
  index: number;
  count: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (changes: Partial<DraftRoutine>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One routine in the "here is a starting point" step. Closed it shows the name, the
 * days and the tasks, with a switch to include or leave it out. Open (Edit) it lets
 * the person change the name, the weekdays, every week or every other week, and the
 * tasks, or move or remove the routine. Everything stays editable on the goal page later.
 */
export const RoutineEditor: React.FC<RoutineEditorProps> = ({
  routine,
  index,
  count,
  expanded,
  onToggleExpanded,
  onChange,
  onMove,
  onRemove,
}) => {
  const toggleDay = (day: number) =>
    onChange({ weekdays: routine.weekdays.includes(day) ? routine.weekdays.filter((d) => d !== day) : [...routine.weekdays, day] });
  const setTask = (taskIndex: number, text: string) => onChange({ tasks: routine.tasks.map((t, i) => (i === taskIndex ? text : t)) });
  const shownTasks = routine.tasks.filter((t) => t.trim());

  return (
    <li className={`neu p-4 transition-opacity ${routine.included ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 break-words">{routine.name.trim() || 'Unnamed routine'}</p>
          <p className={`text-xs font-semibold ${routine.weekdays.length === 0 ? 'text-rose-600' : 'text-[color:var(--tone-700)]'}`}>
            {summarizeRoutine(routine)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="chip px-3 py-1 text-xs"
            data-active={expanded}
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            aria-label={`${expanded ? 'Close' : 'Edit'} ${routine.name || 'routine'}`}
          >
            {expanded ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            className="chip px-3 py-1 text-xs"
            data-active={routine.included}
            aria-pressed={routine.included}
            aria-label={`${routine.included ? 'Leave out' : 'Include'} ${routine.name || 'routine'}`}
            onClick={() => onChange({ included: !routine.included })}
          >
            {routine.included ? 'Included' : 'Left out'}
          </button>
        </div>
      </div>

      {!expanded && (
        <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc pl-5">
          {shownTasks.length === 0 ? <li className="list-none -ml-5 text-slate-500">No tasks yet. Tap Edit to add some.</li> : shownTasks.map((t, i) => <li key={`${t}-${i}`}>{t}</li>)}
        </ul>
      )}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-[color:var(--hairline)] pt-4">
          <div>
            <label htmlFor={`routine-name-${routine.uid}`} className="section-label block mb-1.5">
              Name
            </label>
            <input
              id={`routine-name-${routine.uid}`}
              type="text"
              maxLength={60}
              value={routine.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Chest day"
              className="w-full text-base rounded-2xl px-4 py-3"
            />
          </div>

          <div>
            <p className="section-label mb-2">Days it happens</p>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days of the week">
              {WEEK_ORDER.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="chip aspect-square grid place-items-center text-sm"
                  data-active={routine.weekdays.includes(day)}
                  aria-pressed={routine.weekdays.includes(day)}
                  aria-label={WEEKDAY_LONG[day]}
                  onClick={() => toggleDay(day)}
                >
                  {WEEKDAY_LETTER[day]}
                </button>
              ))}
            </div>
            <p className="meta mt-1.5">Leave a day out to skip it every week.</p>
          </div>

          <div>
            <p className="section-label mb-2">How often</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="How often">
              <button type="button" className="chip py-2.5 text-sm" data-active={routine.everyWeeks === 1} aria-pressed={routine.everyWeeks === 1} onClick={() => onChange({ everyWeeks: 1 })}>
                Every week
              </button>
              <button type="button" className="chip py-2.5 text-sm" data-active={routine.everyWeeks === 2} aria-pressed={routine.everyWeeks === 2} onClick={() => onChange({ everyWeeks: 2 })}>
                Every other week
              </button>
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Tasks</p>
            <ul className="space-y-2">
              {routine.tasks.map((text, taskIndex) => (
                <li key={taskIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={160}
                    value={text}
                    onChange={(e) => setTask(taskIndex, e.target.value)}
                    placeholder="A task"
                    aria-label={`Task ${taskIndex + 1}`}
                    className="min-w-0 flex-1 text-sm rounded-xl px-3.5 py-2.5"
                  />
                  <button
                    type="button"
                    className="icon-action shrink-0"
                    aria-label={`Remove task ${taskIndex + 1}`}
                    onClick={() => onChange({ tasks: routine.tasks.filter((_, i) => i !== taskIndex) })}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            {routine.tasks.length < MAX_TASKS_PER_ROUTINE && (
              <button type="button" className="chip mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-xs" onClick={() => onChange({ tasks: [...routine.tasks, ''] })}>
                <Plus className="w-3.5 h-3.5" />
                Add a task
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--hairline)] pt-3">
            <button type="button" className="chip inline-flex items-center gap-1.5 px-3 py-2 text-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move this routine up">
              <ArrowUp className="w-3.5 h-3.5" />
              Up
            </button>
            <button type="button" className="chip inline-flex items-center gap-1.5 px-3 py-2 text-xs" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move this routine down">
              <ArrowDown className="w-3.5 h-3.5" />
              Down
            </button>
            <button type="button" className="chip ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs" data-danger="true" onClick={onRemove}>
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
};
