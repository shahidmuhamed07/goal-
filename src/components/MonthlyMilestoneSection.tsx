import React, { useState } from 'react';
import { Check, Edit3, Calendar, ChevronLeft, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Goal, Milestone } from '../types';
import { ProgressBar } from './UIElements';
import {
  getCurrentMonthKey,
  formatFullMonth,
  formatMonthKey,
  getTodayDateString,
  formatDisplayDate,
  getMonthsDifference,
} from '../utils';

interface MonthlyMilestoneSectionProps {
  goal: Goal;
  readOnly?: boolean;
  isOwner?: boolean;
  selectedMonthKey?: string;
  onSelectMonth?: (monthKey: string) => void;
  onToggleMilestone: (goalId: string, milestoneId: string) => void;
  onUpdateMilestoneTitle: (goalId: string, milestoneId: string, title: string) => void;
}

export const MonthlyMilestoneSection: React.FC<MonthlyMilestoneSectionProps> = ({
  goal,
  readOnly = false,
  isOwner = true,
  selectedMonthKey,
  onSelectMonth,
  onToggleMilestone,
  onUpdateMilestoneTitle,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const currentMonthKey = getCurrentMonthKey();
  const activeMonth = selectedMonthKey || currentMonthKey;
  const todayStr = getTodayDateString();

  const milestones = goal.milestones || [];
  const totalMonths = milestones.length;
  const completedMonths = milestones.filter((m) => m.completed).length;
  const overallPct = totalMonths > 0 ? Math.round((completedMonths / totalMonths) * 100) : 0;

  // Active milestone for current selected month
  const activeMilestone = milestones.find((m) => m.monthKey === activeMonth) || milestones[0];
  const activeMonthIndex = milestones.findIndex((m) => m.monthKey === activeMonth);
  const monthsFromCurrent = getMonthsDifference(currentMonthKey, activeMonth);

  // Tasks in this active month
  const monthTasks = (goal.tasks || []).filter(
    (t) => t.date && t.date.startsWith(activeMonth)
  );
  const monthTasksCompleted = monthTasks.filter((t) => t.completed).length;
  const monthTasksTotal = monthTasks.length;

  // Monthly Progression Calculation
  const monthProgressPct = activeMilestone?.completed
    ? 100
    : monthTasksTotal > 0
    ? Math.round((monthTasksCompleted / monthTasksTotal) * 100)
    : 0;

  const handleStartEdit = (m: Milestone) => {
    setEditingId(m.id);
    setEditVal(m.title);
  };

  const handleSaveEdit = (mId: string) => {
    if (editVal.trim()) {
      onUpdateMilestoneTitle(goal.id, mId, editVal.trim());
    }
    setEditingId(null);
  };

  const handlePrevMonth = () => {
    const currentIndex = milestones.findIndex((m) => m.monthKey === activeMonth);
    if (currentIndex > 0 && onSelectMonth) {
      onSelectMonth(milestones[currentIndex - 1].monthKey);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = milestones.findIndex((m) => m.monthKey === activeMonth);
    if (currentIndex >= 0 && currentIndex < milestones.length - 1 && onSelectMonth) {
      onSelectMonth(milestones[currentIndex + 1].monthKey);
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-colors duration-200 ${
        !isOwner ? 'border-amber-200/90 shadow-amber-950/5' : 'border-emerald-200/80'
      }`}
    >
      {/* HEADER: COMPACT MONTH & DATE WITH PROMINENT MONTH SELECTION BADGE */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md flex items-center gap-1 border ${
              !isOwner
                ? 'text-amber-950 bg-amber-100 border-amber-300/80'
                : 'text-emerald-900 bg-emerald-100 border-emerald-200/90'
            }`}
          >
            <Calendar className={`w-3 h-3 ${!isOwner ? 'text-amber-700' : 'text-emerald-700'}`} />
            <span>Monthly Milestone</span>
          </span>

          {/* DISPLAY HOW MUCH MONTH SELECTED & MONTH DIFFERENCE */}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${
              !isOwner
                ? 'bg-amber-50 text-amber-950 border-amber-300'
                : 'bg-emerald-100 text-emerald-950 border-emerald-300'
            }`}
          >
            <Sparkles className={`w-2.5 h-2.5 ${!isOwner ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>
              Month {activeMonthIndex >= 0 ? activeMonthIndex + 1 : 1} of {totalMonths} Selected
            </span>
            {monthsFromCurrent !== 0 && (
              <span className={`font-extrabold ${!isOwner ? 'text-amber-700' : 'text-emerald-700'}`}>
                ({monthsFromCurrent > 0 ? `+${monthsFromCurrent}m` : `${monthsFromCurrent}m`} diff)
              </span>
            )}
          </span>

          {activeMonth === currentMonthKey ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                !isOwner
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              Current Month
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSelectMonth && onSelectMonth(currentMonthKey)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer border ${
                !isOwner
                  ? 'text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border-amber-200'
                  : 'text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/70'
              }`}
            >
              Go to Current
            </button>
          )}
        </div>

        {/* Current Date Badge */}
        <div
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border ${
            !isOwner
              ? 'text-amber-950 bg-amber-50/80 border-amber-200/80'
              : 'text-emerald-950 bg-emerald-50/80 border-emerald-200/80'
          }`}
        >
          {formatDisplayDate(todayStr)}
        </div>
      </div>

      {/* ACTIVE MONTH PRIMARY CARD */}
      {activeMilestone ? (
        <div
          className={`rounded-xl p-3.5 sm:p-4 space-y-3 shadow-2xs border ${
            !isOwner
              ? 'bg-amber-50/40 border-amber-200/80'
              : 'bg-emerald-50/30 border-emerald-200/80'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {formatFullMonth(activeMilestone.monthKey)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Target milestone for this month (Month {activeMonthIndex >= 0 ? activeMonthIndex + 1 : 1} of {totalMonths})
              </div>
            </div>

            {/* Checkbox for Milestone Accomplishment */}
            {!readOnly && (
              <label
                className={`flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none bg-white border px-2.5 py-1.5 rounded-lg shadow-2xs transition ${
                  !isOwner
                    ? 'border-amber-200/90 hover:border-amber-300 hover:text-amber-950'
                    : 'border-emerald-200/90 hover:border-emerald-300 hover:text-emerald-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={activeMilestone.completed}
                  onChange={() => onToggleMilestone(goal.id, activeMilestone.id)}
                  className={`w-4 h-4 rounded border-slate-300 cursor-pointer ${
                    !isOwner
                      ? 'text-amber-700 focus:ring-amber-500'
                      : 'text-emerald-700 focus:ring-emerald-500'
                  }`}
                />
                <span
                  className={`font-semibold text-[11px] ${
                    !isOwner ? 'text-amber-950' : 'text-emerald-950'
                  }`}
                >
                  {activeMilestone.completed ? 'Milestone Achieved' : 'Mark Achieved'}
                </span>
              </label>
            )}
          </div>

          {/* Editable Milestone Title */}
          {editingId === activeMilestone.id ? (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveEdit(activeMilestone.id);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className={`flex-1 text-xs sm:text-sm bg-white border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 ${
                  !isOwner
                    ? 'border-amber-200 focus:ring-amber-500/20 focus:border-amber-600'
                    : 'border-emerald-200 focus:ring-emerald-500/20 focus:border-emerald-600'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleSaveEdit(activeMilestone.id)}
                className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !isOwner
                    ? 'bg-amber-700 hover:bg-amber-800'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                Save
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                if (!readOnly) handleStartEdit(activeMilestone);
              }}
              className={`text-xs sm:text-sm font-medium p-2.5 rounded-lg transition flex items-center justify-between gap-2 ${
                readOnly
                  ? 'bg-white/80 border border-slate-200/60'
                  : !isOwner
                  ? 'bg-white border border-amber-100 hover:border-amber-300 cursor-pointer group shadow-2xs'
                  : 'bg-white border border-emerald-100 hover:border-emerald-300 cursor-pointer group shadow-2xs'
              }`}
            >
              <span className={activeMilestone.completed ? 'line-through text-slate-400' : 'text-slate-800'}>
                {activeMilestone.title || <span className="italic text-slate-400">Click to set milestone description...</span>}
              </span>
              {!readOnly && (
                <Edit3
                  className={`w-3.5 h-3.5 text-slate-400 transition-colors flex-shrink-0 ${
                    !isOwner ? 'group-hover:text-amber-700' : 'group-hover:text-emerald-700'
                  }`}
                />
              )}
            </div>
          )}

          {/* ONE-MONTH PROGRESSION BAR */}
          <div
            className={`pt-1.5 border-t space-y-1.5 ${
              !isOwner ? 'border-amber-100/80' : 'border-emerald-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">Month Progression</span>
              <span
                className={`font-bold ${!isOwner ? 'text-amber-950' : 'text-emerald-950'}`}
              >
                {monthProgressPct}%
              </span>
            </div>
            <ProgressBar
              value={monthProgressPct}
              height="h-2"
              color={!isOwner ? 'bg-amber-600' : 'bg-emerald-600'}
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>
                {monthTasksTotal > 0
                  ? `${monthTasksCompleted} of ${monthTasksTotal} tasks done`
                  : 'No tasks scheduled yet'}
              </span>
              <span
                className={`font-medium ${!isOwner ? 'text-amber-900' : 'text-emerald-900'}`}
              >
                {activeMilestone.completed ? 'Milestone: Achieved' : 'Milestone: In Progress'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-slate-400">
          No milestone created for this month yet.
        </div>
      )}

      {/* MINIMIZED OTHER MONTHS SELECTOR WITH DARK & LIGHT PALETTE */}
      {milestones.length > 1 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span>Goal Horizon Months ({milestones.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={milestones.findIndex((m) => m.monthKey === activeMonth) === 0}
                className={`p-1 rounded text-slate-600 disabled:opacity-30 cursor-pointer ${
                  !isOwner ? 'hover:bg-amber-50 hover:text-amber-950' : 'hover:bg-emerald-50 hover:text-emerald-950'
                }`}
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={milestones.findIndex((m) => m.monthKey === activeMonth) === milestones.length - 1}
                className={`p-1 rounded text-slate-600 disabled:opacity-30 cursor-pointer ${
                  !isOwner ? 'hover:bg-amber-50 hover:text-amber-950' : 'hover:bg-emerald-50 hover:text-emerald-950'
                }`}
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compact horizontal scrollable list of months in dark and light theme */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
            {milestones.map((m, idx) => {
              const isSelected = m.monthKey === activeMonth;
              const isCurrent = m.monthKey === currentMonthKey;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer border ${
                    !isOwner
                      ? isSelected
                        ? 'bg-amber-700 text-white border-amber-800 shadow-2xs font-bold'
                        : m.completed
                        ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                        : isCurrent
                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                      : isSelected
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs font-bold'
                      : m.completed
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200'
                      : isCurrent
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  {m.completed && (
                    <CheckCircle2
                      className={`w-3 h-3 ${!isOwner ? 'text-amber-700' : 'text-emerald-700'}`}
                    />
                  )}
                  <span>{formatMonthKey(m.monthKey)}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : !isOwner
                        ? 'bg-amber-200/60 text-amber-950'
                        : 'bg-emerald-200/60 text-emerald-950'
                    }`}
                  >
                    M{idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MINIMAL OVERALL PROGRESSION FOOTER */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
        <span>Full Goal Horizon: {overallPct}% complete</span>
        <span className={!isOwner ? 'text-amber-900 font-semibold' : 'text-emerald-900 font-semibold'}>
          {completedMonths}/{totalMonths} months achieved
        </span>
      </div>
    </div>
  );
};

