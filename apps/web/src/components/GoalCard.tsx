import React, { useMemo } from 'react';
import { ArrowRight, Check, Lock, Plus, Users } from 'lucide-react';
import { previewGoal } from '../goalPreview';
import { Collaborator, Goal } from '../types';
import { shiftDateString, isGoalSharedWith } from '../utils';
import { WEEKDAY_LETTER, goalEndDate, goalStartDate, weekdayOf } from '../recurrence';

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

/** What one day of the coming week holds: the names of its routines. */
interface DayRow {
  date: string;
  names: string[];
}

/** Days listed under the week keys, and routine names shown on each. Anything beyond is "+ N". */
const MAX_DAY_ROWS = 4;
const MAX_NAMES = 2;

/**
 * A goal on the Goals page: a brief of what is planned, not a dashboard of numbers.
 *
 * On a laptop it shows one week (today and the next six days) as seven letter keys (today is
 * filled, a dot marks a planned day; tap one to open the goal on that day) and, under them, the
 * days that have something, each with its routine names as small chips. Only a few days and
 * names are listed; the rest is "+ N". On a phone it shows today's work instead. A goal with
 * nothing planned says so and invites the first routine, so people can see where to add.
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

  const { dayRows, plannedDates, next } = useMemo(() => {
    const window = new Set(days);
    const byDate = new Map<string, string[]>();
    [...(goal.subcategories || [])]
      .filter((s) => s.date && window.has(s.date))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((s) => {
        const names = byDate.get(s.date!) ?? [];
        if (!names.includes(s.name)) names.push(s.name);
        byDate.set(s.date!, names);
      });

    // Nothing in the next seven days: point at the next thing that is planned.
    const after = days[days.length - 1];
    const upcoming = (goal.subcategories || [])
      .filter((s) => s.date && s.date > after)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];

    const rows: DayRow[] = days.filter((d) => byDate.has(d)).map((d) => ({ date: d, names: byDate.get(d)! }));
    return { dayRows: rows, plannedDates: new Set(byDate.keys()), next: upcoming };
  }, [goal.subcategories, days]);

  const hasAnything = (goal.subcategories || []).length > 0 || (goal.tasks || []).length > 0;
  const assigned = collaborators.filter((c) => isGoalSharedWith(c, goal.id));
  const isAssigned = assigned.length > 0;
  const canPlan = isOwner || canEdit;

  const shownDays = dayRows.slice(0, MAX_DAY_ROWS);
  const hiddenDays = dayRows.length - shownDays.length;
  const preview = useMemo(() => previewGoal(goal, today), [goal, today]);
  const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <article
      onClick={() => onOpen()}
      className="rise rise-3 lift neu relative overflow-hidden flex flex-col cursor-pointer"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${categoryAccent(goal.category)}`}
      />

      <div className="flex-1 flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 pt-5">
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
            <p className="text-sm sm:text-xs leading-relaxed text-slate-600 line-clamp-3 sm:line-clamp-2">{goal.description}</p>
          )}
        </div>

        {/* Phone: what today's work is, not a row of dots */}
        {hasAnything && (
          <div className="sm:hidden neu-inset-sm space-y-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="section-label">{preview.total > 0 ? 'Today' : 'Nothing today'}</span>
              {preview.total > 0 && (
                <span className="badge tabular-nums">
                  {preview.done}/{preview.total} done
                </span>
              )}
            </div>
            {preview.total > 0 ? (
              <>
                {preview.routines.length > 0 && (
                  <p className="truncate text-xs font-bold text-[color:var(--tone-700)]">{preview.routines.join(' · ')}</p>
                )}
                <ul className="space-y-1.5">
                  {preview.tasks.slice(0, 3).map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-sm leading-snug">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                          t.completed ? 'bg-[color:var(--tone-600)] text-white' : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {t.completed && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                      <span className={t.completed ? 'text-slate-400 line-through' : 'text-slate-800'}>{t.text}</span>
                    </li>
                  ))}
                </ul>
                {preview.tasks.length > 3 && <p className="meta">+ {preview.tasks.length - 3} more today</p>}
              </>
            ) : (
              <p className="text-sm text-slate-600">
                {preview.next ? (
                  <>
                    Next: <strong className="text-slate-800">{preview.next.routine}</strong> on {shortDay(preview.next.date)}
                  </>
                ) : (
                  'Nothing planned for today.'
                )}
              </p>
            )}
          </div>
        )}

        {hasAnything ? (
          <div className="hidden sm:block space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="section-label">This week</span>
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

            {/* The week: each day that has something, with its routines as small chips */}
            {shownDays.length > 0 ? (
              <ul className="neu-inset-sm p-3 space-y-2">
                {shownDays.map((row) => (
                  <li key={row.date} className="flex items-center gap-2 min-w-0">
                    <span className="w-14 shrink-0 text-[11px] font-bold text-[color:var(--tone-800)]">
                      {shortDay(row.date).replace(/,? \w+ /, ' ')}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {row.names.slice(0, MAX_NAMES).map((name) => (
                        <span key={name} className="badge max-w-[8.5rem] truncate">
                          {name}
                        </span>
                      ))}
                      {row.names.length > MAX_NAMES && (
                        <span className="text-[11px] font-semibold text-slate-500">+ {row.names.length - MAX_NAMES}</span>
                      )}
                    </span>
                  </li>
                ))}
                {hiddenDays > 0 && (
                  <li className="text-[11px] font-semibold text-slate-500">
                    + {hiddenDays} more {hiddenDays === 1 ? 'day' : 'days'} this week
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
          <div className="neu-inset-sm px-3 py-2.5 sm:px-4 sm:py-5 text-center space-y-2">
            <span className="mx-auto neu-sm w-9 h-9 hidden sm:grid place-items-center text-[color:var(--tone-700)]">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
            <p className="text-sm font-bold text-slate-800">
              {canPlan ? 'Plan your first routine' : 'Nothing planned yet'}
            </p>
            {canPlan && (
              <p className="hidden sm:block text-xs text-slate-500 leading-relaxed">
                Add a subcategory like “Chest day”, choose the weekdays, and it shows up here.
              </p>
            )}
          </div>
        )}

        {/* Who can see it, and the way in */}
        <div
          className={`mt-auto items-center justify-between gap-2 flex-wrap ${
            // On a phone the whole card is the way in, so a bare "Open" row is dropped
            hasAnything && isOwner && collaborators.length === 0 ? 'hidden sm:flex' : 'flex'
          }`}
        >
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
