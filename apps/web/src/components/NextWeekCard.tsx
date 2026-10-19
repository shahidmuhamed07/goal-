import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Goal } from '../types';
import { nextWeekNumber } from '../program';

interface NextWeekCardProps {
  /** Program goals whose written weeks are about to run out. */
  goals: Goal[];
  /** The goal being planned right now, if any. */
  busyGoalId: string | null;
  onPlan: (goalId: string) => void;
}

/**
 * On Today: "Week 2 of Build strength is not planned yet". One tap asks the AI for it, using how the
 * last week went. Shows nothing when no goal needs a new week.
 */
export const NextWeekCard: React.FC<NextWeekCardProps> = ({ goals, busyGoalId, onPlan }) => {
  if (goals.length === 0) return null;
  return (
    <section className="rise neu space-y-3 p-4 sm:p-5" aria-label="Plan the next week">
      {goals.map((goal) => {
        const week = goal.program ? nextWeekNumber(goal.program) : undefined;
        const busy = busyGoalId === goal.id;
        return (
          <div key={goal.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-slate-900">{goal.title}</p>
              <p className="text-xs text-slate-500">Week {week} is not planned yet. It will build on how last week went.</p>
            </div>
            <button type="button" className="btn-tone inline-flex h-11 shrink-0 items-center gap-2 px-5 text-sm" disabled={!!busyGoalId} onClick={() => onPlan(goal.id)}>
              <Sparkles className="h-4 w-4" />
              {busy ? 'Planning…' : `Plan week ${week}`}
            </button>
          </div>
        );
      })}
    </section>
  );
};
