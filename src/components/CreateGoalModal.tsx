import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  Heart,
  Dumbbell,
  Coins,
  GraduationCap,
  PenTool,
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
  'Creative Writing': PenTool,
};

const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  collaborators = [],
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-emerald-200/90 ring-1 ring-emerald-100/80 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-emerald-100/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-2xs">
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
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-emerald-900 hover:bg-emerald-50 flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Goal Title <span className="text-emerald-700">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Complete Half Marathon, Scale SaaS to $10k MRR, Write Novel..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              autoFocus
            />
          </div>

          {/* Separated Categories Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Category
              </label>
              <span className="text-[11px] font-medium text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                Selected: {activeCategory || 'Custom'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-emerald-300'
                    }`}
                  >
                    <IconComponent
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isSelected ? 'text-white' : 'text-emerald-700'
                      }`}
                    />
                    <span className="truncate">{cat}</span>
                  </button>
                );
              })}

              {/* Write your own category instead of picking a preset */}
              <button
                type="button"
                onClick={() => setIsCustomCategory(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-left ${
                  isCustomCategory
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-emerald-300'
                }`}
              >
                <Plus
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isCustomCategory ? 'text-white' : 'text-emerald-700'
                  }`}
                />
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
                className="mt-2 w-full text-sm bg-slate-50 hover:bg-slate-100/50 border border-emerald-300 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            )}
          </div>

          {/* Interactive Visual Month & Horizon Selector */}
          <div className="bg-emerald-50/50 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Target Month & Horizon
                </span>
                {duration !== null && (
                  <span className="bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-200" />
                    <span>{duration} {duration === 1 ? 'Month' : 'Months'} Selected</span>
                  </span>
                )}
              </div>
              {duration !== null && (
                <div className="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
                  <span className="text-emerald-900 bg-emerald-100/90 border border-emerald-200/90 px-2 py-0.5 rounded-md text-[11px]">
                    Start: {formatFullMonth(currentMonthKey)}
                  </span>
                  <span className="text-emerald-600">→</span>
                  <span className="text-white bg-emerald-700 px-2.5 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                    Target: {formatFullMonth(targetDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Type the length: any number of months, no presets */}
            <div className="flex items-center justify-between gap-3 bg-white/90 border border-emerald-200/80 rounded-xl px-3 py-2 shadow-2xs">
              <label
                htmlFor="goal-length-months"
                className="text-xs font-semibold text-emerald-950"
              >
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
                  className="w-16 text-center text-sm font-bold text-emerald-950 tabular-nums bg-emerald-50/70 border border-emerald-200 rounded-lg px-2 py-1.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
                <span className="text-xs font-semibold text-emerald-900 w-14">
                  {duration === 1 ? 'month' : 'months'}
                </span>
              </div>
            </div>

            {/* The roadmap months, revealed once a length is chosen */}
            {duration !== null && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-emerald-950">
                  Your roadmap months ({horizonMonths.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {horizonMonths.map((key, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === horizonMonths.length - 1;
                    return (
                      <div
                        key={key}
                        className={`px-2.5 py-1.5 rounded-xl border text-center min-w-[68px] ${
                          isLast
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                            : isFirst
                              ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300 shadow-2xs'
                              : 'bg-white text-emerald-950 border-emerald-200/90'
                        }`}
                      >
                        <div className="text-[11px] font-bold leading-tight whitespace-nowrap">
                          {formatMonthKey(key)}
                        </div>
                        <div
                          className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${
                            isLast ? 'text-emerald-200' : 'text-emerald-700'
                          }`}
                        >
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description &amp; Definition of Done
            </label>
            <textarea
              rows={2}
              placeholder="What does success look like when this goal is completed?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition resize-none"
            />
          </div>

          {/* Assigned Connected Professionals */}
          {collaborators.length > 0 && (
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Assign Connected Professionals (Optional)
              </label>
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                {collaborators.map((c) => {
                  const isChecked = assignedUids.includes(c.uid);
                  return (
                    <label
                      key={c.uid}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfessional(c.uid)}
                          className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="font-semibold">{c.name || c.email || c.uid}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {c.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            {duration === null && (
              <span className="text-[11px] font-medium text-slate-500 mr-auto">
                Choose the goal length to continue
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !activeCategory || duration === null}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{saving ? 'Creating Roadmap...' : 'Create Goal Roadmap'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
