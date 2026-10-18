import React, { useState } from 'react';
import { WEEKDAY_LETTER, WEEKDAY_LONG, WEEK_ORDER, describeDays } from '../recurrence';
import type { PushResult, PushableRoutine } from '../missed';
import { Dialog } from './Dialog';

interface PushPlanDialogProps {
  routines: PushableRoutine[];
  /** A dry run: what pushing this routine on these days would do, without saving anything. */
  preview: (routine: PushableRoutine, days: number[], everyWeeks: number) => PushResult;
  onPush: (routine: PushableRoutine, days: number[], everyWeeks: number) => Promise<void> | void;
  /** Lets this routine's missed days go and carries on with the rest as planned. */
  onSkip: (routine: PushableRoutine) => Promise<void> | void;
  onClose: () => void;
}

const dayLabel = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** One routine: its days (changeable), what pushing would do, and the two ways forward. */
const RoutineRow: React.FC<Omit<PushPlanDialogProps, 'routines' | 'onClose'> & { routine: PushableRoutine }> = ({ routine, preview, onPush, onSkip }) => {
  const [days, setDays] = useState<number[]>(routine.days);
  const [everyWeeks, setEveryWeeks] = useState(routine.everyWeeks);
  const [busy, setBusy] = useState(false);

  const toggleDay = (day: number) => setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  const result = days.length > 0 ? preview(routine, days, everyWeeks) : null;
  const changedDays = days.slice().sort().join() !== routine.days.slice().sort().join();

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="neu-inset-sm space-y-3 p-3.5">
      <div>
        <p className="text-sm font-bold text-slate-900">{routine.name}</p>
        <p className="meta">
          {routine.goalTitle} · {routine.missedDays} missed {routine.missedDays === 1 ? 'day' : 'days'}
        </p>
      </div>

      <div>
        <p className="section-label mb-1.5">Days you do this{changedDays ? ' (changed)' : ''}</p>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Days for ${routine.name}`}>
          {WEEK_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              className="chip aspect-square grid place-items-center text-sm"
              data-active={days.includes(day)}
              aria-pressed={days.includes(day)}
              aria-label={WEEKDAY_LONG[day]}
              onClick={() => toggleDay(day)}
            >
              {WEEKDAY_LETTER[day]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="chip mt-2 px-3 py-1.5 text-xs"
          data-active={everyWeeks === 2}
          aria-pressed={everyWeeks === 2}
          onClick={() => setEveryWeeks(everyWeeks === 2 ? 1 : 2)}
        >
          Every other week
        </button>
        <p className="meta mt-1.5">{days.length === 0 ? 'Pick at least one day.' : describeDays(days)}</p>
      </div>

      {result && (
        <p className="text-xs font-medium text-slate-700">
          {result.moved === 0 || !result.firstDay || !result.lastDay
            ? 'There is no room left before the goal ends. You can still let those days go.'
            : `Pushed, it next runs on ${dayLabel(result.firstDay)} and ends ${dayLabel(result.lastDay)}.`}
          {result.dropped > 0 && ` ${result.dropped} ${result.dropped === 1 ? 'day does' : 'days do'} not fit before the goal ends and would come off the plan.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-tone flex-1 px-4 py-2.5 text-sm"
          disabled={busy || !result || result.moved === 0}
          onClick={() => run(() => onPush(routine, days, everyWeeks))}
        >
          Push the plan
        </button>
        <button type="button" className="chip flex-1 px-4 py-2.5 text-sm" disabled={busy} onClick={() => run(() => onSkip(routine))}>
          Skip those days
        </button>
      </div>
    </li>
  );
};

/**
 * "Missed a few days?" Two ways forward for each weekly routine: push the plan (the missed days and
 * everything after slide onto the routine's own days, so nothing is lost and the plan ends later) or
 * skip the missed days and carry on as planned. The days can be changed while pushing: an extra day,
 * or one fewer. Only people who missed something ever see it.
 */
export const PushPlanDialog: React.FC<PushPlanDialogProps> = ({ routines, preview, onPush, onSkip, onClose }) => (
  <Dialog
    size="md"
    kicker="Missed a few days?"
    title="Push your plan, or carry on"
    description="Pushing slides your missed days and the rest of the plan onto your next planned days. Nothing is lost; the plan just ends a little later. Or skip the missed days and carry on as planned."
    onClose={onClose}
    closeOnScrim
    footer={
      <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-sm">
        Close
      </button>
    }
  >
    {routines.length === 0 ? (
      <p className="meta">All caught up. Nothing to push.</p>
    ) : (
      <ul className="space-y-3">
        {routines.map((routine) => (
          <RoutineRow key={`${routine.goalId}-${routine.repeatId}`} routine={routine} preview={preview} onPush={onPush} onSkip={onSkip} />
        ))}
      </ul>
    )}
  </Dialog>
);
