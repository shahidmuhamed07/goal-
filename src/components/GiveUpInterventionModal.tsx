import React, { useState } from 'react';
import {
  HeartHandshake,
  Sparkles,
  CalendarPlus,
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Flag,
  Flame,
  CheckCircle2,
  Smile,
  ShieldAlert,
} from 'lucide-react';
import { Goal } from '../types';

interface GiveUpInterventionModalProps {
  isOpen: boolean;
  goal: Goal | null;
  onClose: () => void;
  onConfirmGiveUp: (goalId: string) => Promise<void> | void;
  onExtendGoalDeadline: (goalId: string, monthsToAdd?: number) => Promise<void> | void;
}

export const GiveUpInterventionModal: React.FC<GiveUpInterventionModalProps> = ({
  isOpen,
  goal,
  onClose,
  onConfirmGiveUp,
  onExtendGoalDeadline,
}) => {
  const [activeTab, setActiveTab] = useState<'reflect' | 'solutions' | 'confirm'>('reflect');
  const [selectedStruggle, setSelectedStruggle] = useState<string | null>(null);
  const [monthsToExtend, setMonthsToExtend] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !goal) return null;

  const isFitness =
    goal.category.toLowerCase().includes('fit') ||
    goal.category.toLowerCase().includes('health') ||
    goal.title.toLowerCase().includes('workout') ||
    goal.title.toLowerCase().includes('run') ||
    goal.title.toLowerCase().includes('gym');

  const isFinance =
    goal.category.toLowerCase().includes('financ') ||
    goal.category.toLowerCase().includes('wealth') ||
    goal.category.toLowerCase().includes('money');

  const handleExtend = async () => {
    setIsProcessing(true);
    try {
      await onExtendGoalDeadline(goal.id, monthsToExtend);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalGiveUp = async () => {
    setIsProcessing(true);
    try {
      await onConfirmGiveUp(goal.id);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto fade">
      <div className="neu rounded-3xl pop max-w-lg w-full shadow-2xl overflow-hidden transition-all text-slate-800 my-auto">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 border-b border-emerald-100 px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 border border-emerald-200/90 flex items-center justify-center text-emerald-700 shadow-2xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200/80">
                  Mindset Check-In
                </span>
                <span className="text-xs text-slate-400 font-medium truncate max-w-[170px]">
                  {goal.title}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                Wait, don't give up just yet!
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Steps */}
        <div className="px-5 sm:px-6 pt-3 pb-1 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-1 p-1 bg-white/80 border border-slate-200/80 rounded-2xl shadow-2xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('reflect')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'reflect'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>1. Reflect</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('solutions')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'solutions'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>2. Progress</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('confirm')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'confirm'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>3. Decision</span>
            </button>
          </div>
        </div>

        {/* Modal Tab Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          
          {/* TAB 1: REFLECTION */}
          {activeTab === 'reflect' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Category-tuned Motivational Card */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Flame className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Are you easily giving up, or is this just an off week?</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {isFitness ? (
                    <>
                      If you're not tracking workouts properly or missed a few sessions, don't let a bad week turn into giving up. <strong>Progress is progress</strong>—every rep, every stretch, and every healthy meal still counts.
                    </>
                  ) : isFinance ? (
                    <>
                      Financial discipline is a marathon of steady habits, not overnight perfection. If one month felt tight or tracking felt messy, <strong>progress is progress</strong>. You don't have to quit the journey.
                    </>
                  ) : (
                    <>
                      Every ambitious path has moments where momentum slows down. Falling behind on daily tasks doesn't mean you failed—it just means life got busy. <strong>Progress is progress</strong>.
                    </>
                  )}
                </p>
              </div>

              {/* Interactive friction prompt */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  What is making you want to give up today?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Fell behind on daily tracking',
                    'The timeline feels too tight',
                    'Lost energy or motivation',
                    'Daily tasks feel overwhelming',
                  ].map((struggle) => (
                    <button
                      key={struggle}
                      type="button"
                      onClick={() => setSelectedStruggle(struggle)}
                      className={`text-xs text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-2 ${
                        selectedStruggle === struggle
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold shadow-2xs ring-1 ring-emerald-300/60'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${selectedStruggle === struggle ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                      <span className="truncate">{struggle}</span>
                    </button>
                  ))}
                </div>

                {selectedStruggle && (
                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2 shadow-2xs animate-in fade-in duration-150">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      That's completely normal and 100% fixable! You don't need to quit—you can simply add another month or trim down tasks.
                    </span>
                  </div>
                )}
              </div>

              {/* Footer navigation */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Smile className="w-4 h-4 text-emerald-600" />
                  <span>I'm Keeping My Goal!</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('solutions')}
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>See Solutions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SOLUTIONS & MOTIVATION */}
          {activeTab === 'solutions' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Choose Timeline Extension</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Instead of giving up and losing everything you mapped, give yourself permission to expand the roadmap. Adding extra months takes away the stress while keeping your dream alive!
                </p>

                {/* MONTH DIFFERENCE SELECTOR */}
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-950">
                    <span>Select Month Difference:</span>
                    <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      +{monthsToExtend} {monthsToExtend === 1 ? 'Month' : 'Months'} Selected
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '+1 Month', months: 1 },
                      { label: '+2 Months', months: 2 },
                      { label: '+3 Months', months: 3 },
                      { label: '+6 Months', months: 6 },
                    ].map((opt) => {
                      const isSelected = monthsToExtend === opt.months;
                      return (
                        <button
                          key={opt.months}
                          type="button"
                          onClick={() => setMonthsToExtend(opt.months)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                              : 'bg-emerald-100/90 text-emerald-950 border-emerald-200/90 hover:bg-emerald-200'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-200" />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* 1-Click Extend Month Action */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExtend}
                  className="w-full text-left bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] border border-emerald-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                      <CalendarPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm sm:text-base leading-tight flex items-center gap-2">
                        <span>Extend Timeline by +{monthsToExtend} {monthsToExtend === 1 ? 'Month' : 'Months'}</span>
                        <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Recommended
                        </span>
                      </div>
                      <div className="text-xs text-emerald-100 mt-0.5">
                        Extends your target deadline and creates {monthsToExtend} new milestone {monthsToExtend === 1 ? 'month' : 'months'}.
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>

                {/* Keep Goal & Take Breather */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-left bg-white hover:bg-emerald-50/40 text-slate-800 rounded-2xl p-3.5 border border-emerald-200/90 shadow-2xs transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                      <Smile className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900">
                        Take A 7-Day Reset (Keep Goal)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Give yourself a week of rest without throwing away the goal.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Stay In
                  </span>
                </button>
              </div>

              {/* Footer navigation */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('reflect')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('confirm')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Still want to give up? (Step 3)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: FINAL DECISION */}
          {activeTab === 'confirm' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-rose-50/70 border border-rose-200/90 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Final Check: Are you certain you want to give up?</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  If your priorities genuinely changed and you need peace of mind, we support you. But if you just feel tired or overwhelmed today, tomorrow is a new day. 
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 space-y-1">
                <div className="font-bold">Goal to remove:</div>
                <div className="text-sm font-black text-slate-900 truncate">
                  "{goal.title}"
                </div>
                <div className="text-[11px] text-slate-500">
                  Category: {goal.category} • Milestones: {goal.milestones.length}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm py-3 px-4 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 border border-emerald-500/50 active:scale-[0.99]"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>Never Mind, Keep Fighting for This Goal</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleFinalGiveUp}
                  className="w-full bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-semibold text-xs py-2.5 px-4 rounded-xl border border-rose-200/90 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <Flag className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isProcessing ? 'Removing...' : 'Yes, Confirm Give Up & Archive'}</span>
                </button>
              </div>

              <div className="flex items-center justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('solutions')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Options</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
