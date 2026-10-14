import React, { useMemo } from 'react';
import { ArrowRight, Check, Lock, Plus, Users } from 'lucide-react';
import { Collaborator, Goal } from '../types';
import { shiftDateString, isGoalSharedWith } from '../utils';
import {
  WEEKDAY_LETTER,
  describeDays,
  goalEndDate,
  goalStartDate,
  sortWeekdays,
  weekdayOf,
} from '../recurrence';

/**
 * One palette colour per category, drawn as a strip along the top of the card.
 * A grid of identical cards tells you nothing at a glance; the strip is what
 * makes each one scannable.
 */
const CATEGORY_ACCENTS: Record<string, string> = {
  Career: 'from-blue-400 to-blue-600',
  Business: 'from-violet-500 to-violet-700',
  Health: 'from-emerald-300 to-emerald-500',
  Fitness: 'from-violet-400 to-violet-600',
  'Finance & Wealth': 'from-teal-300 to-teal-500',
  'Learning & Skills': 'from-indigo-400 to-indigo-600',
  'Creative Writing': 'from-pink-300 to-pink-500',
};

const categoryAccent = (category?: string): string =>
  CATEGORY_ACCENTS[(category || '').trim()] || 'from-violet-500 to-violet-700';

/** "Wednesday, Oct 7": the spoken form of a day, for tooltips and screen readers. */
const longDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

interface GoalCardProps {
  goal: Goal;
  /** Today as `YYYY-MM-DD`. */
  today: string;
  isOwner: boolean;
  /** A professional's edit access to this goal; owners always can. */
  canEdit: boolean;
  professionalRole?: string | null;
  /** The owner's connected professionals, for the "who can see this" line. */
  collaborators?: Collaborator[];
  /** Open the goal, optionally on a particular day. */
  onOpen: (date?: string) => void;
  onManageAccess: () => void;
}

/** What the coming days hold for one routine: its name, weekdays and a peek at its tasks. */
interface BriefRow {
  name: string;
  weekdays: number[];
  tasks: string[];
}

/**
 * A goal on the Goals page: a brief of what is planned, not a dashboard of numbers.
 *
 * It shows the next seven days as seven letter keys (today is filled, a dot marks
 * a planned day; tap one to open the goal on that day) and, under them, the routines in that window
 * with the days they fall on and a peek at their tasks. A goal with nothing
 * planned says so and invites the first routine, so people can see where to add.
 */
export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  today,
  isOwner,
  canEdit,
  professionalRole,
  collaborators = [],
  onOpen,
  onManageAccess,
}) => {
  const start = goalStartDate(goal);
  const end = goalEndDate(goal);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateString(today, i)), [today]);

  const { rows, plannedDates, next } = useMemo(() => {
    const window = new Set(days);
    const subs = (goal.subcategories || [])
      .filter((s) => s.date && window.has(s.date))
      .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : (a.order ?? 0) - (b.order ?? 0)));

    const byName = new Map<string, BriefRow>();
    const planned = new Set<string>();
    subs.forEach((s) => {
      planned.add(s.date!);
      const key = s.name.trim().toLowerCase();
      const row = byName.get(key) || { name: s.name, weekdays: [], tasks: [] };
      const wd = weekdayOf(s.date!);
      if (!row.weekdays.includes(wd)) row.weekdays.push(wd);
      // New tasks are stored first, so reverse to peek in the order they were written.
      [...(goal.tasks || [])]
        .reverse()
        .filter((t) => t.subcategoryId === s.id)
        .forEach((t) => {
          if (row.tasks.length < 2 && !row.tasks.includes(t.text)) row.tasks.push(t.text);
        });
      byName.set(key, row);
    });

    // Nothing in the next seven days: point at the next thing that is planned.
    const after = days[days.length - 1];
    const upcoming = (goal.subcategories || [])
      .filter((s) => s.date && s.date > after)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];

    return { rows: Array.from(byName.values()), plannedDates: planned, next: upcoming };
  }, [goal.subcategories, goal.tasks, days]);

  const hasAnything = (goal.subcategories || []).length > 0 || (goal.tasks || []).length > 0;
  const assigned = collaborators.filter((c) => isGoalSharedWith(c, goal.id));
  const isAssigned = assigned.length > 0;
  const canPlan = isOwner || canEdit;

  const shown = rows.slice(0, 3);
  const hidden = rows.length - shown.length;

  return (
    <article
      onClick={() => onOpen()}
      className="rise rise-3 lift neu relative overflow-hidden flex flex-col cursor-pointer"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${categoryAccent(goal.category)}`}
      />

      <div className="flex-1 flex flex-col gap-4 p-4 sm:p-5 pt-5">
        <div className="min-w-0 space-y-1.5">
          <span className="badge">{goal.category || 'General'}</span>
          <h3 className="text-lg font-extrabold leading-snug text-slate-900">
            <button
              type="button"
              data-plain
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="text-left cursor-pointer line-clamp-2"
            >
              {goal.title}
            </button>
          </h3>
          {goal.description && (
            <p className="text-xs leading-relaxed text-slate-600 line-clamp-2">{goal.description}</p>
          )}
        </div>

        {hasAnything ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="section-label">Next 7 days</span>
            </div>

            {/* Seven letter keys: filled where something is planned */}
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((date) => {
                const inGoal = date >= start && date <= end;
                const planned = plannedDates.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    className="chip py-2 text-[11px] relative"
                    data-active={date === today}
                    disabled={!inGoal}
                    aria-label={`Open ${goal.title} on ${longDate(date)}${planned ? ' (planned)' : ''}`}
                    title={inGoal ? longDate(date) : 'Outside this goal’s months'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(date);
                    }}
                  >
                    {WEEKDAY_LETTER[weekdayOf(date)]}
                    {planned && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full bg-current"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* The brief: routines in this window, the days they fall on, a peek at the tasks */}
            {shown.length > 0 ? (
              <ul className="neu-inset-sm p-3 space-y-2.5">
                {shown.map((row) => (
                  <li key={row.name} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-bold text-slate-800">{row.name}</span>
                      <span className="shrink-0 text-[11px] font-bold text-[color:var(--tone-800)]">
                        {describeDays(sortWeekdays(row.weekdays))}
                      </span>
                    </div>
                    {row.tasks.length > 0 && (
                      <p className="truncate text-[11px] text-slate-500">{row.tasks.join(' · ')}</p>
                    )}
                  </li>
                ))}
                {hidden > 0 && (
                  <li className="text-[11px] font-semibold text-slate-500">
                    + {hidden} more {hidden === 1 ? 'routine' : 'routines'}
                  </li>
                )}
              </ul>
            ) : (
              <div className="neu-inset-sm p-3 text-xs text-slate-600">
                {next ? (
                  <>
                    Nothing in the next 7 days. Next up:{' '}
                    <strong className="text-slate-800">{next.name}</strong> on {longDate(next.date!)}.
                  </>
                ) : (
                  <>Nothing planned in the next 7 days.</>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Nothing planned yet: say so, and show where to start */
          <div className="neu-inset-sm px-4 py-5 text-center space-y-2">
            <span className="mx-auto neu-sm w-9 h-9 grid place-items-center text-[color:var(--tone-700)]">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
            <p className="text-sm font-bold text-slate-800">
              {canPlan ? 'Plan your first routine' : 'Nothing planned yet'}
            </p>
            {canPlan && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Add a subcategory like “Chest day”, choose the weekdays, and it shows up here.
              </p>
            )}
          </div>
        )}

        {/* Who can see it, and the way in */}
        <div className="mt-auto flex items-center justify-between gap-2 flex-wrap">
          {isOwner ? (
            collaborators.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="badge">
                  <Users className="w-3 h-3" />
                  {assigned.length}/{collaborators.length} {collaborators.length === 1 ? 'Pro' : 'Pros'}
                </span>
                <button
                  type="button"
                  className="chip flex items-center gap-1 px-2.5 py-1 text-[11px]"
                  data-current={isAssigned}
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageAccess();
                  }}
                >
                  {isAssigned ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {isAssigned ? 'Assigned' : 'Assign Pro'}
                </button>
              </div>
            ) : (
              <span />
            )
          ) : canEdit ? (
            <span className="badge">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--tone-700)] animate-pulse" />
              Can edit · {professionalRole || 'Trainer'}
            </span>
          ) : (
            <span className="badge" title="Your client gave you read-only access to this goal">
              <Lock className="w-3 h-3" />
              View only
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--tone-800)]">
            {hasAnything ? 'Open' : canPlan ? 'Start planning' : 'Open'}
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </article>
  );
};
