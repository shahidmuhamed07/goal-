import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Apple,
  Armchair,
  Beef,
  Briefcase,
  Check,
  ChevronLeft,
  Coins,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  HeartPulse,
  Leaf,
  Moon,
  PenTool,
  Rocket,
  Salad,
  Sprout,
  Target,
  TrendingUp,
  Wheat,
  X,
  Zap,
} from 'lucide-react';
import { Orb } from './Orb';
import { WEEK_ORDER, WEEKDAY_LETTER, WEEKDAY_LONG, describeDays } from '../recurrence';
import {
  ACTIVITY_OPTIONS,
  EATING_OPTIONS,
  FOCUS_OPTIONS,
  LENGTH_OPTIONS,
  OnboardingAnswers,
  StarterPlan,
  TIME_OPTIONS,
  buildStarterPlans,
  defaultDays,
  Focus,
} from '../starterPlan';

type StepId =
  | 'welcome'
  | 'persona'
  | 'focus'
  | 'eating'
  | 'activity'
  | 'days'
  | 'time'
  | 'length'
  | 'starter'
  | 'commit'
  | 'building'
  | 'ready';

interface OnboardingProps {
  isOpen: boolean;
  /** First name, for the greeting. */
  name: string;
  /** Saves everything and returns the ids of the goals it created. */
  onFinish: (answers: OnboardingAnswers, plans: StarterPlan[]) => Promise<string[]>;
  /** Leave the flow, optionally straight into a goal. */
  onClose: (openGoalId?: string) => void;
}

const FOCUS_ICONS: Record<Focus, React.ElementType> = {
  diet: Apple,
  fitness: Dumbbell,
  health: Moon,
  career: TrendingUp,
  business: Rocket,
  money: Coins,
  learning: GraduationCap,
  creative: PenTool,
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  rarely: Armchair,
  light: Footprints,
  regular: Activity,
  often: Flame,
};

const EATING_ICONS: Record<string, React.ElementType> = {
  any: Salad,
  vegetarian: Leaf,
  vegan: Sprout,
  protein: Beef,
  lowcarb: Wheat,
};

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

const CONFETTI_COLORS = ['#6672ff', '#ee4f90', '#fcd34d', '#8fc8ff', '#a885ff', '#82d4ca'];

/** A short burst of paper when someone commits. */
const Confetti: React.FC = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.4,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="gp-confetti absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.6),
            background: p.color,
            borderRadius: p.round ? '999px' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

/** Drag the guide across to commit; a tap or Enter does the same for keyboards. */
const SlideToCommit: React.FC<{ done: boolean; onCommit: () => void }> = ({ done, onCommit }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const KNOB = 76;

  const max = () => (trackRef.current ? trackRef.current.clientWidth - KNOB - 12 : 0);

  const finish = () => {
    setDragging(false);
    if (x >= max() * 0.82) {
      setX(max());
      onCommit();
    } else {
      setX(0);
    }
  };

  const position = done ? max() : x;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label="Slide to commit"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setX(max());
          onCommit();
        }
      }}
      className={`relative h-[92px] rounded-full touch-none select-none overflow-hidden ${
        done ? 'bg-[color:var(--tone-600)]' : 'bg-white'
      } shadow-[0_14px_34px_-16px_rgba(70,60,160,0.45)] transition-colors duration-500`}
    >
      <span
        className={`absolute inset-0 grid place-items-center pl-16 text-[1.35rem] font-medium ${
          done ? 'text-white' : 'bg-gradient-to-r from-[color:var(--tone-500)] to-pink-400 bg-clip-text text-transparent'
        }`}
      >
        {done ? 'Yaaaaay!' : 'Slide to commit'}
      </span>
      <span
        className="orb absolute top-[8px] grid place-items-center rounded-full cursor-grab active:cursor-grabbing"
        style={{
          width: KNOB,
          height: KNOB,
          left: 6 + position,
          transition: dragging ? 'none' : 'left 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onPointerDown={(e) => {
          if (done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging || !trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          setX(Math.max(0, Math.min(max(), e.clientX - rect.left - KNOB / 2 - 6)));
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <svg width="46" height="46" viewBox="0 0 40 40" fill="none" stroke="#2d2a55" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M7 15c1.6-3.2 5.4-3.2 7 0" />
          <path d="M26 15c1.6-3.2 5.4-3.2 7 0" />
          <path d="M11 23c4.2 6.4 14.8 6.4 18 0" />
        </svg>
      </span>
    </div>
  );
};

const BUILD_STEPS = ['Choosing routines that fit you', 'Scheduling your week', 'Saving your plan'];

/**
 * The first-run questions, one at a time: the guide asks, you pick, a glowing
 * Next moves on. The answers become your first goal and a weekly plan, so the
 * app is never empty. Also reachable later from your profile to start again.
 */
export const Onboarding: React.FC<OnboardingProps> = ({ isOpen, name, onFinish, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [persona, setPersona] = useState<'client' | 'professional'>('client');
  const [focus, setFocus] = useState<Focus[]>([]);
  const [eating, setEating] = useState<string | undefined>();
  const [activity, setActivity] = useState<string | undefined>();
  const [days, setDays] = useState<number[]>([]);
  const [minutes, setMinutes] = useState<number | undefined>();
  const [months, setMonths] = useState<number | undefined>();
  const [starter, setStarter] = useState<boolean | undefined>();
  const [committed, setCommitted] = useState(false);

  const [buildProgress, setBuildProgress] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<StarterPlan[]>([]);
  const started = useRef(false);

  const flow: StepId[] = useMemo(() => {
    if (persona === 'professional') return ['welcome', 'persona', 'building', 'ready'];
    const steps: StepId[] = ['welcome', 'persona', 'focus'];
    if (focus.includes('diet')) steps.push('eating');
    steps.push('activity', 'days', 'time', 'length', 'starter', 'commit', 'building', 'ready');
    return steps;
  }, [persona, focus]);

  const step = flow[Math.min(stepIndex, flow.length - 1)];
  const progress = Math.round((stepIndex / (flow.length - 1)) * 100);

  const answers: OnboardingAnswers = {
    persona,
    focus,
    eating,
    activity,
    days: days.length > 0 ? days : defaultDays(activity),
    minutes: minutes || 30,
    months: months || 3,
    starter: starter !== false,
  };

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStepIndex((i) => Math.max(0, Math.min(flow.length - 1, i + delta)));
  };

  // Landing on a step that has nothing chosen yet should not carry a stale pick.
  // One goal at a time: choosing another replaces the choice. More goals can be added later.
  const chooseFocus = (key: Focus) => setFocus([key]);
  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const startBuild = async () => {
    setBuildError(null);
    setBuildProgress(0);
    const built = persona === 'professional' ? [] : buildStarterPlans(answers);
    setPlans(built);

    const ticker = window.setInterval(() => setBuildProgress((p) => Math.min(p + 1, BUILD_STEPS.length)), 900);
    const minimum = new Promise((resolve) => window.setTimeout(resolve, 2900));
    try {
      const [ids] = await Promise.all([onFinish(answers, built), minimum]);
      setCreatedIds(ids);
      setBuildProgress(BUILD_STEPS.length);
      window.clearInterval(ticker);
      setDirection(1);
      setStepIndex(flow.indexOf('ready'));
    } catch (err) {
      window.clearInterval(ticker);
      console.error('Onboarding finish error:', err);
      setBuildError('We could not save your plan. Check your connection and try again.');
    }
  };

  useEffect(() => {
    if (step === 'building' && !started.current) {
      started.current = true;
      void startBuild();
    }
    if (step !== 'building') started.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!isOpen) return null;

  const canNext = (): boolean => {
    switch (step) {
      case 'focus':
        return focus.length > 0;
      case 'eating':
        return !!eating;
      case 'activity':
        return !!activity;
      case 'days':
        return days.length > 0;
      case 'time':
        return !!minutes;
      case 'length':
        return !!months;
      case 'starter':
        return starter !== undefined;
      default:
        return true;
    }
  };

  const onNext = () => {
    if (step === 'persona' && persona === 'professional') {
      // A professional skips the goal questions; the flow list changes under us.
      setDirection(1);
      setStepIndex(2);
      return;
    }
    go(1);
  };

  const showBack = stepIndex > 0 && step !== 'building' && step !== 'ready';
  const firstName = name || 'there';

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
          </>
        );

      case 'focus':
        return (
          <>
            <AskBubble title="What do you want to work on?" sub="Pick one to start. You can add more goals later." />
            <div className="mt-6 space-y-3">
              {FOCUS_OPTIONS.map((o) => (
                <OptionRow key={o.key} icon={FOCUS_ICONS[o.key]} label={o.label} selected={focus.includes(o.key)} onClick={() => chooseFocus(o.key)} />
              ))}
            </div>
          </>
        );

      case 'eating':
        return (
          <>
            <AskBubble title="Do you follow an eating style?" sub="We’ll shape your meal routines around it." />
            <div className="mt-6 space-y-3">
              {EATING_OPTIONS.map((o) => (
                <OptionRow key={o.value} icon={EATING_ICONS[o.value]} label={o.label} hint={o.hint} selected={eating === o.value} onClick={() => setEating(o.value)} />
              ))}
            </div>
          </>
        );

      case 'activity':
        return (
          <>
            <AskBubble title="How active are you right now?" sub="Be honest. We’ll start where you are." />
            <div className="mt-6 space-y-3">
              {ACTIVITY_OPTIONS.map((o) => (
                <OptionRow
                  key={o.value}
                  icon={ACTIVITY_ICONS[o.value]}
                  label={o.label}
                  hint={o.hint}
                  selected={activity === o.value}
                  onClick={() => {
                    setActivity(o.value);
                    if (days.length === 0) setDays(defaultDays(o.value));
                  }}
                />
              ))}
            </div>
          </>
        );

      case 'days':
        return (
          <>
            <AskBubble title="Which days work best for you?" sub="We’ll put your routines on these days every week." />
            <div className="mt-8 grid grid-cols-7 gap-2" role="group" aria-label="Days of the week">
              {WEEK_ORDER.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="chip aspect-square grid place-items-center text-lg"
                  data-active={days.includes(day)}
                  aria-pressed={days.includes(day)}
                  aria-label={WEEKDAY_LONG[day]}
                  onClick={() => toggleDay(day)}
                >
                  {WEEKDAY_LETTER[day]}
                </button>
              ))}
            </div>
            <p className="mt-6 text-center text-sm font-medium text-slate-500">
              {days.length === 0 ? 'Pick at least one day' : `Every ${describeDays(days)}`}
            </p>
          </>
        );

      case 'time':
        return (
          <>
            <AskBubble title="How much time can you give each day?" sub="Shorter sessions mean fewer tasks, so it stays realistic." />
            <div className="mt-6 space-y-3">
              {TIME_OPTIONS.map((o) => (
                <OptionRow key={o.minutes} label={o.label} hint={o.hint} selected={minutes === o.minutes} onClick={() => setMinutes(o.minutes)} />
              ))}
            </div>
          </>
        );

      case 'length':
        return (
          <>
            <AskBubble title="How long should your first goal run?" sub="You can extend it any time." />
            <div className="mt-6 space-y-3">
              {LENGTH_OPTIONS.map((o) => (
                <OptionRow key={o.months} label={o.label} selected={months === o.months} onClick={() => setMonths(o.months)} />
              ))}
            </div>
          </>
        );

      case 'starter':
        return (
          <>
            <AskBubble title="Should I add a starter plan to your goal?" sub="Weekly routines and tasks, ready to edit." />
            <div className="mt-6 space-y-3">
              <OptionRow icon={Zap} label="Yes, build my weekly plan" selected={starter === true} onClick={() => setStarter(true)} />
              <OptionRow icon={PenTool} label="Not now, I’ll plan it myself" selected={starter === false} onClick={() => setStarter(false)} />
            </div>
          </>
        );

      case 'commit':
        return (
          <div className="relative flex-1 flex flex-col justify-center gap-8">
            {committed && <Confetti />}
            <h1 className="font-display text-[2.4rem] leading-[1.12] font-medium bg-gradient-to-r from-[color:var(--tone-500)] to-[color:var(--tone-700)] bg-clip-text text-transparent">
              Let’s commit to reaching your goal
            </h1>
            <SlideToCommit
              done={committed}
              onCommit={() => {
                setCommitted(true);
                window.setTimeout(() => go(1), 1500);
              }}
            />
          </div>
        );

      case 'building':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
            <Orb size={120} float />
            <h1 className="font-display text-[1.8rem] leading-tight font-medium text-slate-900">
              {persona === 'professional' ? 'Setting up your profile…' : 'Tailoring your plan…'}
            </h1>
            {buildError ? (
              <div className="space-y-4">
                <p className="text-sm text-rose-600 max-w-xs">{buildError}</p>
                <button type="button" className="btn-tone h-12 px-8" onClick={() => void startBuild()}>
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
          <div className="flex-1 flex flex-col">
            <div className="relative flex flex-col items-center text-center gap-4 pt-4">
              <Orb size={96} float />
              <h1 className="font-display text-[2rem] leading-tight font-medium text-slate-900">
                {persona === 'professional' ? 'You’re all set' : 'Your plan is ready'}
              </h1>
              <p className="text-sm text-slate-500 max-w-[16rem]">
                {persona === 'professional'
                  ? 'Add your qualifications so clients can trust you.'
                  : plans.some((p) => p.routines.length > 0 && starter !== false)
                  ? 'Here is your first week. Everything can be changed.'
                  : 'Your goal is ready for you to plan.'}
              </p>
            </div>
            <div className="mt-6 space-y-3 overflow-y-auto pb-2">
              {plans.map((p) => (
                <div key={p.focus} className="neu p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-slate-900">{p.title}</h3>
                    <span className="badge shrink-0">{p.months} {p.months === 1 ? 'month' : 'months'}</span>
                  </div>
                  {starter !== false && p.routines.length > 0 ? (
                    <ul className="space-y-2">
                      {p.routines.map((r) => (
                        <li key={r.name} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-slate-800">{r.name}</span>
                          <span className="shrink-0 text-xs font-bold text-[color:var(--tone-700)]">{describeDays(r.weekdays)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No routines yet. Add the first one when you open it.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const nextLabel =
    step === 'welcome' ? 'Next' : step === 'ready' ? (persona === 'professional' ? 'Set up my profile' : 'Show my plan') : step === 'focus' || step === 'persona' ? 'Next' : 'Continue';
  const hideNext = step === 'commit' || step === 'building';

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
        {/* Back, progress, close */}
        <div className="flex h-11 items-center gap-3">
          {showBack ? (
            <button type="button" onClick={() => go(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 cursor-pointer -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <span className="h-10 w-10 -ml-2" />
          )}
          {step !== 'welcome' && step !== 'building' && step !== 'ready' && (
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80" aria-hidden="true">
              <div className="h-full rounded-full bg-[color:var(--tone-500)] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          )}
          {(step === 'welcome' || step === 'persona') && stepIndex === 0 ? (
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

        {!hideNext && (
          <div className="pb-6 pt-2 safe-bottom">
            <button
              type="button"
              className="btn-tone h-14 w-full text-[1.0625rem]"
              disabled={!canNext()}
              onClick={() => {
                if (step === 'ready') {
                  onClose(persona === 'professional' ? undefined : createdIds[0]);
                  return;
                }
                onNext();
              }}
            >
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
