import React, { useState } from 'react';
import {
  Briefcase,
  Dumbbell,
  Coins,
  GraduationCap,
  Calendar,
  Sparkles,
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
import { Dialog } from './Dialog';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators?: Collaborator[];
  /**
   * Shows an optional "Help me plan" button for people who are not sure how to set the goal up.
   * The questions always start by asking which area the goal is about.
   */
  onHelpMeChoose?: () => void;
  onSave: (data: {
    title: string;
    category: string;
    description: string;
    targetDate: string;
    assignedProfessionalUids?: string[];
  }) => Promise<void>;
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Health & Fitness': Dumbbell,
  'Business & Career': Briefcase,
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
  const [category, setCategory] = useState<string>('Health & Fitness');
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
    <Dialog
      size="lg"
      kicker="New goal"
      title="Define New Goal Path"
      description="Set milestones, assign categories, and map your monthly roadmap"
      onClose={onClose}
      footer={
        <>
          {duration === null && <span className="meta mr-auto">Choose the goal length to continue</span>}
          <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="create-goal-form"
            disabled={saving || !title.trim() || !activeCategory || duration === null}
            className="btn-tone px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{saving ? 'Creating…' : 'Create goal'}</span>
          </button>
        </>
      }
    >
        {onHelpMeChoose && (
          <div className="space-y-3">
            {/* The main way to start: the AI asks a few taps of questions and writes the plan */}
            <button
              type="button"
              onClick={onHelpMeChoose}
              className="neu lift flex w-full cursor-pointer items-center gap-4 p-4 text-left sm:p-5"
              data-plain
            >
              <span className="orb grid h-12 w-12 shrink-0 place-items-center rounded-full" aria-hidden="true">
                <Sparkles className="h-5 w-5 text-[color:var(--tone-700)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-slate-900">Plan it with me</span>
                <span className="block text-sm leading-snug text-slate-500">A few quick taps, and we write your plan week by week.</span>
              </span>
              <span className="btn-tone shrink-0 px-4 py-2 text-sm">Start</span>
            </button>
            <p className="divider-label">or set it up yourself</p>
          </div>
        )}

        <form id="create-goal-form" onSubmit={handleSubmit} className="space-y-5">
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
            <div className="sr-only" id="category-label">Area of the goal</div>
            <div className="grid grid-cols-2 gap-2.5" role="group" aria-labelledby="category-label">
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
                    <span className="min-w-0 leading-tight">{cat}</span>
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
        </form>
    </Dialog>
  );
};
