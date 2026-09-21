import React, { useState } from 'react';
import { Check, X, Edit3, Calendar, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Goal, Milestone } from '../types';
import { ProgressBar } from './UIElements';
import {
  getCurrentMonthKey,
  formatFullMonth,
  formatMonthKey,
  getTodayDateString,
  formatDisplayDate,
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

  // A note that still holds the generated text ("Checkpoint for Sep 2026") has
  // not been written by the user yet, so it keeps the roomy tap-anywhere bar.
  // Once they write their own, it collapses to a compact pencil button.
  const isGeneratedTitle =
    !!activeMilestone &&
    (!activeMilestone.title ||
      activeMilestone.title.trim() === `Checkpoint for ${formatMonthKey(activeMilestone.monthKey)}`);

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
        !isOwner ? 'border-blue-200/90 shadow-blue-950/5' : 'border-purple-200/80'
      }`}
    >
      {/* HEADER: SECTION LABEL AND TODAY'S DATE ONLY */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md flex items-center gap-1 border ${
              !isOwner
                ? 'text-blue-950 bg-blue-100 border-blue-300/80'
                : 'text-purple-900 bg-purple-100 border-purple-200/90'
            }`}
          >
            <Calendar className={`w-3 h-3 ${!isOwner ? 'text-blue-700' : 'text-purple-700'}`} />
            <span>Monthly Milestone</span>
          </span>
        </div>

        {/* Current Date Badge */}
        <div
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border ${
            !isOwner
              ? 'text-blue-950 bg-blue-50/80 border-blue-200/80'
              : 'text-purple-950 bg-purple-50/80 border-purple-200/80'
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
              ? 'bg-blue-50/40 border-blue-200/80'
              : 'bg-purple-50/30 border-purple-200/80'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {formatFullMonth(activeMilestone.monthKey)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Target milestone for this month
              </div>
            </div>

            {/* Checkbox for Milestone Accomplishment */}
            {!readOnly && (
              <label
                className={`flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none bg-white border px-2.5 py-1.5 rounded-lg shadow-2xs transition ${
                  !isOwner
                    ? 'border-blue-200/90 hover:border-blue-300 hover:text-blue-950'
                    : 'border-purple-200/90 hover:border-purple-300 hover:text-purple-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={activeMilestone.completed}
                  onChange={() => onToggleMilestone(goal.id, activeMilestone.id)}
                  className={`w-4 h-4 rounded border-slate-300 cursor-pointer ${
                    !isOwner
                      ? 'accent-blue-700 text-blue-700 focus:ring-blue-500'
                      : 'accent-purple-700 text-purple-700 focus:ring-purple-500'
                  }`}
                />
                <span
                  className={`font-semibold text-[11px] ${
                    !isOwner ? 'text-blue-950' : 'text-purple-950'
                  }`}
                >
                  {activeMilestone.completed ? 'Milestone Achieved' : 'Mark Achieved'}
                </span>
              </label>
            )}
          </div>

          {/* Milestone note. Untouched text keeps the full-width tap target;
              a written note shows quietly with only a pencil button to edit. */}
          {editingId === activeMilestone.id ? (
            <div className="flex items-center gap-1.5 pt-1">
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
                className={`flex-1 min-w-0 text-xs sm:text-sm bg-white border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 ${
                  !isOwner
                    ? 'border-blue-200 focus:ring-blue-500/20 focus:border-blue-600'
                    : 'border-purple-200 focus:ring-purple-500/20 focus:border-purple-600'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleSaveEdit(activeMilestone.id)}
                title="Save milestone note"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition cursor-pointer shrink-0 ${
                  !isOwner
                    ? 'bg-blue-700 hover:bg-blue-800'
                    : 'bg-purple-700 hover:bg-purple-800'
                }`}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                title="Cancel"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : isGeneratedTitle ? (
            <button
              type="button"
              onClick={() => {
                if (!readOnly) handleStartEdit(activeMilestone);
              }}
              disabled={readOnly}
              className={`w-full text-left text-xs sm:text-sm font-medium p-2.5 rounded-lg transition flex items-center justify-between gap-2 ${
                readOnly
                  ? 'bg-white/80 border border-slate-200/60'
                  : !isOwner
                  ? 'bg-white border border-blue-100 hover:border-blue-300 cursor-pointer group shadow-2xs'
                  : 'bg-white border border-purple-100 hover:border-purple-300 cursor-pointer group shadow-2xs'
              }`}
            >
              <span className="text-slate-600">
                {activeMilestone.title || "Tap here to write this month's milestone..."}
              </span>
              {!readOnly && (
                <Edit3
                  className={`w-3.5 h-3.5 text-slate-400 transition-colors flex-shrink-0 ${
                    !isOwner ? 'group-hover:text-blue-700' : 'group-hover:text-purple-700'
                  }`}
                />
              )}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span
                className={`text-sm font-medium min-w-0 truncate ${
                  activeMilestone.completed ? 'line-through text-slate-400' : 'text-slate-800'
                }`}
              >
                {activeMilestone.title}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleStartEdit(activeMilestone)}
                  title="Edit milestone note"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border shadow-2xs transition cursor-pointer shrink-0 ${
                    !isOwner
                      ? 'border-blue-200/90 text-blue-800 bg-white hover:bg-blue-50 hover:border-blue-300'
                      : 'border-purple-200/90 text-purple-800 bg-white hover:bg-purple-50 hover:border-purple-300'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* ONE-MONTH PROGRESSION BAR */}
          <div
            className={`pt-1.5 border-t space-y-1.5 ${
              !isOwner ? 'border-blue-100/80' : 'border-purple-100/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">Month Progression</span>
              <span
                className={`font-bold ${!isOwner ? 'text-blue-950' : 'text-purple-950'}`}
              >
                {monthProgressPct}%
              </span>
            </div>
            <ProgressBar
              value={monthProgressPct}
              height="h-2"
              color={!isOwner ? 'bg-blue-600' : 'bg-purple-600'}
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>
                {monthTasksTotal > 0
                  ? `${monthTasksCompleted} of ${monthTasksTotal} tasks done`
                  : 'No tasks scheduled yet'}
              </span>
              <span
                className={`font-medium ${!isOwner ? 'text-blue-900' : 'text-purple-900'}`}
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
              <span>Goal Horizon</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={milestones.findIndex((m) => m.monthKey === activeMonth) === 0}
                className={`p-1 rounded text-slate-600 disabled:opacity-30 cursor-pointer ${
                  !isOwner ? 'hover:bg-blue-50 hover:text-blue-950' : 'hover:bg-purple-50 hover:text-purple-950'
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
                  !isOwner ? 'hover:bg-blue-50 hover:text-blue-950' : 'hover:bg-purple-50 hover:text-purple-950'
                }`}
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Every month of the horizon stays visible, wrapping when space runs out */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {milestones.map((m) => {
              const isSelected = m.monthKey === activeMonth;
              const isCurrent = m.monthKey === currentMonthKey;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
                  className={`px-3.5 py-2 rounded-xl text-sm sm:text-base font-semibold flex items-center gap-2 whitespace-nowrap transition cursor-pointer border ${
                    !isOwner
                      ? isSelected
                        ? 'bg-blue-700 text-white border-blue-800 shadow-2xs font-bold'
                        : m.completed
                        ? 'bg-blue-100 text-blue-950 border-blue-300 hover:bg-blue-200'
                        : isCurrent
                        ? 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                      : isSelected
                      ? 'bg-purple-700 text-white border-purple-800 shadow-2xs font-bold'
                      : m.completed
                      ? 'bg-purple-100 text-purple-950 border-purple-300 hover:bg-purple-200'
                      : isCurrent
                      ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200 hover:bg-purple-50/50'
                  }`}
                >
                  {m.completed && (
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        isSelected
                          ? 'text-white'
                          : !isOwner
                          ? 'text-blue-700'
                          : 'text-purple-700'
                      }`}
                    />
                  )}
                  <span>{formatMonthKey(m.monthKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MINIMAL OVERALL PROGRESSION FOOTER */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
        <span>Full Goal Horizon: {overallPct}% complete</span>
        <span className={!isOwner ? 'text-blue-900 font-semibold' : 'text-purple-900 font-semibold'}>
          {completedMonths}/{totalMonths} months achieved
        </span>
      </div>
    </div>
  );
};

