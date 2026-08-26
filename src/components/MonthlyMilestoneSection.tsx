import React, { useState } from 'react';
import { Goal, Milestone } from '../types';
import { ProgressBar } from './UIElements';
import { getCurrentMonthKey, formatFullMonth } from '../utils';

interface MonthlyMilestoneSectionProps {
  goal: Goal;
  readOnly?: boolean;
  selectedMonthKey?: string;
  onSelectMonth?: (monthKey: string) => void;
  onToggleMilestone: (goalId: string, milestoneId: string) => void;
  onUpdateMilestoneTitle: (goalId: string, milestoneId: string, title: string) => void;
}

export const MonthlyMilestoneSection: React.FC<MonthlyMilestoneSectionProps> = ({
  goal,
  readOnly = false,
  selectedMonthKey,
  onSelectMonth,
  onToggleMilestone,
  onUpdateMilestoneTitle,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const currentMonthKey = getCurrentMonthKey();
  const activeMonth = selectedMonthKey || currentMonthKey;

  const milestones = goal.milestones || [];
  const total = milestones.length;
  const completed = milestones.filter((m) => m.completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

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

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              Roadmap & Milestones
            </span>
            <span className="text-xs text-slate-400 font-medium">Click any month to view daily tasks</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Monthly Milestones</h2>
        </div>
        <div className="w-full sm:w-36">
          <div className="flex justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Progress</span>
            <span className="text-slate-900 font-bold">{pct}%</span>
          </div>
          <ProgressBar value={pct} height="h-2" />
        </div>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {milestones.map((m) => {
          const isThisMonth = m.monthKey === currentMonthKey;
          const isSelected = m.monthKey === activeMonth;

          // Count tasks in this month
          const monthTasksCount = (goal.tasks || []).filter(
            (t) => t.date && t.date.startsWith(m.monthKey)
          ).length;

          return (
            <div key={m.id} className="relative group">
              {/* ROUND CIRCLE ON THE TIMELINE - INTERACTIVE & FILLED WHEN SELECTED */}
              <button
                type="button"
                onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
                className={`absolute -left-6 top-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer z-10 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm scale-110'
                    : m.completed
                    ? 'border-emerald-500 bg-emerald-500 text-white hover:ring-2 hover:ring-emerald-200'
                    : isThisMonth
                    ? 'border-emerald-500 bg-white ring-2 ring-emerald-100 hover:bg-emerald-50'
                    : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/50'
                }`}
                title={`Select ${formatFullMonth(m.monthKey)} for Daily Tasks`}
              >
                {m.completed ? (
                  <span className="text-[11px] font-extrabold leading-none">✓</span>
                ) : isSelected ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-white block shadow-xs" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-emerald-400 block transition" />
                )}
              </button>

              {/* MONTH CARD */}
              <div
                onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : isThisMonth
                    ? 'border-emerald-200 bg-emerald-50/15 hover:border-emerald-300 hover:bg-emerald-50/30'
                    : m.completed
                    ? 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {formatFullMonth(m.monthKey)}
                    </span>
                    {isSelected && (
                      <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                        ACTIVE VIEW
                      </span>
                    )}
                    {isThisMonth && !isSelected && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        CURRENT MONTH
                      </span>
                    )}
                    {monthTasksCount > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {monthTasksCount} {monthTasksCount === 1 ? 'task' : 'tasks'}
                      </span>
                    )}
                  </div>

                  {/* Mark Milestone Accomplished */}
                  {!readOnly && (
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={m.completed}
                        onChange={() => onToggleMilestone(goal.id, m.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-medium">{m.completed ? 'Achieved' : 'Mark Done'}</span>
                    </label>
                  )}
                </div>

                {editingId === m.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex gap-2 mt-2"
                  >
                    <input
                      type="text"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit(m.id);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 text-sm border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(m.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div
                      onClick={(e) => {
                        if (!readOnly) {
                          e.stopPropagation();
                          handleStartEdit(m);
                        }
                      }}
                      title={readOnly ? undefined : 'Click to edit milestone name'}
                      className={`text-sm font-medium transition flex-1 min-w-0 ${
                        readOnly ? '' : 'hover:text-emerald-700'
                      } ${
                        m.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      <span>
                        {m.title || <span className="italic text-slate-300">Name this milestone...</span>}
                      </span>
                      {!readOnly && (
                        <span className="text-xs text-slate-300 hover:text-slate-600 ml-1.5">✎</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
