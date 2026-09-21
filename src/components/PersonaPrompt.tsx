import React, { useState } from 'react';
import { ArrowRight, Briefcase, ShieldCheck, Target } from 'lucide-react';
import { AccountPersona } from '../types';

interface PersonaPromptProps {
  isOpen: boolean;
  saving: boolean;
  onChoose: (persona: AccountPersona) => void;
  onSkip: () => void;
}

/**
 * Asked once after the first sign-in. This only decides what the account shows
 * its owner; it never grants access to anyone else's data. Clients still approve
 * every professional individually, with the goals and access level they choose.
 */
export const PersonaPrompt: React.FC<PersonaPromptProps> = ({
  isOpen,
  saving,
  onChoose,
  onSkip,
}) => {
  const [hovered, setHovered] = useState<AccountPersona | null>(null);

  if (!isOpen) return null;

  const cardClass = (option: AccountPersona) =>
    `w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-start gap-3 ${
      hovered === option
        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
        : 'border-slate-200 bg-white hover:border-emerald-300'
    }`;

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-4 z-50 fade">
      <div className="neu rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 pop">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
            One quick question
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-3">How will you use Goal Path?</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            This only changes what you see. Nobody gets access to your goals from this choice.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onChoose('client')}
          onMouseEnter={() => setHovered('client')}
          onMouseLeave={() => setHovered(null)}
          className={cardClass('client')}
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-900">I&apos;m working on my own goals</span>
            <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Plan goals, milestones and daily tasks. You can invite a trainer, dietitian or doctor
              later and choose exactly what they see.
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => onChoose('professional')}
          onMouseEnter={() => setHovered('professional')}
          onMouseLeave={() => setHovered(null)}
          className={cardClass('professional')}
        >
          <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-900">I&apos;m a professional working with clients</span>
            <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Adds a professional profile where you list your qualifications with reference links, plus
              the client workspaces you&apos;ve been approved for.
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
        </button>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Professionals start with no access to anyone. A client has to approve your request and pick
            the goals and access level, whether that&apos;s view only or edit.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-60"
          >
            Decide later
          </button>
          <span className="text-[11px] text-slate-400">You can change this any time</span>
        </div>
      </div>
    </div>
  );
};
