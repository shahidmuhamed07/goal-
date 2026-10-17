import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  Heart,
  Dumbbell,
  Coins,
  GraduationCap,
  Calendar,
  Sparkles,
  X,
  Target,
  Plus,
} from 'lucide-react';
import {
  getCurrentMonthKey,
  formatFullMonth,
  formatMonthKey,
  addMonthsToKey,
  generateMonthRange,
  GOAL_CATEGORIES,
} from '../utils';
import { Collaborator } from '../types';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators?: Collaborator[];
  /**
   * Shows an optional "Help me plan" button for people who are not sure how to set the goal up.
   * It gets the category picked so far (null for a custom one), so the questions can start there.
   */
  onHelpMeChoose?: (category: string | null) => void;
  onSave: (data: {
    title: string;
    category: string;
    description: string;
    targetDate: string;
    assignedProfessionalUids?: string[];
  }) => Promise<void>;
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Career': Briefcase,
  'Business': Building2,
  'Health': Heart,
  'Fitness': Dumbbell,
  'Finance & Wealth': Coins,
  'Learning & Skills': GraduationCap,
};

const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  collaborators = [],
  onHelpMeChoose,
  onSave,
}) => {
  const currentMonthKey = getCurrentMonthKey();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Career');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [description, setDescription] = useState('');

  // Whatever the owner types is the category: preset or their own words.
  const activeCategory = isCustomCategory ? customCategory.trim() : category;

  // The length of the roadmap drives everything else: no months are shown until
  // the owner types how many months the goal spans.
  const [monthsInput, setMonthsInput] = useState('');
  const parsedMonths = parseInt(monthsInput, 10);
  const duration =
    Number.isFinite(parsedMonths) && parsedMonths >= MIN_MONTHS && parsedMonths <= MAX_MONTHS
      ? parsedMonths
      : null;
  const targetDate = duration === null ? '' : addMonthsToKey(currentMonthKey, duration);
  const horizonMonths = duration === null ? [] : generateMonthRange(currentMonthKey, targetDate);

  const [assignedUids, setAssignedUids] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleProfessional = (uid: string) => {
    setAssignedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // Keep the typed value inside the supported range once the field loses focus.
  const commitMonths = () => {
    const typed = parseInt(monthsInput, 10);
    if (!Number.isFinite(typed)) {
      setMonthsInput('');
      return;
    }
    setMonthsInput(String(Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, typed))));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !activeCategory || !targetDate || duration === null || saving) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category: activeCategory,
        description: description.trim(),
        targetDate,
        assignedProfessionalUids: assignedUids,
      });

      setTitle('');
      setDescription('');
      setMonthsInput('');
      setCustomCategory('');
      setIsCustomCategory(false);
      setAssignedUids([]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim">
      <div className="dialog space-y-5" data-size="lg">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-300/40">
          <div className="flex items-center gap-2.5">
            <div className="neu-sm w-9 h-9 grid place-items-center text-emerald-700">
              <Target className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Define New Goal Path
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Set milestones, assign categories, and map your monthly roadmap
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="chip w-8 h-8 grid place-items-center"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {onHelpMeChoose && (
          <div className="neu-inset-sm flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">Not sure where to start?</p>
              <p className="text-[11px] text-slate-500">A few quick taps and we suggest a plan. Totally optional.</p>
            </div>
            <button
              type="button"
              className="chip inline-flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0"
              onClick={() => onHelpMeChoose(isCustomCategory ? null : category)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Help me plan
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Goal Title */}
          <div>
            <label className="section-label block mb-1.5" htmlFor="new-goal-title">
              Goal title <span className="text-[color:var(--tone-700)]">*</span>
            </label>
            <input
              id="new-goal-title"
              type="text"
              required
              placeholder="e.g. Complete Half Marathon, Scale SaaS to $10k MRR, Write Novel..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm rounded-xl px-3.5 py-2.5"
              autoFocus
            />
          </div>

          {/* Category: pick a preset or write your own */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Category</span>
              <span className="badge">Selected: {activeCategory || 'Custom'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {GOAL_CATEGORIES.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat] || Target;
                const isSelected = !isCustomCategory && category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setIsCustomCategory(false);
                    }}
                    className="chip flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                    data-active={isSelected}
                    aria-pressed={isSelected}
                  >
                    <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{cat}</span>
                  </button>
                );
              })}

              {/* Write your own category instead of picking a preset */}
              <button
                type="button"
                onClick={() => setIsCustomCategory(true)}
                className="chip flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                data-active={isCustomCategory}
                aria-pressed={isCustomCategory}
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Custom</span>
              </button>
            </div>

            {isCustomCategory && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Name your own category (e.g. Music, Parenting, Faith)"
                maxLength={40}
                autoFocus
                aria-label="Custom category"
                className="mt-3 w-full text-sm rounded-xl px-3.5 py-2.5"
              />
            )}
          </div>

          {/* How long: type the number of months and the roadmap appears */}
          <div className="neu-inset p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-[color:var(--tone-700)] flex-shrink-0" />
                <span className="section-label">Target month &amp; horizon</span>
                {duration !== null && (
                  <span className="badge">
                    <Sparkles className="w-3 h-3" />
                    <span>
                      {duration} {duration === 1 ? 'month' : 'months'} selected
                    </span>
                  </span>
                )}
              </div>
              {duration !== null && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="badge">Start: {formatFullMonth(currentMonthKey)}</span>
                  <span className="text-slate-400 text-xs">→</span>
                  <span className="badge">Target: {formatFullMonth(targetDate)}</span>
                </div>
              )}
            </div>

            {/* Type the length: any number of months, no presets */}
            <div className="neu-sm flex items-center justify-between gap-3 px-3.5 py-2.5">
              <label htmlFor="goal-length-months" className="text-xs font-semibold text-slate-700">
                How many months?
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  id="goal-length-months"
                  type="number"
                  min={MIN_MONTHS}
                  max={MAX_MONTHS}
                  inputMode="numeric"
                  placeholder="6"
                  value={monthsInput}
                  onChange={(e) => setMonthsInput(e.target.value)}
                  onBlur={commitMonths}
                  className="w-16 text-center text-sm font-bold tabular-nums rounded-lg px-2 py-1.5"
                />
                <span className="text-xs font-semibold text-slate-600 w-14">
                  {duration === 1 ? 'month' : 'months'}
                </span>
              </div>
            </div>

            {/* The roadmap months, revealed once a length is chosen */}
            {duration !== null && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-600">
                  Your roadmap months ({horizonMonths.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {horizonMonths.map((key, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === horizonMonths.length - 1;
                    return (
                      <div
                        key={key}
                        className="chip cursor-default! px-2.5 py-1.5 text-center min-w-[68px]"
                        data-active={isLast}
                        data-current={isFirst}
                      >
                        <div className="text-[11px] font-bold leading-tight whitespace-nowrap">
                          {formatMonthKey(key)}
                        </div>
                        <div className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 opacity-75">
                          {isLast && isFirst ? 'Start / Target' : isLast ? 'Target' : isFirst ? 'Start' : `Month ${idx + 1}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="section-label block mb-1.5" htmlFor="new-goal-description">
              Description &amp; definition of done
            </label>
            <textarea
              id="new-goal-description"
              rows={2}
              placeholder="What does success look like when this goal is completed?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm rounded-xl px-3.5 py-2.5 resize-none"
            />
          </div>

          {/* Assigned Connected Professionals */}
          {collaborators.length > 0 && (
            <div>
              <span className="section-label block mb-2">Assign connected professionals (optional)</span>
              <div className="neu-inset p-3 space-y-2.5">
                {collaborators.map((c) => {
                  const isChecked = assignedUids.includes(c.uid);
                  return (
                    <label
                      key={c.uid}
                      className={`neu-sm flex items-center justify-between px-3 py-2.5 transition cursor-pointer text-xs ${
                        isChecked ? 'ring-2 ring-[color:var(--tone-300)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfessional(c.uid)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="font-semibold text-slate-800">{c.name || c.email || c.uid}</span>
                      </div>
                      <span className="badge">{c.role}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/40">
            {duration === null && (
              <span className="text-[11px] font-medium text-slate-500 mr-auto">
                Choose the goal length to continue
              </span>
            )}
            <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-xs sm:text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !activeCategory || duration === null}
              className="btn-tone px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{saving ? 'Creating…' : 'Create goal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
