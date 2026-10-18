import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react';
import { Goal, Subcategory, TaskItem } from '../types';
import { SubcategoryBlock } from './SubcategoryBlock';
import { WeekdayPicker } from './WeekdayPicker';
import { MiniCalendar } from './MiniCalendar';
import { GlassIconButton } from './UIElements';
import { DayMark } from './DayMark';
import { getCategoryPresets } from '../categoryPresets';
import {
  getTodayDateString,
  getCurrentMonthKey,
  shiftDateString,
  formatFullMonth,
  formatMonthKey,
} from '../utils';
import {
  WEEKDAY_SHORT,
  buildDayStats,
  datesOnWeekdays,
  describeDays,
  describePattern,
  getWeekDates,
  goalEndDate,
  goalStartDate,
  startOfWeek,
  weekdayOf,
  type RepeatPattern,
} from '../recurrence';

type Priority = 'high' | 'medium' | 'low';

interface DailyTaskSectionProps {
  goal: Goal;
  isOwner?: boolean;
  canManageCategories?: boolean;
  selectedMonthKey?: string;
  /** The day to open on (from a goal card's week strip); otherwise today. */
  initialDate?: string | null;
  onSelectMonth?: (monthKey: string) => void;
  canEditSubcategoryTasks: (sub?: Subcategory) => boolean;
  onAddSubcategory: (goalId: string, name: string, date?: string) => Promise<string | null>;
  onAddRepeatingSubcategory: (
    goalId: string,
    name: string,
    fromDate: string,
    pattern: RepeatPattern
  ) => Promise<string | null>;
  onRenameSubcategory: (goalId: string, subcategoryId: string, name: string) => void;
  onDeleteSubcategory: (goalId: string, subcategoryId: string, scope: 'one' | 'future') => void;
  onSetSubcategoryRole?: (goalId: string, subcategoryId: string, editorRole: string) => void;
  onChangeSubcategoryRepeat: (
    goalId: string,
    subcategoryId: string,
    days: number[],
    everyWeeks?: number
  ) => void;
  onAddTask: (
    goalId: string,
    text: string,
    priority: Priority,
    subcategoryId?: string,
    date?: string,
    forward?: boolean
  ) => void;
  onUpdateTask?: (goalId: string, taskId: string, updates: Partial<TaskItem>) => void;
  onToggleTask: (goalId: string, taskId: string) => void;
  onDeleteTask: (goalId: string, taskId: string) => void;
}

/** "Tuesday, Oct 13": the day being planned, spelled out. */
const longDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

/** "Mon Oct 19": a day in a short list, where commas would be confusing. */
const shortDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .replace(',', '');
};

/** "Oct 5 – 11, 2026", or "Sep 28 – Oct 4, 2026" when the week crosses a month. */
const weekRange = (dates: string[]): string => {
  const part = (date: string, withMonth: boolean) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      ...(withMonth ? { month: 'short' } : {}),
      day: 'numeric',
      timeZone: 'UTC',
    });
  };
  const first = dates[0];
  const last = dates[dates.length - 1];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `${part(first, true)} – ${part(last, !sameMonth)}, ${last.slice(0, 4)}`;
};

/** A numbered heading, so the page reads as a short sequence: pick a day, plan it. */
const StepHeading: React.FC<{ step: number; title: string; children?: React.ReactNode }> = ({
  step,
  title,
  children,
}) => (
  <div className="flex items-center justify-between gap-3 flex-wrap">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-6 h-6 rounded-full grid place-items-center shrink-0 text-[11px] font-extrabold text-white bg-[color:var(--tone-700)]">
        {step}
      </span>
      <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
    </div>
    {children}
  </div>
);

export const DailyTaskSection: React.FC<DailyTaskSectionProps> = ({
  goal,
  isOwner = true,
  canManageCategories = true,
  selectedMonthKey,
  initialDate,
  onSelectMonth,
  canEditSubcategoryTasks,
  onAddSubcategory,
  onAddRepeatingSubcategory,
  onRenameSubcategory,
  onDeleteSubcategory,
  onSetSubcategoryRole,
  onChangeSubcategoryRepeat,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const todayStr = getTodayDateString();
  const currentCalendarMonth = getCurrentMonthKey();
  const activeMonthKey = selectedMonthKey || currentCalendarMonth;
  const horizonStart = goalStartDate(goal);
  const horizonEnd = goalEndDate(goal);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    initialDate && initialDate.startsWith(activeMonthKey)
      ? initialDate
      : activeMonthKey === currentCalendarMonth
      ? todayStr
      : `${activeMonthKey}-01`
  );
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(true);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // The add-subcategory form
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [weekly, setWeekly] = useState(false);
  // 1 = every week, 2 = every other week.
  const [everyWeeks, setEveryWeeks] = useState(1);
  // Days picked one by one on the small calendar, instead of weekdays.
  const [datesMode, setDatesMode] = useState(false);
  const [pickedDates, setPickedDates] = useState<string[]>([]);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  /**
   * Picks a day. The roadmap beside this section follows the month, so moving
   * into another month through the week strip has to tell it as well.
   */
  const selectDate = (date: string) => {
    setSelectedDate(date);
    const monthKey = date.slice(0, 7);
    if (monthKey !== activeMonthKey) onSelectMonth?.(monthKey);
  };

  // The month changed from outside (the roadmap or the month menu): land on a
  // sensible day in it.
  useEffect(() => {
    if (!selectedDate.startsWith(activeMonthKey)) {
      setSelectedDate(activeMonthKey === currentCalendarMonth ? todayStr : `${activeMonthKey}-01`);
    }
  }, [activeMonthKey, currentCalendarMonth, todayStr, selectedDate]);

  // Planning only happens inside the goal's own months.
  useEffect(() => {
    if (selectedDate < horizonStart) selectDate(horizonStart);
    else if (selectedDate > horizonEnd) selectDate(horizonEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, horizonStart, horizonEnd]);

  useEffect(() => {
    if (!showMonthDropdown) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMonthDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthDropdown]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const canPrevWeek = startOfWeek(selectedDate) > horizonStart;
  const canNextWeek = shiftDateString(startOfWeek(selectedDate), 7) <= horizonEnd;

  const moveWeek = (step: 1 | -1) => {
    const target = shiftDateString(selectedDate, step * 7);
    selectDate(target < horizonStart ? horizonStart : target > horizonEnd ? horizonEnd : target);
  };

  const selectedDateTasks = useMemo(
    () => (goal.tasks || []).filter((t) => t.date === selectedDate),
    [goal.tasks, selectedDate]
  );

  // Subcategories belong to a day. Older ones saved without a date are shown on
  // the day their tasks are on, or else on the goal's first day.
  const subcategories = useMemo(() => {
    return (goal.subcategories || [])
      .filter((s) => {
        if (s.date) return s.date === selectedDate;
        const hasTasksOnThisDate = (goal.tasks || []).some(
          (t) => t.subcategoryId === s.id && t.date === selectedDate
        );
        if (hasTasksOnThisDate) return true;
        const hasTasksOnOtherDates = (goal.tasks || []).some(
          (t) => t.subcategoryId === s.id && t.date && t.date !== selectedDate
        );
        if (hasTasksOnOtherDates) return false;
        const goalDate = goal.createdAt ? goal.createdAt.split('T')[0] : todayStr;
        return selectedDate === goalDate || selectedDate === todayStr;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [goal.subcategories, goal.tasks, goal.createdAt, selectedDate, todayStr]);

  // What each day of the strip should hint at: tasks (and how many are done), or
  // a planned subcategory with no tasks yet.
  const dayStats = useMemo(() => buildDayStats(goal), [goal.tasks, goal.subcategories]);

  const uncategorizedTasks = useMemo(
    () => selectedDateTasks.filter((t) => !t.subcategoryId),
    [selectedDateTasks]
  );

  const categoryConfig = useMemo(
    () => getCategoryPresets(goal.category, goal.title),
    [goal.category, goal.title]
  );

  /**
   * A short row of starting points for the name field: the last couple of names
   * this goal has used, then this category's own routines, four in all. Anything
   * else is a matter of typing it.
   */
  const quickPicks = useMemo(() => {
    const onThisDay = new Set<string>(subcategories.map((s) => s.name.trim().toLowerCase()));
    const seen = new Set<string>(onThisDay);
    const picks: string[] = [];
    const add = (name: string) => {
      const key = name.trim().toLowerCase();
      if (!name.trim() || seen.has(key) || picks.length >= 4) return;
      seen.add(key);
      picks.push(name);
    };
    const recent: string[] = [];
    [...(goal.subcategories || [])].reverse().forEach((s) => {
      if (s.name && !recent.some((n) => n.toLowerCase() === s.name.toLowerCase())) recent.push(s.name);
    });
    recent.filter((n) => !onThisDay.has(n.trim().toLowerCase())).slice(0, 2).forEach(add);
    categoryConfig.subcategories.forEach(add);
    return picks;
  }, [goal.subcategories, subcategories, categoryConfig]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: prev[id] !== undefined ? !prev[id] : !allExpanded }));

  const handleToggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    const map: Record<string, boolean> = { __uncategorized__: next };
    subcategories.forEach((s) => {
      map[s.id] = next;
    });
    setExpandedIds(map);
  };

  const openAdd = () => {
    setAddOpen(true);
    setWeekly(false);
    setEveryWeeks(1);
    setDatesMode(false);
    setPickedDates([]);
    setRepeatDays([weekdayOf(selectedDate)]);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setNewName('');
  };

  const repeatDates = useMemo(
    () => (weekly ? datesOnWeekdays(selectedDate, horizonEnd, repeatDays, everyWeeks) : []),
    [weekly, selectedDate, horizonEnd, repeatDays, everyWeeks]
  );

  /** How the new subcategory repeats, or null for "just this day". */
  const pattern: RepeatPattern | null = weekly
    ? { kind: 'weekly', days: repeatDays, everyWeeks }
    : datesMode
    ? { kind: 'dates', dates: pickedDates }
    : null;

  const togglePicked = (date: string) =>
    setPickedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()));

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || adding) return;
    if (weekly && repeatDays.length === 0) return;
    if (datesMode && pickedDates.length === 0) return;
    setAdding(true);
    try {
      const id = pattern
        ? await onAddRepeatingSubcategory(goal.id, name, selectedDate, pattern)
        : await onAddSubcategory(goal.id, name, selectedDate);
      if (id) {
        setExpandedIds((prev) => ({ ...prev, [id]: true }));
        closeAdd();
      }
    } finally {
      setAdding(false);
    }
  };

  const isToday = selectedDate === todayStr;
  const completedCount = selectedDateTasks.filter((t) => t.completed).length;
  const milestoneMonths = goal.milestones || [];
  const isEmptyDay = subcategories.length === 0 && uncategorizedTasks.length === 0;
  const canAdd = canManageCategories;

  return (
    <div className="neu rounded-2xl p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* HEADER: what this is, which month, and how today is going */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="card-title">{isOwner ? 'Daily plan' : 'Client’s daily plan'}</span>

          {milestoneMonths.length > 0 && onSelectMonth && (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                className="chip inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                onClick={() => setShowMonthDropdown((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={showMonthDropdown}
                title="Choose a month"
              >
                <Calendar className="w-3.5 h-3.5" />
                {/* Short on a phone so the title, month and count fit on one line */}
                <span className="sm:hidden">{formatMonthKey(activeMonthKey)}</span>
                <span className="max-sm:hidden">
                  {formatFullMonth(activeMonthKey)}
                  {activeMonthKey === currentCalendarMonth ? ' (current)' : ''}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showMonthDropdown && (
                <div role="menu" className="menu menu-left pop max-h-72 overflow-y-auto">
                  {milestoneMonths.map((m) => (
                    <button
                      key={m.monthKey}
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      data-active={m.monthKey === activeMonthKey ? 'true' : undefined}
                      onClick={() => {
                        onSelectMonth(m.monthKey);
                        setShowMonthDropdown(false);
                      }}
                    >
                      <span className="flex-1">
                        {formatFullMonth(m.monthKey)}
                        {m.monthKey === currentCalendarMonth ? ' (current)' : ''}
                      </span>
                      {m.monthKey === activeMonthKey && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isToday && todayStr >= horizonStart && todayStr <= horizonEnd && (
            <button
              type="button"
              className="chip px-3 py-1.5 text-xs"
              onClick={() => selectDate(todayStr)}
            >
              Today
            </button>
          )}
          <span className="badge tabular-nums">
            {completedCount}/{selectedDateTasks.length} done
          </span>
        </div>
      </div>

      {/* STEP 1: PICK A DAY */}
      <div className="space-y-3">
        <StepHeading step={1} title="Pick a day">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 tabular-nums">{weekRange(weekDates)}</span>
            <GlassIconButton variant="tone" size="sm" title="Previous week" disabled={!canPrevWeek} onClick={() => moveWeek(-1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </GlassIconButton>
            <GlassIconButton variant="tone" size="sm" title="Next week" disabled={!canNextWeek} onClick={() => moveWeek(1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </GlassIconButton>
          </div>
        </StepHeading>

        <div className="grid grid-cols-7 gap-1 sm:gap-2.5 pb-1">
          {weekDates.map((date) => {
            const inGoal = date >= horizonStart && date <= horizonEnd;
            const selected = date === selectedDate;
            const stats = dayStats[date];
            const hasTasks = !!stats && stats.total > 0;

            return (
              <button
                key={date}
                type="button"
                className="chip flex flex-col items-center gap-0 sm:gap-0.5 px-0 py-1 sm:py-2.5 text-xs"
                data-active={selected}
                disabled={!inGoal}
                aria-pressed={selected}
                aria-label={longDate(date)}
                title={
                  !inGoal
                    ? 'Outside this goal’s months'
                    : hasTasks
                    ? `${stats.done}/${stats.total} tasks done`
                    : stats?.subs
                    ? 'Planned, no tasks yet'
                    : 'Nothing planned'
                }
                onClick={() => selectDate(date)}
              >
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wide opacity-80">
                  {WEEKDAY_SHORT[weekdayOf(date)]}
                </span>
                <span className="text-sm sm:text-base font-extrabold tabular-nums leading-tight">
                  {Number(date.slice(8, 10))}
                </span>
                {/* One mark per day: filled = all done, ring = tasks waiting, dot = planned, ★ = today */}
                <DayMark stats={stats} isToday={date === todayStr} />
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: PLAN THE DAY */}
      <div className="space-y-3.5">
        <StepHeading step={2} title={`Plan ${isToday ? 'today' : longDate(selectedDate)}`}>
          <div className="flex items-center gap-2">
            {subcategories.length > 1 && (
              <button
                type="button"
                data-plain
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                onClick={handleToggleAll}
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            )}
            {canAdd && (!isEmptyDay || addOpen) && (
              <button
                type="button"
                className="btn-tone inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                onClick={() => (addOpen ? closeAdd() : openAdd())}
                aria-expanded={addOpen}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Add subcategory</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </StepHeading>

        {/* The one place a subcategory is created: a name, and optionally a weekly repeat. */}
        {canAdd && addOpen && (
          <form onSubmit={handleAdd} className="neu-inset p-3 sm:p-4 space-y-3.5 sm:space-y-4 pop">
            <div className="space-y-2">
              <label className="section-label block" htmlFor="new-subcategory-name">
                Name
              </label>
              <input
                id="new-subcategory-name"
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Chest day"
                className="w-full text-sm rounded-xl px-3.5 py-2.5"
              />
              {quickPicks.length > 0 && (
                <div className="flex items-center gap-2 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible">
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">Quick pick</span>
                  {quickPicks.map((pick) => (
                    <button
                      key={pick}
                      type="button"
                      className="chip shrink-0 px-2.5 py-1.5 text-xs"
                      data-active={newName.trim().toLowerCase() === pick.toLowerCase()}
                      onClick={() => setNewName(pick)}
                    >
                      {pick}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <span className="section-label block">When</span>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  className="chip px-3 py-2 sm:py-1.5 text-xs"
                  data-active={!weekly && !datesMode}
                  onClick={() => {
                    setWeekly(false);
                    setDatesMode(false);
                  }}
                >
                  Just this day
                </button>
                <button
                  type="button"
                  className="chip inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs"
                  data-active={weekly && everyWeeks === 1}
                  onClick={() => {
                    setWeekly(true);
                    setDatesMode(false);
                    setEveryWeeks(1);
                    if (repeatDays.length === 0) setRepeatDays([weekdayOf(selectedDate)]);
                  }}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Every week
                </button>
                <button
                  type="button"
                  className="chip inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs"
                  data-active={weekly && everyWeeks === 2}
                  onClick={() => {
                    setWeekly(true);
                    setDatesMode(false);
                    setEveryWeeks(2);
                    if (repeatDays.length === 0) setRepeatDays([weekdayOf(selectedDate)]);
                  }}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Every other week
                </button>
                <button
                  type="button"
                  className="chip inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs"
                  data-active={datesMode}
                  onClick={() => {
                    setDatesMode(true);
                    setWeekly(false);
                    if (pickedDates.length === 0) setPickedDates([selectedDate]);
                  }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Pick dates
                </button>
              </div>

              {weekly && (
                <div className="space-y-2">
                  <WeekdayPicker value={repeatDays} onChange={setRepeatDays} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="chip px-2.5 py-1 text-[11px]"
                      data-active={repeatDays.length === 7}
                      onClick={() => setRepeatDays([0, 1, 2, 3, 4, 5, 6])}
                    >
                      Every day
                    </button>
                    <button
                      type="button"
                      className="chip px-2.5 py-1 text-[11px]"
                      data-active={repeatDays.length === 5 && [1, 2, 3, 4, 5].every((d) => repeatDays.includes(d))}
                      onClick={() => setRepeatDays([1, 2, 3, 4, 5])}
                    >
                      Weekdays
                    </button>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600">
                    {repeatDays.length === 0
                      ? 'Pick at least one day.'
                      : repeatDates.length === 0
                      ? 'No matching days left in this goal.'
                      : `${describePattern({ kind: 'weekly', days: repeatDays, everyWeeks })} from ${longDate(
                          repeatDates[0]
                        )} until ${formatMonthKey(horizonEnd.slice(0, 7))} · ${repeatDates.length} ${
                          repeatDates.length === 1 ? 'day' : 'days'
                        }.`}
                  </p>
                </div>
              )}

              {datesMode && (
                <div className="space-y-2">
                  <MiniCalendar
                    min={horizonStart}
                    max={horizonEnd}
                    selected={pickedDates}
                    onToggle={togglePicked}
                    startOn={selectedDate}
                  />
                  <p className="text-[11px] font-medium text-slate-600">
                    {pickedDates.length === 0
                      ? 'Tap the days you want. Tap a day again to remove it.'
                      : `${describePattern({ kind: 'dates', dates: pickedDates })}: ${pickedDates
                          .slice(0, 3)
                          .map((d) => shortDate(d))
                          .join(' · ')}${pickedDates.length > 3 ? ` · and ${pickedDates.length - 3} more` : ''}.`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="chip px-3.5 py-2.5 sm:py-2 text-xs" onClick={closeAdd}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-tone flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-xs"
                disabled={
                  !newName.trim() ||
                  adding ||
                  (weekly && repeatDates.length === 0) ||
                  (datesMode && pickedDates.length === 0)
                }
              >
                {weekly
                  ? everyWeeks === 2
                    ? 'Add every other week'
                    : 'Add to every week'
                  : datesMode
                  ? `Add to ${pickedDates.length} ${pickedDates.length === 1 ? 'day' : 'days'}`
                  : 'Add subcategory'}
              </button>
            </div>
          </form>
        )}

        {isEmptyDay && !addOpen && (
          <div className="neu-inset text-center px-4 py-6 sm:py-9">
            <p className="text-sm font-bold text-slate-700">Nothing planned for {longDate(selectedDate)}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {canAdd
                ? 'Add a subcategory such as “Chest day”, then fill it with tasks. Repeat it weekly if it comes back.'
                : 'Nothing has been planned for this day yet.'}
            </p>
            {canAdd && (
              <button
                type="button"
                className="btn-tone inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-xs"
                onClick={openAdd}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add subcategory</span>
              </button>
            )}
          </div>
        )}

        {uncategorizedTasks.length > 0 && (
          <SubcategoryBlock
            name="Uncategorized"
            expanded={expandedIds.__uncategorized__ !== undefined ? expandedIds.__uncategorized__ : allExpanded}
            onToggle={() => toggleExpanded('__uncategorized__')}
            tasks={uncategorizedTasks}
            goal={goal}
            canEditTasks={canManageCategories}
            canManage={false}
            onToggleTask={(taskId) => onToggleTask(goal.id, taskId)}
            onDeleteTask={(taskId) => onDeleteTask(goal.id, taskId)}
          />
        )}

        {subcategories.map((sub) => {
          const canEditThisSub = isOwner || canEditSubcategoryTasks(sub);
          const canRemoveThisSub = canEditThisSub && (isOwner || canManageCategories);

          return (
            <SubcategoryBlock
              key={sub.id}
              name={sub.name}
              expanded={expandedIds[sub.id] !== undefined ? expandedIds[sub.id] : allExpanded}
              onToggle={() => toggleExpanded(sub.id)}
              tasks={selectedDateTasks.filter((t) => t.subcategoryId === sub.id)}
              goal={goal}
              sub={sub}
              canEditTasks={canEditThisSub}
              canManage={canEditThisSub}
              canSetRole={isOwner}
              onRename={canEditThisSub ? (name) => onRenameSubcategory(goal.id, sub.id, name) : undefined}
              onSetRole={
                isOwner && onSetSubcategoryRole
                  ? (role) => onSetSubcategoryRole(goal.id, sub.id, role)
                  : undefined
              }
              onChangeRepeat={
                canEditThisSub ? (days, every) => onChangeSubcategoryRepeat(goal.id, sub.id, days, every) : undefined
              }
              onDelete={canRemoveThisSub ? (scope) => onDeleteSubcategory(goal.id, sub.id, scope) : undefined}
              onAddTask={
                canEditThisSub
                  ? (text, priority, forward) =>
                      onAddTask(goal.id, text, priority, sub.id, selectedDate, forward)
                  : undefined
              }
              onUpdateTask={
                canEditThisSub && onUpdateTask
                  ? (taskId, updates) => onUpdateTask(goal.id, taskId, updates)
                  : undefined
              }
              onToggleTask={canEditThisSub ? (taskId) => onToggleTask(goal.id, taskId) : undefined}
              onDeleteTask={canEditThisSub ? (taskId) => onDeleteTask(goal.id, taskId) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};
