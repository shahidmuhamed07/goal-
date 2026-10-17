import React, { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  Briefcase,
  Building2,
  ChevronLeft,
  Coins,
  Dumbbell,
  GraduationCap,
  Moon,
  PenTool,
  X,
} from 'lucide-react';
import { AskBubble, OptionRow } from './Onboarding';
import {
  COMMON_LENGTH_OPTIONS,
  COMMON_TIME_OPTIONS,
  NICHES,
  cleanText,
  isAnswered,
  makePlanWithRules,
  nicheByKey,
  type Answers,
  type GuidedQuestion,
  type PlanMaker,
} from '../guidedGoal';
import type { Focus, StarterPlan } from '../starterPlan';
import { WEEKDAY_LETTER, WEEKDAY_LONG, WEEK_ORDER, describeDays } from '../recurrence';

const NICHE_ICONS: Record<Focus, React.ElementType> = {
  career: Briefcase,
  business: Building2,
  health: Moon,
  fitness: Dumbbell,
  diet: Apple,
  money: Coins,
  learning: GraduationCap,
  creative: PenTool,
};

interface GuidedGoalProps {
  /** Leave the flow. When a goal was just created, its id is passed so the app can open it. */
  onClose: (goalId?: string) => void;
  /** Saves the goal and its routines. Returns the new goal's id, or null when it could not be saved. */
  onCreate: (plan: StarterPlan) => Promise<string | null>;
  /** The person would rather fill in the plain form. */
  onManual: () => void;
  /** Turns answers into a plan. Defaults to the built-in rules; an AI can be supplied later. */
  makePlan?: PlanMaker;
}

/**
 * Create a goal by answering a few questions about it.
 *
 * Pick a niche, answer its questions, say when and for how long, then check a
 * sample plan and change it before saving. The plan is only a starting point:
 * every routine and task can be edited on the goal's page afterwards.
 */
export const GuidedGoal: React.FC<GuidedGoalProps> = ({ onClose, onCreate, onManual, makePlan = makePlanWithRules }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [nicheKey, setNicheKey] = useState<Focus | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [minutes, setMinutes] = useState(30);
  const [months, setMonths] = useState(3);

  const [plan, setPlan] = useState<StarterPlan | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [skipped, setSkipped] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const niche = nicheKey ? nicheByKey(nicheKey) : null;

  // niche, its questions, then when / how long / how many months, then the plan to check
  const flow: string[] = useMemo(
    () => ['niche', ...(niche ? niche.questions.map((q) => `q:${q.id}`) : []), 'days', 'time', 'length', 'preview'],
    [niche]
  );
  const step = flow[Math.min(stepIndex, flow.length - 1)];
  const question: GuidedQuestion | undefined = step.startsWith('q:') ? niche?.questions.find((q) => `q:${q.id}` === step) : undefined;
  const progress = Math.round((stepIndex / (flow.length - 1)) * 100);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStepIndex((i) => Math.max(0, Math.min(flow.length - 1, i + delta)));
  };

  const chooseNiche = (key: Focus) => {
    if (key !== nicheKey) {
      setNicheKey(key);
      setAnswers({}); // answers belong to one niche, so a different niche starts clean
    }
  };

  const setAnswer = (id: string, value: string | string[]) => setAnswers((prev) => ({ ...prev, [id]: value }));
  // Reads the latest answers rather than the ones from this render, so two quick taps both count.
  const toggleMulti = (id: string, value: string) =>
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      return { ...prev, [id]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
    });
  const toggleDay = (day: number) => setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  // Make the sample plan when the person reaches the last step, and again if anything it depends on changes.
  useEffect(() => {
    if (step !== 'preview' || !nicheKey) return;
    let cancelled = false;
    setPlan(null);
    setError(null);
    makePlan(nicheKey, answers, { days, minutes, months })
      .then((made) => {
        if (cancelled) return;
        setPlan(made);
        setTitleDraft(made.title);
        setSkipped([]);
      })
      .catch(() => {
        if (!cancelled) setError('We could not put a plan together. Please go back and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [step, nicheKey, answers, days, minutes, months, makePlan]);

  const chosenRoutines = plan ? plan.routines.filter((r) => !skipped.includes(r.name)) : [];

  const canNext = (): boolean => {
    if (step === 'niche') return !!nicheKey;
    if (question) return isAnswered(question, answers);
    if (step === 'days') return days.length > 0;
    if (step === 'preview') return !!plan && chosenRoutines.length > 0 && cleanText(titleDraft, 100).length > 0 && !creating;
    return true;
  };

  const create = async () => {
    if (!plan || creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await onCreate({ ...plan, title: cleanText(titleDraft, 100), routines: chosenRoutines });
      if (id) onClose(id);
      else setError('We could not save your goal. Check your connection and try again.');
    } catch {
      setError('We could not save your goal. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const body = (): React.ReactNode => {
    if (step === 'niche') {
      return (
        <>
          <AskBubble title="What do you want to work on?" sub="Pick one. We’ll ask a few questions about it, then suggest a plan." />
          <div className="mt-6 space-y-3">
            {NICHES.map((n) => (
              <OptionRow key={n.key} icon={NICHE_ICONS[n.key]} label={n.label} hint={n.tagline} selected={nicheKey === n.key} onClick={() => chooseNiche(n.key)} />
            ))}
          </div>
          <button type="button" className="mt-5 self-center text-sm font-semibold text-slate-500 underline underline-offset-4 cursor-pointer" onClick={onManual}>
            I’d rather fill in the form myself
          </button>
        </>
      );
    }

    if (question) {
      const value = answers[question.id];
      const picked = typeof value === 'string' ? value : '';
      const many = Array.isArray(value) ? value : [];
      return (
        <>
          <AskBubble title={question.title} sub={question.hint} />
          {question.kind === 'text' ? (
            <div className="mt-6">
              <input
                type="text"
                autoFocus
                maxLength={80}
                value={picked}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canNext()) go(1);
                }}
                placeholder={question.placeholder}
                aria-label={question.title}
                className="w-full text-base rounded-2xl px-4 py-3.5"
              />
              {question.optional && <p className="mt-2 text-xs text-slate-400">You can leave this empty.</p>}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {(question.options ?? []).map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  selected={question.kind === 'multi' ? many.includes(o.value) : picked === o.value}
                  onClick={() => (question.kind === 'multi' ? toggleMulti(question.id, o.value) : setAnswer(question.id, o.value))}
                />
              ))}
              {question.allowOther && (
                <>
                  <OptionRow label="Something else" selected={picked === 'other'} onClick={() => setAnswer(question.id, 'other')} />
                  {picked === 'other' && (
                    <input
                      type="text"
                      autoFocus
                      maxLength={70}
                      value={typeof answers[`${question.id}_other`] === 'string' ? (answers[`${question.id}_other`] as string) : ''}
                      onChange={(e) => setAnswer(`${question.id}_other`, e.target.value)}
                      placeholder="Type it here"
                      aria-label="Type your own answer"
                      className="w-full text-base rounded-2xl px-4 py-3.5"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </>
      );
    }

    if (step === 'days') {
      return (
        <>
          <AskBubble title="Which days work best?" sub="Your routines go on these days every week." />
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
          <p className="mt-6 text-center text-sm font-medium text-slate-500">{days.length === 0 ? 'Pick at least one day' : `Every ${describeDays(days)}`}</p>
        </>
      );
    }

    if (step === 'time') {
      return (
        <>
          <AskBubble title="How much time each day?" sub="Shorter sessions mean fewer tasks, so it stays realistic." />
          <div className="mt-6 space-y-3">
            {COMMON_TIME_OPTIONS.map((o) => (
              <OptionRow key={o.minutes} label={o.label} hint={o.hint} selected={minutes === o.minutes} onClick={() => setMinutes(o.minutes)} />
            ))}
          </div>
        </>
      );
    }

    if (step === 'length') {
      return (
        <>
          <AskBubble title="How long is this goal?" sub="You can extend it later." />
          <div className="mt-6 space-y-3">
            {COMMON_LENGTH_OPTIONS.map((o) => (
              <OptionRow key={o.months} label={o.label} selected={months === o.months} onClick={() => setMonths(o.months)} />
            ))}
          </div>
        </>
      );
    }

    // preview
    return (
      <>
        <AskBubble title="Here is a starting point" sub="Change the name, switch routines off, then create it. You can edit everything later." />
        {!plan && !error && <p className="mt-8 text-center text-sm text-slate-500">Putting your plan together…</p>}
        {plan && (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="guided-title" className="section-label block mb-1.5">Goal name</label>
              <input
                id="guided-title"
                type="text"
                maxLength={100}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-full text-base font-semibold rounded-2xl px-4 py-3"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {plan.category} · {plan.months} {plan.months === 1 ? 'month' : 'months'}
              </p>
            </div>

            <ul className="space-y-3" aria-label="Routines in this plan">
              {plan.routines.map((r) => {
                const on = !skipped.includes(r.name);
                return (
                  <li key={r.name} className={`neu p-4 transition-opacity ${on ? '' : 'opacity-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{r.name}</p>
                        <p className="text-xs font-semibold text-[color:var(--tone-700)]">{describeDays(r.weekdays)}</p>
                      </div>
                      <button
                        type="button"
                        className="chip px-3 py-1 text-xs"
                        data-active={on}
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Add'} ${r.name}`}
                        onClick={() => setSkipped((prev) => (on ? [...prev, r.name] : prev.filter((n) => n !== r.name)))}
                      >
                        {on ? 'Included' : 'Left out'}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc pl-5">
                      {r.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {chosenRoutines.length === 0 && <p className="text-sm font-medium text-rose-600">Keep at least one routine to create the goal.</p>}
          </div>
        )}
        {error && <p className="mt-6 text-center text-sm font-medium text-rose-600" role="alert">{error}</p>}
      </>
    );
  };

  const isPreview = step === 'preview';

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
      aria-label="Create a goal"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-6 safe-top">
        <div className="flex h-11 items-center gap-3">
          {stepIndex > 0 && !creating ? (
            <button type="button" onClick={() => go(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 cursor-pointer -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <span className="h-10 w-10 -ml-2" />
          )}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80" aria-hidden="true">
            <div className="h-full rounded-full bg-[color:var(--tone-500)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" onClick={() => onClose()} aria-label="Close" disabled={creating} className="grid h-10 w-10 place-items-center rounded-full text-slate-400 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div key={step} className="tab-panel hide-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pt-4 pb-4" data-dir={direction}>
          {body()}
        </div>

        <div className="pb-6 pt-2 safe-bottom">
          <button type="button" className="btn-tone h-14 w-full text-[1.0625rem]" disabled={!canNext()} onClick={isPreview ? create : () => go(1)}>
            {isPreview ? (creating ? 'Creating…' : 'Create my goal') : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
