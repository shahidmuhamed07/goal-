import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Goal, Subcategory } from '../types';
import { SubcategoryBlock } from './SubcategoryBlock';
import {
  getTodayDateString,
  getCurrentMonthKey,
  getMonthDays,
  formatDisplayDate,
  formatFullMonth,
} from '../utils';

interface DailyTaskSectionProps {
  goal: Goal;
  isOwner?: boolean;
  canManageCategories?: boolean;
  professionalRole?: string | null;
  selectedMonthKey?: string;
  onSelectMonth?: (monthKey: string) => void;
  canEditSubcategoryTasks: (sub?: Subcategory) => boolean;
  onAddSubcategory: (goalId: string, name: string, date?: string) => Promise<string | null>;
  onRenameSubcategory: (goalId: string, subcategoryId: string, name: string) => void;
  onDeleteSubcategory: (goalId: string, subcategoryId: string) => void;
  onSetSubcategoryRole?: (goalId: string, subcategoryId: string, editorRole: string) => void;
  onAddTask: (goalId: string, text: string, priority: 'high' | 'medium' | 'low', subcategoryId?: string, date?: string) => void;
  onUpdateTask?: (goalId: string, taskId: string, updates: Partial<any>) => void;
  onToggleTask: (goalId: string, taskId: string) => void;
  onDeleteTask: (goalId: string, taskId: string) => void;
}

const FITNESS_SUBCATEGORY_SUGGESTIONS = [
  'Chest Day',
  'Back & Biceps',
  'Legs & Core',
  'Shoulders & Arms',
  'Push Day',
  'Pull Day',
  'Cardio & HIIT',
  'Diet & Nutrition',
  'Rest & Recovery',
];

const GENERAL_SUBCATEGORY_SUGGESTIONS = [
  'Morning Routine',
  'Workout & Fitness',
  'Diet & Nutrition',
  'Deep Work / Study',
  'Daily Habits',
  'Evening Review',
];

export const DailyTaskSection: React.FC<DailyTaskSectionProps> = ({
  goal,
  isOwner = true,
  canManageCategories = true,
  professionalRole,
  selectedMonthKey,
  onSelectMonth,
  canEditSubcategoryTasks,
  onAddSubcategory,
  onRenameSubcategory,
  onDeleteSubcategory,
  onSetSubcategoryRole,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const todayStr = getTodayDateString();
  const currentCalendarMonth = getCurrentMonthKey();
  const activeMonthKey = selectedMonthKey || currentCalendarMonth;

  // Initialize selected date based on active month
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (activeMonthKey === currentCalendarMonth) return todayStr;
    return `${activeMonthKey}-01`;
  });

  const [newSubName, setNewSubName] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(true);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  // Sync selectedDate when activeMonthKey changes
  useEffect(() => {
    if (!selectedDate.startsWith(activeMonthKey)) {
      if (activeMonthKey === currentCalendarMonth) {
        setSelectedDate(todayStr);
      } else {
        setSelectedDate(`${activeMonthKey}-01`);
      }
    }
  }, [activeMonthKey, currentCalendarMonth, todayStr, selectedDate]);

  const monthDays = useMemo(() => getMonthDays(activeMonthKey), [activeMonthKey]);

  // Tasks for the selected date
  const selectedDateTasks = useMemo(() => {
    return (goal.tasks || []).filter((t) => t.date === selectedDate);
  }, [goal.tasks, selectedDate]);

  // Subcategories SPECIFIC to the selected date
  const subcategories = useMemo(() => {
    return (goal.subcategories || [])
      .filter((s) => {
        if (s.date) {
          return s.date === selectedDate;
        }
        // Legacy fallback for subcategories created without explicit date:
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

  // Task counts per date across the whole month for calendar indicators
  const tasksByDate = useMemo(() => {
    const map: Record<string, { total: number; done: number; subCount: number }> = {};
    (goal.tasks || []).forEach((t) => {
      if (t.date && t.date.startsWith(activeMonthKey)) {
        if (!map[t.date]) {
          map[t.date] = { total: 0, done: 0, subCount: 0 };
        }
        map[t.date].total += 1;
        if (t.completed) map[t.date].done += 1;
      }
    });
    (goal.subcategories || []).forEach((s) => {
      if (s.date && s.date.startsWith(activeMonthKey)) {
        if (!map[s.date]) {
          map[s.date] = { total: 0, done: 0, subCount: 0 };
        }
        map[s.date].subCount += 1;
      }
    });
    return map;
  }, [goal.tasks, goal.subcategories, activeMonthKey]);

  const uncategorizedTasks = useMemo(
    () => selectedDateTasks.filter((t) => !t.subcategoryId),
    [selectedDateTasks]
  );

  // Auto-scroll selected date into view
  useEffect(() => {
    if (dateScrollRef.current) {
      const activeEl = dateScrollRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }
  }, [selectedDate, activeMonthKey]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: prev[id] !== undefined ? !prev[id] : !allExpanded,
    }));
  };

  const handleToggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    const newMap: Record<string, boolean> = {};
    subcategories.forEach((s) => {
      newMap[s.id] = next;
    });
    newMap['__uncategorized__'] = next;
    setExpandedIds(newMap);
  };

  const handleAddSub = async (nameToAdd?: string) => {
    const name = (nameToAdd || newSubName).trim();
    if (!name) return;
    const id = await onAddSubcategory(goal.id, name, selectedDate);
    if (!nameToAdd) setNewSubName('');
    if (id) {
      setExpandedIds((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handlePrevDay = () => {
    const idx = monthDays.findIndex((d) => d.dateStr === selectedDate);
    if (idx > 0) {
      setSelectedDate(monthDays[idx - 1].dateStr);
    }
  };

  const handleNextDay = () => {
    const idx = monthDays.findIndex((d) => d.dateStr === selectedDate);
    if (idx >= 0 && idx < monthDays.length - 1) {
      setSelectedDate(monthDays[idx + 1].dateStr);
    }
  };

  // Check if goal is fitness related to customize suggestion presets
  const isFitness = useMemo(() => {
    const cat = (goal.category || '').toLowerCase();
    const title = (goal.title || '').toLowerCase();
    return cat.includes('health') || cat.includes('fitness') || title.includes('gym') || title.includes('workout') || title.includes('fit');
  }, [goal.category, goal.title]);

  const suggestions = isFitness ? FITNESS_SUBCATEGORY_SUGGESTIONS : GENERAL_SUBCATEGORY_SUGGESTIONS;

  // Previous subcategories from other days the user created
  const recentCustomSubNames = useMemo(() => {
    const currentNames = new Set(subcategories.map((s) => s.name.toLowerCase()));
    const list: string[] = [];
    (goal.subcategories || []).forEach((s) => {
      if (s.name && !currentNames.has(s.name.toLowerCase()) && !list.includes(s.name)) {
        list.push(s.name);
      }
    });
    return list;
  }, [goal.subcategories, subcategories]);

  const isTodaySelected = selectedDate === todayStr;
  const completedCount = selectedDateTasks.filter((t) => t.completed).length;
  const milestoneMonths = goal.milestones || [];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
      {/* HEADER & MONTH SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              Daily Action Plan
            </span>

            {/* MONTH SELECTOR DROPDOWN / PILL */}
            {milestoneMonths.length > 0 && onSelectMonth ? (
              <select
                value={activeMonthKey}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                title="Select month"
              >
                {milestoneMonths.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    📅 {formatFullMonth(m.monthKey)} {m.monthKey === currentCalendarMonth ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                {formatFullMonth(activeMonthKey)}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            {formatDisplayDate(selectedDate)}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {!isTodaySelected && activeMonthKey === currentCalendarMonth && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              Today
            </button>
          )}
          <span className="text-xs font-bold px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-full tabular-nums">
            {completedCount}/{selectedDateTasks.length} Done
          </span>
        </div>
      </div>

      {/* DATES CALENDAR STRIP */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700 text-[11px] sm:text-xs">
            Days in <strong className="text-slate-900">{formatFullMonth(activeMonthKey)}</strong>:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={selectedDate === monthDays[0]?.dateStr}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs"
              title="Previous Day"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDate === monthDays[monthDays.length - 1]?.dateStr}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-xs"
              title="Next Day"
            >
              ▶
            </button>
          </div>
        </div>

        <div
          ref={dateScrollRef}
          className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {monthDays.map((d) => {
            const isSelected = d.dateStr === selectedDate;
            const stats = tasksByDate[d.dateStr];
            const hasTasks = stats && stats.total > 0;
            const hasSubs = stats && stats.subCount > 0;
            const allDone = hasTasks && stats.done === stats.total;

            return (
              <button
                key={d.dateStr}
                type="button"
                data-active={isSelected}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[3rem] sm:min-w-[3.25rem] py-1.5 sm:py-2 px-1 rounded-xl border transition-all cursor-pointer select-none relative ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-emerald-500/30'
                    : d.isToday
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-semibold'
                    : hasTasks
                    ? 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    : 'bg-slate-50/60 text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-medium opacity-80">
                  {d.dayName}
                </span>
                <span className="text-xs sm:text-sm font-bold tabular-nums">
                  {d.dayNum}
                </span>

                {/* Micro indicators for tasks / subs */}
                <div className="h-2 flex items-center justify-center gap-0.5 mt-0.5">
                  {hasTasks ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        allDone
                          ? 'bg-emerald-400'
                          : isSelected
                          ? 'bg-emerald-300'
                          : 'bg-amber-500'
                      }`}
                      title={`${stats.done}/${stats.total} tasks completed`}
                    />
                  ) : hasSubs ? (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-slate-400' : 'bg-slate-400'
                      }`}
                      title={`${stats.subCount} subcategory scheduled`}
                    />
                  ) : d.isToday ? (
                    <span
                      className={`text-[8px] font-bold leading-none ${
                        isSelected ? 'text-emerald-300' : 'text-emerald-600'
                      }`}
                    >
                      •
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBCATEGORIES AND TASKS FOR SELECTED DAY */}
      <div className="space-y-2.5 sm:space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">
              Subcategories
            </span>
            <span className="text-[11px] text-slate-400">({subcategories.length})</span>
          </div>
          {subcategories.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
            >
              {allExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>

        {/* EMPTY STATE FOR THIS DAY */}
        {subcategories.length === 0 && uncategorizedTasks.length === 0 && (
          <div className="text-center py-6 px-3 sm:px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2.5">
            <div className="text-xs sm:text-sm font-semibold text-slate-700">
              No categories scheduled for this day
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {canManageCategories
                ? 'Plan focus routines for this day. Click a preset below or type a category:'
                : 'The client has not assigned a category for you to work on for this day.'}
            </p>

            {canManageCategories && (
            <div className="space-y-2 pt-1 max-w-lg mx-auto">
              {recentCustomSubNames.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Recent:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {recentCustomSubNames.slice(0, 4).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleAddSub(name)}
                        className="text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Presets:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {suggestions.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddSub(preset)}
                      className="text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
            selectedDate={selectedDate}
            canDelete={false}
            canAdd={false}
            canRename={false}
            canEditTasks={isOwner}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
          />
        )}

        {subcategories.map((sub) => {
          const isExpanded = expandedIds[sub.id] !== undefined ? expandedIds[sub.id] : allExpanded;
          const canEditThisSubcategory = canEditSubcategoryTasks(sub);
          return (
            <SubcategoryBlock
              key={sub.id}
              name={sub.name}
              expanded={isExpanded}
              onToggle={() => toggleExpanded(sub.id)}
              onRename={canManageCategories ? (nextName) => onRenameSubcategory(goal.id, sub.id, nextName) : undefined}
              onDelete={canManageCategories ? () => onDeleteSubcategory(goal.id, sub.id) : undefined}
              tasks={selectedDateTasks.filter((t) => t.subcategoryId === sub.id)}
              goal={goal}
              subcategoryId={sub.id}
              selectedDate={selectedDate}
              editorRole={sub.editorRole || ''}
              canDelete={canManageCategories}
              canAdd={canEditThisSubcategory}
              canRename={canManageCategories}
              canEditTasks={canEditThisSubcategory}
              onSetRole={
                canManageCategories && onSetSubcategoryRole
                  ? (nextRole) => onSetSubcategoryRole(goal.id, sub.id, nextRole)
                  : undefined
              }
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
            />
          );
        })}
      </div>

      {/* Only the client can create a new work category. */}
      {canManageCategories && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddSub();
        }}
        className="pt-1 flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          placeholder="New subcategory (e.g. Chest Day, Leg Day)..."
          value={newSubName}
          onChange={(e) => setNewSubName(e.target.value)}
          className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={!newSubName.trim()}
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer shrink-0"
        >
          + Add Category
        </button>
      </form>
      )}
    </div>
  );
};
