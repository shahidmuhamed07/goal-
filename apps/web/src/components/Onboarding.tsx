import React, { useState } from 'react';
import { Briefcase, Check, ChevronLeft, Target, X } from 'lucide-react';
import { Orb } from './Orb';

/** One choice: a white pill with an icon, a label and a round mark. */
export const OptionRow: React.FC<{
  icon?: React.ElementType;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, hint, selected, onClick }) => (
  <button
    type="button"
    className="option"
    data-selected={selected}
    aria-pressed={selected}
    onClick={onClick}
  >
    {Icon && <Icon className="w-7 h-7 shrink-0 text-slate-800" strokeWidth={1.4} />}
    <span className="min-w-0">
      <span className="block leading-snug">{label}</span>
      {hint && <span className="block text-xs font-normal text-slate-400 leading-snug mt-0.5">{hint}</span>}
    </span>
    <span className="option-mark" aria-hidden="true">
      <Check className="w-4 h-4" strokeWidth={3} />
    </span>
  </button>
);

/** The guide beside a speech bubble that holds the question. */
export const AskBubble: React.FC<{ title: React.ReactNode; sub?: string }> = ({ title, sub }) => (
  <div className="flex items-center gap-3 -ml-1">
    <Orb size={58} />
    <div className="flex-1 rounded-[1.75rem] bg-white/70 backdrop-blur px-5 py-4 shadow-[0_10px_30px_-18px_rgba(70,60,160,0.4)]">
      <h2 className="font-display text-[1.45rem] leading-[1.2] font-medium text-slate-900">{title}</h2>
      {sub && <p className="mt-1.5 text-[0.8rem] leading-snug text-slate-500">{sub}</p>}
    </div>
  </div>
);

const BUILD_STEPS = ['Setting up your profile', 'Saving your choice'];

type StepId = 'welcome' | 'persona' | 'building' | 'ready';

interface OnboardingProps {
  isOpen: boolean;
  /** First name, for the greeting. */
  name: string;
  /** Someone planning their own goals: hand over to the guided "Help me plan" questions. */
  onStartPlanning: () => Promise<void>;
  /** A professional: record the choice. */
  onFinishProfessional: () => Promise<void>;
  /** Leave the flow. */
  onClose: () => void;
}

/**
 * The first-run screens: the guide says hello and asks how the app will be used.
 * Someone planning their own goals goes straight into the guided questions (one
 * area, a few taps, then a plan); a professional gets a short set-up. Also
 * reachable later from the account menu.
 */
export const Onboarding: React.FC<OnboardingProps> = ({ isOpen, name, onStartPlanning, onFinishProfessional, onClose }) => {
  const [step, setStep] = useState<StepId>('welcome');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [persona, setPersona] = useState<'client' | 'professional'>('client');
  const [buildProgress, setBuildProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const firstName = name || 'there';

  const professionalSetup = async () => {
    setError(null);
    setBuildProgress(0);
    setDirection(1);
    setStep('building');
    const ticker = window.setInterval(() => setBuildProgress((p) => Math.min(p + 1, BUILD_STEPS.length)), 700);
    const minimum = new Promise((resolve) => window.setTimeout(resolve, 1500));
    try {
      await Promise.all([onFinishProfessional(), minimum]);
      setBuildProgress(BUILD_STEPS.length);
      setStep('ready');
    } catch (err) {
      console.error('Onboarding finish error:', err);
      setError('We could not save that. Check your connection and try again.');
    } finally {
      window.clearInterval(ticker);
    }
  };

  const planMyGoals = async () => {
    setError(null);
    setBusy(true);
    try {
      await onStartPlanning();
    } catch (err) {
      console.error('Onboarding hand-off error:', err);
      setError('We could not save that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    setDirection(1);
    if (step === 'welcome') setStep('persona');
    else if (step === 'persona') void (persona === 'professional' ? professionalSetup() : planMyGoals());
    else if (step === 'ready') onClose();
  };

  const body = (): React.ReactNode => {
    switch (step) {
      case 'welcome':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 px-2">
            <div className="relative grid place-items-center">
              <span
                className="absolute w-[21rem] h-[21rem] rounded-full"
                style={{ background: 'radial-gradient(closest-side, rgba(176,186,255,0.7), rgba(255,205,228,0.4) 62%, transparent)' }}
                aria-hidden="true"
              />
              <Orb size={170} float className="relative" />
            </div>
            <h1 className="font-display text-[2.1rem] leading-[1.15] font-medium text-slate-900 max-w-[17rem]">
              Hi {firstName}, I’m Pip! Here to help you reach your goals
            </h1>
          </div>
        );

      case 'persona':
        return (
          <>
            <AskBubble title="How will you use Goal Path?" sub="This only changes what you see. Nobody gets access to your goals from this." />
            <div className="mt-6 space-y-3">
              <OptionRow icon={Target} label="I’m working on my own goals" hint="Plan goals, weekly routines and daily tasks" selected={persona === 'client'} onClick={() => setPersona('client')} />
              <OptionRow icon={Briefcase} label="I’m a coach, trainer or dietitian" hint="Support clients with a professional profile" selected={persona === 'professional'} onClick={() => setPersona('professional')} />
            </div>
            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
          </>
        );

      case 'building':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
            <Orb size={120} float />
            <h1 className="font-display text-[1.8rem] leading-tight font-medium text-slate-900">Setting up your profile…</h1>
            {error ? (
              <div className="space-y-4">
                <p className="text-sm text-rose-600 max-w-xs">{error}</p>
                <button type="button" className="btn-tone h-12 px-8" onClick={() => void professionalSetup()}>
                  Try again
                </button>
              </div>
            ) : (
              <ul className="w-full max-w-xs space-y-4 text-left">
                {BUILD_STEPS.map((label, i) => (
                  <li key={label} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className={`grid place-items-center w-5 h-5 rounded-full ${buildProgress > i ? 'bg-[color:var(--tone-600)] text-white' : 'bg-slate-200 text-transparent'}`}>
                        <Check className="w-3 h-3" strokeWidth={3.5} />
                      </span>
                      {label}
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[color:var(--tone-500)] transition-all duration-[900ms] ease-out"
                        style={{ width: buildProgress > i ? '100%' : buildProgress === i ? '55%' : '0%' }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      case 'ready':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Orb size={96} float />
            <h1 className="font-display text-[2rem] leading-tight font-medium text-slate-900">You’re all set</h1>
            <p className="text-sm text-slate-500 max-w-[16rem]">Add your qualifications so clients can trust you.</p>
          </div>
        );
    }
  };

  const nextLabel = step === 'ready' ? 'Set up my profile' : busy ? 'One moment…' : 'Next';
  const showBack = step === 'persona';

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{
        backgroundColor: '#f7f6fb',
        backgroundImage:
          'radial-gradient(520px 420px at 100% -6%, rgba(176,186,255,0.45), transparent 62%), radial-gradient(520px 420px at -10% 4%, rgba(255,205,228,0.45), transparent 62%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Set up Goal Path"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-6 safe-top">
        <div className="flex h-11 items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={() => {
                setDirection(-1);
                setStep('welcome');
              }}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full text-slate-700 cursor-pointer -ml-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <span className="h-10 w-10 -ml-2" />
          )}
          {step === 'welcome' ? (
            <button type="button" onClick={() => onClose()} aria-label="Skip for now" className="ml-auto grid h-10 w-10 place-items-center rounded-full text-slate-400 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          ) : (
            <span className="ml-auto h-10 w-10" />
          )}
        </div>

        <div key={step} className="tab-panel hide-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pt-4 pb-4" data-dir={direction}>
          {body()}
        </div>

        {step !== 'building' && (
          <div className="pb-6 pt-2 safe-bottom">
            <button type="button" className="btn-tone h-14 w-full text-[1.0625rem]" disabled={busy} onClick={onNext}>
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
