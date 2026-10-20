import React, { useState } from 'react';
import { groupMissedByDay, type MissedTask, type PushResult, type PushableRoutine } from '../missed';
import { PushPlanDialog } from './PushPlanDialog';

interface MissedTasksProps {
  items: MissedTask[];
  /** Moves the given tasks of one goal to today, or every missed task when both are left out. */
  onMove: (goalId?: string, taskIds?: string[]) => void;
  /** Sets the given tasks aside so they are not offered again. */
  onSkip: (goalId: string, taskIds: string[]) => void;
  /** Weekly routines with missed days, which can be pushed later. Left out, there is no push option. */
  routines?: PushableRoutine[];
  /** A dry run of pushing a routine, for the dialog to describe it. */
  previewPush?: (routine: PushableRoutine, days: number[], everyWeeks: number) => PushResult;
  onPushRoutine?: (routine: PushableRoutine, days: number[], everyWeeks: number) => Promise<void> | void;
  onSkipRoutine?: (routine: PushableRoutine) => Promise<void> | void;
}

const SHOWN_AT_FIRST = 3;

const dayLabel = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * "Missed from earlier" on the Today screen. One question per missed day, never
 * one per exercise: can you do that day's plan today, or skip it? A routine can
 * also be pushed later as a whole with "Push my plan". Renders nothing when
 * nothing was missed.
 */
export const MissedTasks: React.FC<MissedTasksProps> = ({ items, onMove, onSkip, routines = [], previewPush, onPushRoutine, onSkipRoutine }) => {
  const [showAll, setShowAll] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  if (items.length === 0) return null;

  const days = groupMissedByDay(items);
  const visible = showAll ? days : days.slice(0, SHOWN_AT_FIRST);
  const hidden = days.length - visible.length;

  return (
    <section className="rise neu p-4 sm:p-5 space-y-3" aria-label="Missed from earlier">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="card-title">Missed from earlier</h2>
          <p className="meta">Can you do {days.length === 1 ? 'that day' : 'these days'} today, or skip?</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
          {routines.length > 0 && previewPush && onPushRoutine && onSkipRoutine && (
            <button type="button" className="chip px-3 py-1.5 text-xs" data-active="true" onClick={() => setPushOpen(true)}>
              Push my plan
            </button>
          )}
          {days.length > 1 && (
            <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => onMove()}>
              Do all today
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((day) => {
          const count = `${day.tasks.length} ${day.tasks.length === 1 ? 'task' : 'tasks'}`;
          const label = day.names.length > 0 ? day.names.join(' + ') : count;
          const taskIds = day.tasks.map((m) => m.task.id);
          return (
            <li key={day.key} className="neu-inset-sm px-3 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
                <p className="meta truncate">
                  {dayLabel(day.date)} · {day.goalTitle}
                  {day.names.length > 0 ? ` · ${count}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="chip px-3 py-1.5 text-xs shrink-0"
                data-active="true"
                onClick={() => onMove(day.goalId, taskIds)}
                aria-label={`Do ${label} from ${dayLabel(day.date)} today`}
              >
                Do it today
              </button>
              <button
                type="button"
                className="chip px-3 py-1.5 text-xs shrink-0"
                onClick={() => onSkip(day.goalId, taskIds)}
                aria-label={`Skip ${label} from ${dayLabel(day.date)}`}
              >
                Skip
              </button>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => setShowAll(true)}>
          Show {hidden} more {hidden === 1 ? 'day' : 'days'}
        </button>
      )}

      {pushOpen && previewPush && onPushRoutine && onSkipRoutine && (
        <PushPlanDialog
          routines={routines}
          preview={previewPush}
          onPush={async (routine, days, everyWeeks) => {
            await onPushRoutine(routine, days, everyWeeks);
            setPushOpen(false);
          }}
          onSkip={async (routine) => {
            await onSkipRoutine(routine);
            setPushOpen(false);
          }}
          onClose={() => setPushOpen(false)}
        />
      )}
    </section>
  );
};
