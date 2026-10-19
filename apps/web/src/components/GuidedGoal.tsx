import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Briefcase,
  Building2,
  ChevronLeft,
  Clock,
  Coins,
  Dumbbell,
  GraduationCap,
  Sparkles,
  X,
} from 'lucide-react';
import { AskBubble, OptionRow } from './Onboarding';
import type { AiBrief, AiFollowUp, AiProgramDraft } from '../api/appApi';
import { fitnessInputs } from '../fitnessPlan';
import { menuFor } from '../exerciseMenu';
import { dayNames, decorateFitness, totalWeeksFor } from '../program';
import {
  AnswerReader,
  MINUTE_CHOICES,
  MONTH_CHOICES,
  NICHES,
  cleanText,
  describeForAi,
  isAnswered,
  makePlanWithRules,
  nicheByKey,
  visibleQuestions,
  type Answers,
  type GuidedQuestion,
  type NicheKey,
  type PlanMaker,
} from '../guidedGoal';
import type { StarterPlan } from '../starterPlan';
import { WEEKDAY_LETTER, WEEKDAY_LONG, WEEK_ORDER, describeDays } from '../recurrence';

const NICHE_ICONS: Record<NicheKey, React.ElementType> = {
  career: Briefcase,
  business: Building2,
  health: Apple,
  fitness: Dumbbell,
  money: Coins,
  learning: GraduationCap,
  custom: Sparkles,
};

interface GuidedGoalProps {
  /** Leave the flow. When a goal was just created, its id is passed so the app can open it. */
  onClose: (goalId?: string) => void;
  /** Saves the goal and its routines. Returns the new goal's id, or null when it could not be saved. */
  onCreate: (plan: StarterPlan) => Promise<string | null>;
  /** Turns answers into a plan. Defaults to the built-in rules; used whenever the AI is missing or fails. */
  makePlan?: PlanMaker;
  /**
   * The AI that asks follow-up questions and writes the plan as a program (every week new). Optional: without it, or when a call
   * fails (offline, busy, out of free quota), the flow carries on with its own fixed questions and rules.
   */
  ai?: {
    followUps: (brief: AiBrief, signal?: AbortSignal) => Promise<AiFollowUp[]>;
    program: (brief: AiBrief, signal?: AbortSignal) => Promise<AiProgramDraft>;
  };
}

/** How long to wait for the AI before carrying on without it. */
const AI_WAIT_MS = 22_000;
/** Writing the outline and a full first week takes longer than a few questions. */
const AI_PROGRAM_WAIT_MS = 45_000;

/**
 * An optional helper for someone who is not sure how to set up a goal.
 *
 * A few taps, never typing: pick a niche, answer its questions, choose your week,
 * then check a sample plan and change it before saving. The plan is only a base,
 * and every routine and task can be edited on the goal's page afterwards.
 */
export const GuidedGoal: React.FC<GuidedGoalProps> = ({ onClose, onCreate, makePlan = makePlanWithRules, ai }) => {
  // It always opens on "what do you want to work on?": nothing is chosen for the person.
  const [nicheKey, setNicheKey] = useState<NicheKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [answers, setAnswers] = useState<Answers>({});
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  // The time for each session is optional: nothing is asked or assumed until the person adds it.
  const [minutes, setMinutes] = useState<number | null>(null);
  const [months, setMonths] = useState(3);

  const [plan, setPlan] = useState<StarterPlan | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  // The AI's follow-up questions for these answers, and whether we are waiting for them or for the plan.
  const [followUps, setFollowUps] = useState<AiFollowUp[]>([]);
  const [asking, setAsking] = useState(false);
  const [planFromAiDraft, setPlanFromAiDraft] = useState(false);
  // What the AI was last asked, so going back and forward never asks (or spends free quota) twice.
  const askedFor = useRef('');
  const planCache = useRef(new Map<string, { plan: StarterPlan; byAi: boolean }>());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const niche = nicheKey ? nicheByKey(nicheKey) : null;
  const questions = useMemo(() => (niche ? visibleQuestions(niche, answers) : []), [niche, answers]);
  // The AI's questions look and answer exactly like ours: tap one, or "Something else".
  const followQuestions: GuidedQuestion[] = useMemo(
    () => followUps.map((f) => ({ id: `ai:${f.id}`, title: f.title, kind: 'single', options: f.options, allowOther: true })),
    [followUps]
  );
  const allQuestions = useMemo(() => [...questions, ...followQuestions], [questions, followQuestions]);

  // niche, then its questions, then the AI's follow-ups, then the week, then the plan to check
  const flow: string[] = useMemo(() => ['niche', ...allQuestions.map((q) => `q:${q.id}`), 'week', 'preview'], [allQuestions]);
  const step = flow[Math.min(stepIndex, flow.length - 1)];
  const question: GuidedQuestion | undefined = step.startsWith('q:') ? allQuestions.find((q) => `q:${q.id}` === step) : undefined;
  const progress = Math.round((stepIndex / (flow.length - 1)) * 100);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStepIndex((i) => Math.max(0, Math.min(flow.length - 1, i + delta)));
  };

  const chooseNiche = (key: NicheKey) => {
    if (key !== nicheKey) {
      setNicheKey(key);
      setAnswers({}); // answers belong to one niche, so a different niche starts clean
      setFollowUps([]);
    }
  };

  // Changing one of our own answers means the AI's follow-ups no longer fit, so they are asked again.
  const forgetFollowUps = (id: string) => {
    if (!id.startsWith('ai:')) setFollowUps([]);
  };
  const setAnswer = (id: string, value: string | string[]) => {
    if (JSON.stringify(answers[id]) !== JSON.stringify(value) && !id.endsWith('_other')) forgetFollowUps(id);
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };
  // Reads the latest answers rather than the ones from this render, so two quick taps both count.
  const toggleMulti = (id: string, value: string) => {
    forgetFollowUps(id);
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const options = allQuestions.find((q) => q.id === id)?.options ?? [];
      const exclusive = (v: string) => options.some((o) => o.value === v && o.exclusive);
      if (current.includes(value)) return { ...prev, [id]: current.filter((v) => v !== value) };
      // "No pain or limits" stands alone; picking anything else removes it.
      return { ...prev, [id]: exclusive(value) ? [value] : [...current.filter((v) => !exclusive(v)), value] };
    });
  };
  const toggleDay = (day: number) => setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  /** What the AI is told about this goal so far. */
  const briefFor = (withWeek: boolean): AiBrief => {
    const described = describeForAi(nicheKey!, answers, followUps);
    if (!withWeek) return described;
    const menu = nicheKey === 'fitness' ? fitnessMenu() : undefined;
    return { ...described, week: { days: dayNames(days), minutes, months }, ...(menu ? { menu } : {}) };
  };
  /** Fitness: the exercises that suit this person's place, level and limits. The AI may use only these. */
  const fitnessMenu = () => {
    if (!niche) return undefined;
    const { place, level, limits } = fitnessInputs(new AnswerReader(niche.questions, answers));
    return menuFor(place, level, limits);
  };

  /** The AI's program as a starter plan: no repeating routines, but an outline and a written first week. */
  const programPlan = (drafted: AiProgramDraft, common: { days: number[]; minutes: number | null; months: number }): StarterPlan => {
    const isFitness = nicheKey === 'fitness';
    const brief = briefFor(true);
    const fitness = isFitness && niche ? fitnessInputs(new AnswerReader(niche.questions, answers)) : undefined;
    return {
      focus: niche!.key === 'custom' ? 'custom' : niche!.key,
      title: cleanText(drafted.title, 100) || niche!.label,
      category: niche!.category,
      description: cleanText(drafted.description, 300),
      months: common.months,
      routines: [],
      program: {
        outline: drafted.outline,
        week1: isFitness ? decorateFitness(drafted.week) : drafted.week,
        brief: { niche: brief.niche, answers: brief.answers, days: dayNames(common.days), minutes: common.minutes, months: common.months },
        ...(fitness ? { fitness: { place: fitness.place, level: fitness.level, limits: fitness.limits } } : {}),
        totalWeeks: totalWeeksFor(common.months),
      },
    };
  };

  // Make the sample plan when the person reaches the last step, and again if anything it depends on changes.
  // The AI writes it when it can; if it cannot, our own rules do, so there is always a plan.
  useEffect(() => {
    if (step !== 'preview' || !nicheKey) return;
    let cancelled = false;
    setPlan(null);
    setError(null);
    const common = { days, minutes, months };
    const signature = JSON.stringify({ nicheKey, brief: ai ? briefFor(true) : answers, common });
    const show = (made: StarterPlan, byAi: boolean) => {
      if (cancelled) return;
      planCache.current.set(signature, { plan: made, byAi });
      setPlan(made);
      setPlanFromAiDraft(byAi);
      setTitleDraft(made.title);
    };
    const cached = planCache.current.get(signature);
    if (cached) {
      show(cached.plan, cached.byAi);
      return;
    }
    const byRules = () =>
      makePlan(nicheKey, answers, common)
        .then((made) => show(made, false))
        .catch(() => {
          if (!cancelled) setError('We could not put a plan together. Please go back and try again.');
        });
    if (!ai) {
      void byRules();
    } else {
      ai.program(briefFor(true), AbortSignal.timeout(AI_PROGRAM_WAIT_MS))
        .then((drafted) => show(programPlan(drafted, common), true))
        .catch(() => byRules());
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, nicheKey, answers, days, minutes, months, makePlan]);

  const canNext = (): boolean => {
    if (step === 'niche') return !!nicheKey;
    if (question) return isAnswered(question, answers);
    if (step === 'week') return days.length > 0;
    if (step === 'preview') return !!plan && (plan.routines.length > 0 || !!plan.program) && cleanText(titleDraft, 100).length > 0 && !creating;
    return true;
  };

  /**
   * Moves on. After the last of our own questions, the AI is asked for a few follow-ups that fit
   * these answers. If it cannot help (offline, busy, out of free quota) the person just carries on.
   */
  const next = async () => {
    const lastOwn = !!question && question.id === questions[questions.length - 1]?.id;
    if (ai && nicheKey && lastOwn && followUps.length === 0) {
      const brief = briefFor(false);
      const signature = JSON.stringify(brief);
      if (askedFor.current !== signature) {
        askedFor.current = signature;
        setAsking(true);
        try {
          const asked = await ai.followUps(brief, AbortSignal.timeout(AI_WAIT_MS));
          setFollowUps(asked);
        } catch {
          /* no follow-up questions; the fixed ones were enough */
        } finally {
          setAsking(false);
        }
      }
    }
    go(1);
  };

  const create = async () => {
    if (!plan || creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await onCreate({ ...plan, title: cleanText(titleDraft, 100) });
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
          <AskBubble title="What do you want to work on?" sub="Pick one. A few quick taps, then we suggest a starting plan." />
          <div className="mt-6 space-y-3">
            {NICHES.map((n) => (
              <OptionRow key={n.key} icon={NICHE_ICONS[n.key]} label={n.label} hint={n.tagline} selected={nicheKey === n.key} onClick={() => chooseNiche(n.key)} />
            ))}
          </div>
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
          <div className="mt-6 space-y-3">
            {question.options.map((o) => (
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
                    maxLength={70}
                    value={typeof answers[`${question.id}_other`] === 'string' ? (answers[`${question.id}_other`] as string) : ''}
                    onChange={(e) => setAnswer(`${question.id}_other`, e.target.value)}
                    placeholder="Type it if you like (optional)"
                    aria-label="Name your own (optional)"
                    className="w-full text-base rounded-2xl px-4 py-3.5"
                  />
                )}
              </>
            )}
          </div>
        </>
      );
    }

    if (step === 'week') {
      return (
        <>
          <AskBubble title="Plan your week" sub="Pick your days and how long it runs. You can change all of it later." />

          <p className="section-label mt-6 mb-2">Which days?</p>
          <div className="grid grid-cols-7 gap-2" role="group" aria-label="Days of the week">
            {WEEK_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                className="chip aspect-square grid place-items-center text-base"
                data-active={days.includes(day)}
                aria-pressed={days.includes(day)}
                aria-label={WEEKDAY_LONG[day]}
                onClick={() => toggleDay(day)}
              >
                {WEEKDAY_LETTER[day]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">{days.length === 0 ? 'Pick at least one day' : `Every ${describeDays(days)}`}</p>

          {minutes === null ? (
            <button type="button" className="chip mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm" onClick={() => setMinutes(30)}>
              <Clock className="h-4 w-4" />
              Add a time for each session
              <span className="font-medium text-slate-500">(optional)</span>
            </button>
          ) : (
            <>
              <div className="mt-6 mb-2 flex items-center justify-between gap-3">
                <p className="section-label">How long each time?</p>
                <button type="button" className="text-xs font-semibold text-[color:var(--tone-700)] cursor-pointer" data-plain onClick={() => setMinutes(null)}>
                  Remove time
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Minutes each day">
                {MINUTE_CHOICES.map((m) => (
                  <button key={m} type="button" className="chip py-3 text-sm" data-active={minutes === m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                    {m === 60 ? '1 hour' : `${m} min`}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="section-label mt-6 mb-2">For how long?</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Months">
            {MONTH_CHOICES.map((m) => (
              <button key={m} type="button" className="chip py-3 text-sm" data-active={months === m} aria-pressed={months === m} onClick={() => setMonths(m)}>
                {m === 1 ? '1 month' : `${m} months`}
              </button>
            ))}
          </div>
        </>
      );
    }

    // preview
    return (
      <>
        <AskBubble title="Here is a starting point" sub="This is only a start. After you create it, edit anything you like." />
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
              {plan.description && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{plan.description}</p>}
            </div>

            {plan.program && (
              <>
                <div>
                  <p className="section-label mb-2">The month in brief</p>
                  <ol className="space-y-1.5" aria-label="Outline of the first weeks">
                    {plan.program.outline.slice(0, 4).map((w, i) => (
                      <li key={i} className="flex items-baseline gap-3 text-sm">
                        <span className="w-14 shrink-0 text-xs font-bold text-[color:var(--tone-700)]">Week {i + 1}</span>
                        <span className="min-w-0 text-slate-700">
                          <strong className="font-semibold text-slate-900">{w.focus}</strong>
                          {w.note ? ` · ${w.note}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {plan.program.totalWeeks > 4 && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {plan.program.totalWeeks} weeks in all. Each next week is written when it comes, from how the last one went.
                    </p>
                  )}
                </div>
                <p className="section-label">Week 1</p>
                <ul className="space-y-3" aria-label="Sessions in week 1">
                  {plan.program.week1.map((session) => (
                    <li key={session.day} className="neu p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-base font-semibold text-slate-900">{session.name}</h3>
                        <span className="shrink-0 text-xs font-bold text-[color:var(--tone-700)]">{session.day}</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {session.tasks.map((task, i) => (
                          <li key={i} className="text-sm leading-snug text-slate-600">
                            {task.text}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <ul className="space-y-3" aria-label="Routines in this plan">
              {plan.routines.map((routine) => (
                <li key={routine.name} className="neu p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-base font-semibold text-slate-900">{routine.name}</h3>
                    <span className="shrink-0 text-xs font-bold text-[color:var(--tone-700)]">{describeDays(routine.weekdays)}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {routine.tasks.map((task) => (
                      <li key={task} className="text-sm leading-snug text-slate-600">
                        {task}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="text-center text-xs text-slate-500">
              {planFromAiDraft ? 'Suggested for you by AI, based on your answers. ' : ''}You can change everything on the goal page.
            </p>
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
      aria-label="Help me plan my goal"
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
          <button type="button" className="btn-tone h-14 w-full text-[1.0625rem]" disabled={!canNext() || asking} onClick={isPreview ? create : next}>
            {isPreview ? (creating ? 'Creating…' : 'Create my goal') : asking ? 'Thinking of a few questions…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
