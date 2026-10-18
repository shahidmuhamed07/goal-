import React, { useState } from 'react';
import type { MissedTask, PushResult, PushableRoutine } from '../missed';
import { PushPlanDialog } from './PushPlanDialog';

interface MissedTasksProps {
  items: MissedTask[];
  /** Moves one task, or all of them when `taskId` is left out, to today. */
  onMove: (goalId?: string, taskId?: string) => void;
  /** Sets one task aside so it is not offered again. */
  onSkip: (goalId: string, taskId: string) => void;
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
 * "Missed from earlier" on the Today screen. Unfinished tasks from the last two
 * weeks, each with two quiet choices: move it to today, or let it go. Renders
 * nothing when nothing was missed.
 */
export const MissedTasks: React.FC<MissedTasksProps> = ({ items, onMove, onSkip, routines = [], previewPush, onPushRoutine, onSkipRoutine }) => {
  const [showAll, setShowAll] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, SHOWN_AT_FIRST);
  const hidden = items.length - visible.length;

  return (
    <section className="rise neu p-4 sm:p-5 space-y-3" aria-label="Missed from earlier">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="card-title">Missed from earlier</h2>
          <p className="meta">
            {items.length} {items.length === 1 ? 'task' : 'tasks'} you can still pick up.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
          {routines.length > 0 && previewPush && onPushRoutine && onSkipRoutine && (
            <button type="button" className="chip px-3 py-1.5 text-xs" data-active="true" onClick={() => setPushOpen(true)}>
              Push my plan
            </button>
          )}
          {items.length > 1 && (
            <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => onMove()}>
              Move all to today
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map(({ goalId, goalTitle, task, subcategoryName }) => (
          <li key={`${goalId}-${task.id}`} className="neu-inset-sm px-3 py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{task.text}</p>
              <p className="meta truncate">
                {goalTitle}
                {subcategoryName ? ` · ${subcategoryName}` : ''} · {dayLabel(task.date)}
              </p>
            </div>
            <button
              type="button"
              className="chip px-3 py-1.5 text-xs shrink-0"
              data-active="true"
              onClick={() => onMove(goalId, task.id)}
              aria-label={`Move ${task.text} to today`}
            >
              Today
            </button>
            <button
              type="button"
              className="chip px-3 py-1.5 text-xs shrink-0"
              onClick={() => onSkip(goalId, task.id)}
              aria-label={`Let go of ${task.text}`}
            >
              Skip
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => setShowAll(true)}>
          Show {hidden} more
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
