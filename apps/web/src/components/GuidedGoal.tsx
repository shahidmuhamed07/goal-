import React, { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  Briefcase,
  Building2,
  ChevronLeft,
  Clock,
  Coins,
  Dumbbell,
  GraduationCap,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { AskBubble, OptionRow } from './Onboarding';
import { RoutineEditor, isRoutineReady, type DraftRoutine } from './RoutineEditor';
import { weekdaysFor } from '../fitnessPlan';
import {
  AnswerReader,
  MINUTE_CHOICES,
  MONTH_CHOICES,
  NICHES,
  cleanText,
  isAnswered,
  makePlanWithRules,
  nicheByKey,
  visibleQuestions,
  type Answers,
  type GuidedQuestion,
  type NicheKey,
  type PlanMaker,
} from '../guidedGoal';
import type { StarterPlan, StarterRoutine } from '../starterPlan';
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

/** The three day-counts offered next to a suggestion: a little lighter, the suggestion, and more (two days more). */
const presetCounts = (suggested: number): Array<{ label: string; count: number }> => {
  const options = [
    { label: 'Lighter', count: Math.max(2, suggested - 1) },
    { label: 'Recommended', count: suggested },
    { label: 'More', count: Math.min(6, suggested + 2) },
  ];
  // Drop a preset that lands on the same count as another.
  return options.filter((o, i) => options.findIndex((x) => x.count === o.count) === i || o.label === 'Recommended');
};

const sameDays = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

interface GuidedGoalProps {
  /** Leave the flow. When a goal was just created, its id is passed so the app can open it. */
  onClose: (goalId?: string) => void;
  /** Saves the goal and its routines. Returns the new goal's id, or null when it could not be saved. */
  onCreate: (plan: StarterPlan) => Promise<string | null>;
  /** Turns answers into a plan. Defaults to the built-in rules; an AI can be supplied later. */
  makePlan?: PlanMaker;
}

/**
 * An optional helper for someone who is not sure how to set up a goal.
 *
 * A few taps, never typing: pick a niche, answer its questions, choose your week,
 * then check a sample plan and change it before saving. The plan is only a base,
 * and every routine and task can be edited on the goal's page afterwards.
 */
export const GuidedGoal: React.FC<GuidedGoalProps> = ({ onClose, onCreate, makePlan = makePlanWithRules }) => {
  // It always opens on "what do you want to work on?": nothing is chosen for the person.
  const [nicheKey, setNicheKey] = useState<NicheKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [answers, setAnswers] = useState<Answers>({});
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  // The time for each session is optional: nothing is asked or assumed until the person adds it.
  const [minutes, setMinutes] = useState<number | null>(null);
  // True once the person has changed the days themselves, so a suggestion never overwrites their choice.
  const [daysChosen, setDaysChosen] = useState(false);
  const [showMoreAreas, setShowMoreAreas] = useState(false);
  const [months, setMonths] = useState(3);

  const [plan, setPlan] = useState<StarterPlan | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  // The routines of the plan as the person is shaping them, and which one is open for editing.
  const [draft, setDraft] = useState<DraftRoutine[]>([]);
  const [openRoutine, setOpenRoutine] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const niche = nicheKey ? nicheByKey(nicheKey) : null;
  const questions = useMemo(() => (niche ? visibleQuestions(niche, answers) : []), [niche, answers]);

  // What the niche suggests for the week once it knows the person (days, session length, and why).
  const advice = useMemo(() => (niche?.adviseWeek ? niche.adviseWeek(new AnswerReader(niche.questions, answers)) : undefined), [niche, answers]);

  // niche, then its questions, then the week, then the plan to check
  const flow: string[] = useMemo(() => ['niche', ...questions.map((q) => `q:${q.id}`), 'week', 'preview'], [questions]);
  const step = flow[Math.min(stepIndex, flow.length - 1)];
  const question: GuidedQuestion | undefined = step.startsWith('q:') ? questions.find((q) => `q:${q.id}` === step) : undefined;
  const progress = Math.round((stepIndex / (flow.length - 1)) * 100);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStepIndex((i) => Math.max(0, Math.min(flow.length - 1, i + delta)));
  };

  const chooseNiche = (key: NicheKey) => {
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
  const toggleDay = (day: number) => {
    setDaysChosen(true);
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };
  const setNumber = (id: string, value: number) => setAnswers((prev) => ({ ...prev, [id]: String(value) }));

  // Arriving at the week screen with a suggestion: start from it, unless the person already chose days.
  useEffect(() => {
    if (step === 'week' && advice && !daysChosen) setDays(advice.days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
        setDraft(made.routines.map((r, i) => ({ uid: `r${i}`, name: r.name, weekdays: r.weekdays, tasks: r.tasks, everyWeeks: r.everyWeeks ?? 1, included: true })));
        setOpenRoutine(null);
      })
      .catch(() => {
        if (!cancelled) setError('We could not put a plan together. Please go back and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [step, nicheKey, answers, days, minutes, months, makePlan]);

  const chosenRoutines = draft.filter((r) => r.included);
  const updateRoutine = (uid: string, changes: Partial<DraftRoutine>) =>
    setDraft((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...changes } : r)));
  const moveRoutine = (uid: string, direction: -1 | 1) =>
    setDraft((prev) => {
      const from = prev.findIndex((r) => r.uid === uid);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  const addRoutine = () => {
    const uid = `new-${Date.now()}`;
    setDraft((prev) => [...prev, { uid, name: '', weekdays: days.length > 0 ? days : [1, 3, 5], tasks: [''], everyWeeks: 1, included: true }]);
    setOpenRoutine(uid);
  };

  /** What gets saved: only the routines left included, cleaned up, in the order shown. */
  const finalRoutines = (): StarterRoutine[] =>
    chosenRoutines.map((r) => ({
      name: cleanText(r.name, 60),
      weekdays: r.weekdays,
      tasks: r.tasks.map((t) => cleanText(t, 160)).filter(Boolean),
      ...(r.everyWeeks > 1 ? { everyWeeks: r.everyWeeks } : {}),
    }));

  const canNext = (): boolean => {
    if (step === 'niche') return !!nicheKey;
    if (question) return isAnswered(question, answers);
    if (step === 'week') return days.length > 0;
    if (step === 'preview') return !!plan && chosenRoutines.length > 0 && chosenRoutines.every(isRoutineReady) && cleanText(titleDraft, 100).length > 0 && !creating;
    return true;
  };

  const create = async () => {
    if (!plan || creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await onCreate({ ...plan, title: cleanText(titleDraft, 100), routines: finalRoutines() });
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
      const main = NICHES.filter((n) => n.group === 'main');
      const more = NICHES.filter((n) => n.group === 'more');
      const moreOpen = showMoreAreas || more.some((n) => n.key === nicheKey);
      return (
        <>
          <AskBubble title="What do you want to work on?" sub="Pick one. A few quick taps, then we suggest a starting plan." />
          <div className="mt-6 space-y-3">
            {main.map((n) => (
              <OptionRow key={n.key} icon={NICHE_ICONS[n.key]} label={n.label} hint={n.tagline} selected={nicheKey === n.key} onClick={() => chooseNiche(n.key)} />
            ))}
            {!moreOpen ? (
              <button type="button" className="chip w-full py-3 text-sm" onClick={() => setShowMoreAreas(true)}>
                More areas
              </button>
            ) : (
              <>
                <p className="section-label pt-2">More areas</p>
                {more.map((n) => (
                  <OptionRow key={n.key} icon={NICHE_ICONS[n.key]} label={n.label} hint={n.tagline} selected={nicheKey === n.key} onClick={() => chooseNiche(n.key)} />
                ))}
              </>
            )}
          </div>
        </>
      );
    }

    if (question && question.kind === 'numbers') {
      return (
        <>
          <AskBubble title={question.title} sub={question.hint} />
          <div className="mt-6 space-y-4">
            {(question.fields ?? []).map((f) => {
              const touched = typeof answers[f.id] === 'string';
              const value = touched ? Number(answers[f.id]) : f.start;
              const nudge = (delta: number) => setNumber(f.id, Math.max(f.min, Math.min(f.max, value + delta)));
              return (
                <div key={f.id} className="neu space-y-3 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={`num-${f.id}`} className="section-label">
                      {f.label}
                    </label>
                    <span className={`text-3xl font-black tabular-nums ${touched ? 'text-slate-900' : 'text-slate-300'}`}>
                      {value}
                      <span className="ml-1 text-sm font-semibold text-slate-500">{f.unit}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" className="icon-action shrink-0" aria-label={`Less ${f.label.toLowerCase()}`} onClick={() => nudge(-f.step)}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      id={`num-${f.id}`}
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={value}
                      onChange={(e) => setNumber(f.id, Number(e.target.value))}
                      className="h-2 min-w-0 flex-1 cursor-pointer accent-[color:var(--tone-600)]"
                    />
                    <button type="button" className="icon-action shrink-0" aria-label={`More ${f.label.toLowerCase()}`} onClick={() => nudge(f.step)}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="meta text-center">Slide to set each one, or leave them and tap Skip.</p>
          </div>
        </>
      );
    }

    if (question) {
      const value = answers[question.id];
      const picked = typeof value === 'string' ? value : '';
      const many = Array.isArray(value) ? value : [];
      // The recommended choice, when the niche can tell from what it knows, goes first and says so.
      const recommended = question.recommend?.(answers);
      const options = recommended
        ? [...question.options.filter((o) => o.value === recommended), ...question.options.filter((o) => o.value !== recommended)]
        : question.options;
      return (
        <>
          <AskBubble title={question.title} sub={question.hint} />
          <div className="mt-6 space-y-3">
            {options.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                hint={o.value === recommended ? `Recommended for you${o.hint ? ` · ${o.hint}` : ''}` : o.hint}
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

          {advice && (
            <div className="neu-inset-sm mt-5 space-y-2.5 p-3.5">
              <p className="text-xs font-bold text-[color:var(--tone-700)]">Recommended for you</p>
              <p className="text-sm leading-snug text-slate-700">{advice.note}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Days a week">
                {presetCounts(advice.days.length).map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    className="chip px-3 py-1.5 text-xs"
                    data-active={sameDays(days, weekdaysFor(preset.count))}
                    onClick={() => {
                      setDaysChosen(true);
                      setDays(weekdaysFor(preset.count));
                    }}
                  >
                    {preset.label} · {preset.count} days
                  </button>
                ))}
              </div>
            </div>
          )}

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
            <button type="button" className="chip mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm" onClick={() => setMinutes(advice?.minutes ?? 30)}>
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
        <AskBubble title="Here is a starting point" sub="Change anything you like: days, how often, tasks, order. Then create it." />
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

            <ul className="space-y-3" aria-label="Routines in this plan">
              {draft.map((routine, index) => (
                <RoutineEditor
                  key={routine.uid}
                  routine={routine}
                  index={index}
                  count={draft.length}
                  expanded={openRoutine === routine.uid}
                  onToggleExpanded={() => setOpenRoutine((current) => (current === routine.uid ? null : routine.uid))}
                  onChange={(changes) => updateRoutine(routine.uid, changes)}
                  onMove={(direction) => moveRoutine(routine.uid, direction)}
                  onRemove={() => {
                    setDraft((prev) => prev.filter((r) => r.uid !== routine.uid));
                    setOpenRoutine(null);
                  }}
                />
              ))}
            </ul>
            <button type="button" className="chip inline-flex w-full items-center justify-center gap-2 py-3 text-sm" onClick={addRoutine}>
              <Plus className="h-4 w-4" />
              Add a routine
            </button>
            {chosenRoutines.length === 0 && <p className="text-sm font-medium text-rose-600">Keep at least one routine to create the goal.</p>}
            {chosenRoutines.length > 0 && !chosenRoutines.every(isRoutineReady) && (
              <p className="text-sm font-medium text-rose-600">Every routine needs a name and at least one day.</p>
            )}
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
          <button type="button" className="btn-tone h-14 w-full text-[1.0625rem]" disabled={!canNext()} onClick={isPreview ? create : () => go(1)}>
            {isPreview ? (creating ? 'Creating…' : 'Create my goal') : question?.kind === 'numbers' && !(question.fields ?? []).some((f) => typeof answers[f.id] === 'string') ? 'Skip for now' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
