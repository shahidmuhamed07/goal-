import React, { useState } from 'react';
import { Check, X, Edit3, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Goal, Milestone } from '../types';
import { GlassIconButton, ProgressBar } from './UIElements';
import { getCurrentMonthKey, formatFullMonth, formatMonthKey } from '../utils';

interface MonthlyMilestoneSectionProps {
  goal: Goal;
  readOnly?: boolean;
  isOwner?: boolean;
  selectedMonthKey?: string;
  onSelectMonth?: (monthKey: string) => void;
  onToggleMilestone: (goalId: string, milestoneId: string) => void;
  onUpdateMilestoneTitle: (goalId: string, milestoneId: string, title: string) => void;
}

/**
 * The goal's roadmap: one note per month, how far the chosen month has got, and
 * the whole horizon as a row of month keys to jump between.
 */
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
  const totalMonths = milestones.length;
  const completedMonths = milestones.filter((m) => m.completed).length;
  const overallPct = totalMonths > 0 ? Math.round((completedMonths / totalMonths) * 100) : 0;

  const activeMilestone = milestones.find((m) => m.monthKey === activeMonth) || milestones[0];
  const activeIndex = milestones.findIndex((m) => m.monthKey === activeMonth);

  // A note that still holds the generated text ("Checkpoint for Sep 2026") has
  // not been written by the user yet, so it keeps the roomy tap-anywhere bar.
  // Once they write their own, it collapses to a compact pencil button.
  const isGeneratedTitle =
    !!activeMilestone &&
    (!activeMilestone.title ||
      activeMilestone.title.trim() === `Checkpoint for ${formatMonthKey(activeMilestone.monthKey)}`);

  const monthTasks = (goal.tasks || []).filter((t) => t.date && t.date.startsWith(activeMonth));
  const monthTasksCompleted = monthTasks.filter((t) => t.completed).length;
  const monthTasksTotal = monthTasks.length;

  const monthProgressPct = activeMilestone?.completed
    ? 100
    : monthTasksTotal > 0
    ? Math.round((monthTasksCompleted / monthTasksTotal) * 100)
    : 0;

  const handleStartEdit = (m: Milestone) => {
    setEditingId(m.id);
    setEditVal(m.title);
  };

  const handleSaveEdit = (milestoneId: string) => {
    if (editVal.trim()) onUpdateMilestoneTitle(goal.id, milestoneId, editVal.trim());
    setEditingId(null);
  };

  const goToMonth = (step: 1 | -1) => {
    const target = milestones[activeIndex + step];
    if (target && onSelectMonth) onSelectMonth(target.monthKey);
  };

  return (
    <div className="neu rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="card-title">Roadmap</span>
        <span className="badge tabular-nums">
          {completedMonths}/{totalMonths} months achieved
        </span>
      </div>

      {activeMilestone ? (
        <div className="neu-inset p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900 leading-tight">
                {formatFullMonth(activeMilestone.monthKey)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Milestone for this month</div>
            </div>

            {!readOnly && (
              <button
                type="button"
                className="chip inline-flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0"
                data-active={activeMilestone.completed}
                aria-pressed={activeMilestone.completed}
                onClick={() => onToggleMilestone(goal.id, activeMilestone.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {activeMilestone.completed ? 'Achieved' : 'Mark achieved'}
              </button>
            )}
          </div>

          {/* The milestone note. Untouched text keeps the full-width tap target;
              a written note shows quietly with only a pencil button to edit. */}
          {editingId === activeMilestone.id ? (
            <div className="flex items-center gap-2">
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
                aria-label="Milestone note"
                className="flex-1 min-w-0 text-sm rounded-xl px-3.5 py-2.5"
                autoFocus
              />
              <GlassIconButton variant="tone" size="md" title="Save note" onClick={() => handleSaveEdit(activeMilestone.id)}>
                <Check className="w-4 h-4" />
              </GlassIconButton>
              <GlassIconButton variant="slate" size="md" title="Cancel" onClick={() => setEditingId(null)}>
                <X className="w-4 h-4" />
              </GlassIconButton>
            </div>
          ) : isGeneratedTitle ? (
            <button
              type="button"
              onClick={() => {
                if (!readOnly) handleStartEdit(activeMilestone);
              }}
              disabled={readOnly}
              className="neu-sm w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-slate-600 cursor-pointer disabled:cursor-default"
            >
              <span>{activeMilestone.title || 'Write this month’s milestone…'}</span>
              {!readOnly && <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-sm font-semibold min-w-0 truncate ${
                  activeMilestone.completed ? 'line-through text-slate-400' : 'text-slate-800'
                }`}
              >
                {activeMilestone.title}
              </span>
              {!readOnly && (
                <GlassIconButton variant="tone" size="md" title="Edit note" onClick={() => handleStartEdit(activeMilestone)}>
                  <Edit3 className="w-3.5 h-3.5" />
                </GlassIconButton>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">This month</span>
              <span className="font-extrabold text-[color:var(--tone-900)]">{monthProgressPct}%</span>
            </div>
            <ProgressBar value={monthProgressPct} height="h-2" color="bg-[color:var(--tone-700)]" />
            <div className="text-[11px] text-slate-500">
              {monthTasksTotal > 0
                ? `${monthTasksCompleted} of ${monthTasksTotal} tasks done`
                : 'No tasks scheduled yet'}
            </div>
          </div>
        </div>
      ) : (
        <div className="neu-inset text-center py-6 text-xs text-slate-500">
          No milestone created for this month yet.
        </div>
      )}

      {milestones.length > 1 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="section-label">Months</span>
            <div className="flex items-center gap-1.5">
              <GlassIconButton variant="tone" size="sm" title="Previous month" disabled={activeIndex <= 0} onClick={() => goToMonth(-1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </GlassIconButton>
              <GlassIconButton
                variant="tone"
                size="sm"
                title="Next month"
                disabled={activeIndex === -1 || activeIndex === milestones.length - 1}
                onClick={() => goToMonth(1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </GlassIconButton>
            </div>
          </div>

          {/* Every month of the horizon stays visible, wrapping when space runs out */}
          <div className="flex flex-wrap items-center gap-2">
            {milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                data-active={m.monthKey === activeMonth}
                data-current={m.monthKey === currentMonthKey}
                aria-pressed={m.monthKey === activeMonth}
                onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
              >
                {m.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{formatMonthKey(m.monthKey)}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1">
            <span>Whole goal</span>
            <span className="font-bold text-[color:var(--tone-900)]">{overallPct}% complete</span>
          </div>
        </div>
      )}
    </div>
  );
};
