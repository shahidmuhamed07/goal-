import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Goal } from '../types';
import { Dialog } from './Dialog';
import { ProgressBar } from './UIElements';

interface ProgressDialogProps {
  goals: Goal[];
  /** Share of all months done across every goal, 0 to 100. */
  overall: number;
  onOpenGoal: (goalId: string) => void;
  onClose: () => void;
}

/**
 * "Progress" explained: the overall number, then each goal with how many of its
 * months are done. Tapping a goal opens it, so the number leads somewhere useful.
 */
export const ProgressDialog: React.FC<ProgressDialogProps> = ({ goals, overall, onOpenGoal, onClose }) => (
  <Dialog
    size="md"
    kicker="Progress"
    title={`${overall}% of your months are done`}
    description="Each goal is split into months. A month counts when you tick it off on the goal page."
    onClose={onClose}
    closeOnScrim
    footer={
      <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-sm">
        Close
      </button>
    }
  >
    {goals.length === 0 ? (
      <p className="meta">No goals yet. Create one and its progress shows up here.</p>
    ) : (
      <ul className="space-y-2.5">
        {goals.map((goal) => {
          const total = goal.milestones?.length || 0;
          const done = goal.milestones?.filter((m) => m.completed).length || 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => onOpenGoal(goal.id)}
                className="neu-inset-sm w-full space-y-2 p-3.5 text-left cursor-pointer"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-900">{goal.title}</span>
                  <ArrowRight className="w-4 h-4 shrink-0 text-slate-500" />
                </span>
                <ProgressBar value={pct} height="h-2" color="bg-[color:var(--tone-600)]" />
                <span className="meta block">
                  {total === 0 ? 'No months yet' : `${done} of ${total} ${total === 1 ? 'month' : 'months'} done · ${pct}%`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </Dialog>
);
