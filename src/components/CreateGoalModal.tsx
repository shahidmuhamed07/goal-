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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Check,
  Target,
  Plus,
} from 'lucide-react';
import {
  getCurrentMonthKey,
  formatFullMonth,
  addMonthsToKey,
  getMonthsDifference,
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

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  collaborators = [],
  onSave,
}) => {
  const currentMonthKey = getCurrentMonthKey();
  const [currentYearStr, currentMonthStr] = currentMonthKey.split('-');
  const currentYear = parseInt(currentYearStr, 10);
  const currentMonthNum = parseInt(currentMonthStr, 10);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Career');
  const [description, setDescription] = useState('');
  
  // Default target date to 6 months from now
  const [targetDate, setTargetDate] = useState(() => addMonthsToKey(currentMonthKey, 6));
  
  // State for navigating the year inside the month picker
  const [pickerYear, setPickerYear] = useState(() => {
    const targetY = parseInt(addMonthsToKey(currentMonthKey, 6).split('-')[0], 10);
    return targetY;
  });

  const [assignedUids, setAssignedUids] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleProfessional = (uid: string) => {
    setAssignedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectMonth = (monthIndex: number) => {
    const monthPad = String(monthIndex + 1).padStart(2, '0');
    const newKey = `${pickerYear}-${monthPad}`;
    if (newKey >= currentMonthKey) {
      setTargetDate(newKey);
    }
  };

  const monthsDuration = targetDate ? getMonthsDifference(currentMonthKey, targetDate) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate || saving) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        description: description.trim(),
        targetDate,
        assignedProfessionalUids: assignedUids,
      });

      setTitle('');
      setDescription('');
      setTargetDate(addMonthsToKey(currentMonthKey, 6));
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
                Selected: {category}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GOAL_CATEGORIES.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat] || Target;
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
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
            </div>
          </div>

          {/* Interactive Visual Month & Horizon Selector */}
          <div className="bg-emerald-50/50 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Target Month & Horizon
                </span>
                {/* PROMINENT MONTH DIFFERENCE COUNTER */}
                <span className="bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-200" />
                  <span>{monthsDuration} {monthsDuration === 1 ? 'Month' : 'Months'} Selected</span>
                  <span className="text-emerald-200 text-[10px] font-medium">
                    (+{monthsDuration}m Difference)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
                <span className="text-emerald-900 bg-emerald-100/90 border border-emerald-200/90 px-2 py-0.5 rounded-md text-[11px]">
                  Start: {formatFullMonth(currentMonthKey)}
                </span>
                <span className="text-emerald-600">→</span>
                <span className="text-white bg-emerald-700 px-2.5 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                  Target: {targetDate ? formatFullMonth(targetDate) : 'Select'}
                </span>
              </div>
            </div>

            {/* QUICK MONTH DIFFERENCE SHORTCUTS */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-950">
                <span>Quick Month Difference Presets:</span>
                <span className="text-[10px] text-emerald-700">Click to set duration directly</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: '+1 Mo', months: 1 },
                  { label: '+3 Mos', months: 3 },
                  { label: '+6 Mos', months: 6 },
                  { label: '+9 Mos', months: 9 },
                  { label: '+12 Mos', months: 12 },
                ].map((preset) => {
                  const isSelected = monthsDuration === preset.months;
                  return (
                    <button
                      key={preset.months}
                      type="button"
                      onClick={() => {
                        const newKey = addMonthsToKey(currentMonthKey, preset.months);
                        setTargetDate(newKey);
                        const [y] = newKey.split('-').map(Number);
                        setPickerYear(y);
                      }}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                          : 'bg-emerald-100/80 text-emerald-950 border-emerald-200/90 hover:bg-emerald-200/90 hover:border-emerald-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Year Navigator */}
            <div className="flex items-center justify-between bg-white/90 border border-emerald-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
              <button
                type="button"
                disabled={pickerYear <= currentYear}
                onClick={() => setPickerYear((y) => Math.max(currentYear, y - 1))}
                className="p-1 rounded-lg text-slate-500 hover:text-emerald-900 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 tracking-wide">
                  {pickerYear}
                </span>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  {monthsDuration} Month Difference
                </span>
              </div>

              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="p-1 rounded-lg text-slate-500 hover:text-emerald-900 hover:bg-emerald-50 transition cursor-pointer"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 12 Months Grid with Emerald Dark and Light Contrast */}
            <div className="grid grid-cols-4 gap-1.5">
              {MONTH_NAMES.map((name, idx) => {
                const monthPad = String(idx + 1).padStart(2, '0');
                const key = `${pickerYear}-${monthPad}`;
                const isPast = key < currentMonthKey;
                const isCurrentCalendarMonth = key === currentMonthKey;
                const isTargetMonth = targetDate === key;
                const isInSelectedRange = key > currentMonthKey && key < targetDate;

                return (
                  <button
                    key={name}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectMonth(idx)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                      isTargetMonth
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/80'
                        : isCurrentCalendarMonth
                        ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300 shadow-sm ring-2 ring-emerald-300'
                        : isInSelectedRange
                        ? 'bg-emerald-100/70 text-emerald-950 border-emerald-200/90 font-semibold shadow-2xs hover:bg-emerald-200/70 cursor-pointer'
                        : isPast
                        ? 'bg-slate-100/50 text-slate-300 border-transparent cursor-not-allowed'
                        : 'bg-white text-slate-700 border-emerald-100/80 hover:border-emerald-300 hover:bg-emerald-50/60 cursor-pointer shadow-2xs'
                    }`}
                  >
                    <span className="leading-none">{name}</span>
                    {isCurrentCalendarMonth && (
                      <span
                        className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${
                          isTargetMonth ? 'text-emerald-200' : 'text-emerald-800'
                        }`}
                      >
                        {isTargetMonth ? 'Start / Target' : 'Start (Now)'}
                      </span>
                    )}
                    {isTargetMonth && !isCurrentCalendarMonth && (
                      <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5 text-emerald-200">
                        Target
                      </span>
                    )}
                    {isInSelectedRange && (
                      <span className="text-[8px] font-semibold mt-0.5 text-emerald-800">
                        • in path
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
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
