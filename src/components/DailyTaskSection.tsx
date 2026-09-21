import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { Goal, Subcategory } from '../types';
import { SubcategoryBlock } from './SubcategoryBlock';
import { GlassIconButton, GlassBadge } from './UIElements';
import { getCategoryPresets } from '../categoryPresets';
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
  // On phones the preset panel is collapsed by default so the actual task list
  // is what you land on. Desktop keeps it open.
  const [showPresets, setShowPresets] = useState(false);
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

  // Domain-specific category presets based strictly on this goal's category & title
  const categoryConfig = useMemo(() => {
    return getCategoryPresets(goal.category, goal.title);
  }, [goal.category, goal.title]);

  // Previous custom subcategories from other days the user created
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
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5 transition-colors duration-200 ${
        !isOwner
          ? 'border-blue-200/90 shadow-blue-950/5'
          : 'border-purple-200/80'
      }`}
    >
      {/* HEADER & MONTH SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                !isOwner
                  ? 'text-blue-950 bg-blue-100 border-blue-300/80'
                  : 'text-purple-900 bg-purple-100 border-purple-200/90'
              }`}
            >
              {!isOwner ? 'Trainer Routine Planning' : 'Daily Action Plan'}
            </span>

            {!isOwner && (
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                Client Workspace
              </span>
            )}

            {/* MONTH SELECTOR DROPDOWN / PILL */}
            {milestoneMonths.length > 0 && onSelectMonth ? (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 border ${
                  !isOwner
                    ? 'bg-blue-50/70 border-blue-200/90'
                    : 'bg-purple-50/70 border-purple-200/90'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    !isOwner ? 'text-blue-700' : 'text-purple-700'
                  }`}
                />
                <select
                  value={activeMonthKey}
                  onChange={(e) => onSelectMonth(e.target.value)}
                  className={`text-xs font-bold bg-transparent cursor-pointer focus:outline-none ${
                    !isOwner ? 'text-blue-950' : 'text-purple-950'
                  }`}
                  title="Select month"
                >
                  {milestoneMonths.map((m) => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {formatFullMonth(m.monthKey)} {m.monthKey === currentCalendarMonth ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold ${
                  !isOwner ? 'text-blue-800' : 'text-purple-800'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 ${!isOwner ? 'text-blue-600' : 'text-purple-600'}`}
                />
                <span>{formatFullMonth(activeMonthKey)}</span>
              </div>
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
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer border ${
                !isOwner
                  ? 'text-blue-950 bg-blue-50 hover:bg-blue-100 border-blue-200'
                  : 'text-purple-900 bg-purple-50 hover:bg-purple-100 border-purple-200'
              }`}
            >
              Today
            </button>
          )}
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums border ${
              !isOwner
                ? 'bg-blue-50 text-blue-950 border-blue-200'
                : 'bg-purple-50 text-purple-900 border-purple-200'
            }`}
          >
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
          <div className="flex items-center gap-1.5">
            <GlassIconButton
              onClick={handlePrevDay}
              disabled={selectedDate === monthDays[0]?.dateStr}
              size="sm"
              variant={!isOwner ? 'blue' : 'purple'}
              title="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </GlassIconButton>
            <GlassIconButton
              onClick={handleNextDay}
              disabled={selectedDate === monthDays[monthDays.length - 1]?.dateStr}
              size="sm"
              variant={!isOwner ? 'blue' : 'purple'}
              title="Next Day"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </GlassIconButton>
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
                    ? !isOwner
                      ? 'bg-gradient-to-b from-blue-700 via-sky-800 to-blue-900 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                      : 'bg-gradient-to-b from-purple-700 via-purple-800 to-indigo-900 text-white border-purple-700 shadow-sm ring-2 ring-purple-400/40'
                    : d.isToday
                    ? !isOwner
                      ? 'bg-blue-50 text-blue-950 border-blue-300 font-semibold'
                      : 'bg-purple-50 text-purple-950 border-purple-300 font-semibold'
                    : hasTasks
                    ? !isOwner
                      ? 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
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
                          ? !isOwner ? 'bg-blue-600' : 'bg-purple-600'
                          : isSelected
                          ? !isOwner ? 'bg-blue-200' : 'bg-purple-200'
                          : !isOwner ? 'bg-blue-400' : 'bg-purple-400'
                      }`}
                      title={`${stats.done}/${stats.total} tasks completed`}
                    />
                  ) : hasSubs ? (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? (!isOwner ? 'bg-blue-200' : 'bg-purple-200') : 'bg-slate-400'
                      }`}
                      title={`${stats.subCount} subcategory scheduled`}
                    />
                  ) : d.isToday ? (
                    <span
                      className={`text-[8px] font-bold leading-none ${
                        isSelected
                          ? !isOwner ? 'text-blue-200' : 'text-purple-200'
                          : !isOwner ? 'text-blue-600' : 'text-purple-600'
                      }`}
                    >
                      ★
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

        {/* EMPTY STATE FOR THIS DAY - CATEGORY SPECIFIC */}
        {subcategories.length === 0 && uncategorizedTasks.length === 0 && (
          <div
            className={`text-center py-4 sm:py-6 px-3 sm:px-5 border border-dashed rounded-2xl space-y-3 ${
              !isOwner
                ? 'border-blue-200/80 bg-gradient-to-b from-blue-50/40 via-white to-slate-50/40'
                : 'border-purple-200/80 bg-gradient-to-b from-purple-50/40 via-white to-slate-50/40'
            }`}
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  !isOwner
                    ? 'bg-blue-100/80 text-blue-900'
                    : 'bg-purple-100/80 text-purple-800'
                }`}
              >
                <Sparkles
                  className={`w-3 h-3 ${!isOwner ? 'text-blue-600' : 'text-purple-600'}`}
                />
                <span>{categoryConfig.presetGroupLabel}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowPresets((v) => !v)}
                className={`sm:hidden inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer active:scale-95 ${
                  !isOwner
                    ? 'text-blue-800 bg-white border-blue-200'
                    : 'text-purple-800 bg-white border-purple-200'
                }`}
              >
                <span>{showPresets ? 'Hide' : 'Show presets'}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showPresets ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            <div className={showPresets ? 'space-y-3' : 'hidden sm:block space-y-3'}>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {categoryConfig.contextDescription} Choose a tailored preset below to start planning:
            </p>

            <div className="space-y-2.5 pt-1 max-w-xl mx-auto">
              {recentCustomSubNames.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Recently Used:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {recentCustomSubNames.slice(0, 4).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleAddSub(name)}
                        className="text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                    !isOwner ? 'text-blue-800' : 'text-purple-700/80'
                  }`}
                >
                  {categoryConfig.categoryName} Presets:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {categoryConfig.subcategories.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddSub(preset)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer active:scale-95 shadow-2xs ${
                        !isOwner
                          ? 'text-blue-950 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 hover:border-blue-300'
                          : 'text-purple-900 bg-purple-50 hover:bg-purple-100/80 border border-purple-200/80 hover:border-purple-300'
                      }`}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category-Specific Quick Tasks */}
              {categoryConfig.suggestedTasks && categoryConfig.suggestedTasks.length > 0 && (
                <div
                  className={`pt-2 border-t ${
                    !isOwner ? 'border-blue-100/80' : 'border-purple-100/80'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Quick Sample Tasks for {categoryConfig.categoryName}:
                  </div>
                  <div className="flex flex-col gap-1.5 text-left max-w-md mx-auto">
                    {categoryConfig.suggestedTasks.slice(0, 3).map((taskItem, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={async () => {
                          let subId: string | undefined = undefined;
                          if (taskItem.defaultSub) {
                            const existing = subcategories.find((s) => s.name === taskItem.defaultSub);
                            if (existing) {
                              subId = existing.id;
                            } else {
                              const createdId = await onAddSubcategory(goal.id, taskItem.defaultSub, selectedDate);
                              if (createdId) subId = createdId;
                            }
                          }
                          onAddTask(goal.id, taskItem.text, taskItem.priority, subId, selectedDate);
                        }}
                        className={`text-xs p-2 rounded-xl transition flex items-center justify-between gap-2 group cursor-pointer border ${
                          !isOwner
                            ? 'text-slate-700 hover:text-blue-950 bg-white/80 hover:bg-blue-50/60 border-slate-200 hover:border-blue-200'
                            : 'text-slate-700 hover:text-purple-900 bg-white/80 hover:bg-purple-50/60 border-slate-200 hover:border-purple-200'
                        }`}
                      >
                        <span className="truncate">{taskItem.text}</span>
                        <span
                          className={`text-[10px] font-semibold flex items-center gap-0.5 flex-shrink-0 group-hover:underline ${
                            !isOwner ? 'text-blue-700' : 'text-purple-600'
                          }`}
                        >
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
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
            canEditTasks={true}
            isOwner={isOwner}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
          />
        )}

        {subcategories.map((sub) => {
          const isExpanded = expandedIds[sub.id] !== undefined ? expandedIds[sub.id] : allExpanded;
          
          // Role checking
          const subcategoryRole = sub.editorRole || null;
          const currentUserRole = professionalRole || null;
          const canEditThisSub = isOwner || canEditSubcategoryTasks(sub);

          return (
            <SubcategoryBlock
              key={sub.id}
              name={sub.name}
              expanded={isExpanded}
              onToggle={() => toggleExpanded(sub.id)}
              onRename={canEditThisSub ? (nextName) => onRenameSubcategory(goal.id, sub.id, nextName) : undefined}
              onDelete={canEditThisSub && (isOwner || canManageCategories) ? () => onDeleteSubcategory(goal.id, sub.id) : undefined}
              tasks={selectedDateTasks.filter((t) => t.subcategoryId === sub.id)}
              goal={goal}
              subcategoryId={sub.id}
              selectedDate={selectedDate}
              editorRole={sub.editorRole || ''}
              canDelete={canEditThisSub && (isOwner || canManageCategories)}
              canAdd={canEditThisSub}
              canRename={canEditThisSub}
              canEditTasks={canEditThisSub}
              isOwner={isOwner}
              onSetRole={
                isOwner && onSetSubcategoryRole
                  ? (nextRole) => onSetSubcategoryRole(goal.id, sub.id, nextRole)
                  : undefined
              }
              onAddTask={canEditThisSub ? onAddTask : undefined}
              onUpdateTask={canEditThisSub ? onUpdateTask : undefined}
              onToggleTask={canEditThisSub ? onToggleTask : undefined}
              onDeleteTask={canEditThisSub ? onDeleteTask : undefined}
            />
          );
        })}
      </div>

      {/* ADD SUBCATEGORY FORM FOR THIS DAY */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddSub();
        }}
        className="pt-1 flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          placeholder={categoryConfig.placeholder}
          value={newSubName}
          onChange={(e) => setNewSubName(e.target.value)}
          className={`flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 ${
            !isOwner
              ? 'focus:ring-blue-500/20 focus:border-blue-600'
              : 'focus:ring-purple-500/20 focus:border-purple-600'
          }`}
        />
        <button
          type="submit"
          disabled={!newSubName.trim()}
          className={`w-full sm:w-auto px-4 py-2.5 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer shrink-0 shadow-2xs active:scale-98 ${
            !isOwner
              ? 'bg-gradient-to-r from-blue-700 to-sky-800 hover:from-blue-800 hover:to-sky-900'
              : 'bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900'
          }`}
        >
          + Add Category
        </button>
      </form>
    </div>
  );
};
