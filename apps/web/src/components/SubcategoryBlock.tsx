import React, { useMemo, useState } from 'react';
import { CalendarX, Check, ChevronDown, ChevronRight, Pencil, Repeat, Trash2, X } from 'lucide-react';
import { Goal, Subcategory, TaskItem } from '../types';
import { GlassIconButton } from './UIElements';
import { MenuButton, MenuSection } from './MenuButton';
import { WeekdayPicker } from './WeekdayPicker';
import { PROFESSIONAL_ROLES, formatMonthKey } from '../utils';
import {
  applySeriesDays,
  countLater,
  describeDays,
  describePattern,
  describeRepeat,
  goalEndDate,
  isRepeating,
  sortWeekdays,
  weekdayOf,
} from '../recurrence';

type Priority = 'high' | 'medium' | 'low';

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};
const nextPriority = (value: Priority): Priority =>
  value === 'high' ? 'medium' : value === 'medium' ? 'low' : 'high';

/** One key that steps High → Medium → Low, so priority never needs a dropdown. */
const PriorityKey: React.FC<{ value: Priority; onChange: (next: Priority) => void }> = ({
  value,
  onChange,
}) => (
  <button
    type="button"
    className="chip inline-flex items-center gap-1.5 px-2.5 py-2 text-xs"
    onClick={() => onChange(nextPriority(value))}
    title={`Priority: ${PRIORITY_LABEL[value]}. Click to change.`}
  >
    <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[value]}`} />
    {PRIORITY_LABEL[value]}
  </button>
);

type Confirm = 'delete-one' | 'delete-future' | 'stop';

interface SubcategoryBlockProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  tasks: TaskItem[];
  goal: Goal;
  /** The subcategory itself. Absent for the "Uncategorized" group of loose tasks. */
  sub?: Subcategory;
  /** May add, edit, complete and delete the tasks in this group. */
  canEditTasks: boolean;
  /** May rename, repeat or delete the subcategory itself. */
  canManage: boolean;
  /** Owner only: choose which professional role may edit this group. */
  canSetRole?: boolean;
  onRename?: (name: string) => void;
  onSetRole?: (role: string) => void;
  /**
   * Weekdays to repeat on from this day forward, and how many weeks apart (1 = every
   * week, 2 = every other week). An empty list stops the routine.
   */
  onChangeRepeat?: (days: number[], everyWeeks?: number) => void;
  onDelete?: (scope: 'one' | 'future') => void;
  onAddTask?: (text: string, priority: Priority, forward: boolean) => void;
  onUpdateTask?: (taskId: string, updates: Partial<TaskItem>) => void;
  onToggleTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

/**
 * One subcategory on one day: a header (name, repeat pattern, progress, ⋯ menu)
 * above its tasks and a single line to add another.
 *
 * Everything that changes the subcategory itself lives in the ⋯ menu so the card
 * stays quiet; renaming and repeating open inline, right where they apply.
 */
export const SubcategoryBlock: React.FC<SubcategoryBlockProps> = ({
  name,
  expanded,
  onToggle,
  tasks,
  goal,
  sub,
  canEditTasks,
  canManage,
  canSetRole = false,
  onRename,
  onSetRole,
  onChangeRepeat,
  onDelete,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDraft, setRepeatDraft] = useState<number[]>([]);
  const [everyDraft, setEveryDraft] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [forward, setForward] = useState(true);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');

  const repeating = isRepeating(sub);
  const repeatDays = sub?.repeatDays || [];
  const repeatEvery = sub?.repeatEvery ?? 1;
  // A routine built from days picked on a calendar has no weekdays to edit; it can only be stopped.
  const pickedDays = !!sub?.repeatDates;
  const endDate = goalEndDate(goal);
  const plan = { subcategories: goal.subcategories || [], tasks: goal.tasks || [] };

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasks]
  );
  const done = tasks.filter((t) => t.completed).length;

  // The later days of this routine, for "this removes N days" and "also add to N days".
  const later = useMemo(
    () => (sub && repeating ? countLater(plan, sub) : { days: 0, tasks: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goal.subcategories, goal.tasks, sub, repeating]
  );

  // A dry run of the repeat editor, so the person sees what Apply will do first.
  const preview = useMemo(
    () =>
      repeatOpen && sub && sub.date
        ? applySeriesDays({ ...plan, anchor: sub, days: repeatDraft, everyWeeks: everyDraft, endDate, seed: 0 })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repeatOpen, repeatDraft, everyDraft, goal.subcategories, goal.tasks, sub, endDate]
  );

  const sameDays = sortWeekdays(repeatDraft).join() === sortWeekdays(repeatDays).join();
  const repeatChanged =
    !!preview &&
    repeatDraft.length > 0 &&
    (!repeating || !sameDays || everyDraft !== repeatEvery || preview.added > 0 || preview.removed > 0);

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const previewText = (): string => {
    if (repeatDraft.length === 0) return 'Pick at least one day.';
    if (!preview) return '';
    const parts: string[] = [];
    if (preview.added > 0) parts.push(`adds ${plural(preview.added, 'day')}`);
    if (preview.removed > 0) {
      parts.push(
        `removes ${plural(preview.removed, 'later day')}${
          preview.removedTasks > 0 ? ` and ${plural(preview.removedTasks, 'task')}` : ''
        }`
      );
    }
    const until = formatMonthKey(endDate.slice(0, 7));
    const label = describePattern({ kind: 'weekly', days: repeatDraft, everyWeeks: everyDraft });
    return parts.length > 0
      ? `${label} until ${until}: ${parts.join(', ')}.`
      : repeatChanged
      ? `${label} until ${until}.`
      : 'Already repeating like this.';
  };

  const startRename = () => {
    setNameDraft(name);
    setRenaming(true);
  };

  const saveRename = () => {
    const next = nameDraft.trim();
    if (next && next !== name && onRename) onRename(next);
    setRenaming(false);
  };

  const openRepeat = () => {
    setRepeatDraft(repeating && repeatDays.length > 0 ? repeatDays : sub?.date ? [weekdayOf(sub.date)] : []);
    setEveryDraft(repeating ? repeatEvery : 1);
    setConfirm(null);
    setRepeatOpen(true);
  };

  const confirmText = (): string => {
    if (confirm === 'delete-one') {
      return `Delete “${name}” for this day${
        tasks.length > 0 ? ` and its ${plural(tasks.length, 'task')}` : ''
      }?`;
    }
    if (confirm === 'delete-future') {
      return `Delete “${name}” from this day on? That removes ${plural(later.days + 1, 'day')} and ${plural(
        tasks.length + later.tasks,
        'task'
      )}.`;
    }
    return `Stop repeating “${name}”? ${plural(later.days, 'later day')} and ${plural(
      later.tasks,
      'task'
    )} will be removed. This day stays.`;
  };

  const runConfirm = () => {
    if (confirm === 'delete-one') onDelete?.('one');
    else if (confirm === 'delete-future') onDelete?.('future');
    else if (confirm === 'stop') onChangeRepeat?.([]);
    setConfirm(null);
  };

  const menuSections: MenuSection[] = [];
  if (sub && canManage) {
    const actions: MenuSection['items'] = [];
    if (onRename) {
      actions.push({
        key: 'rename',
        label: 'Rename',
        icon: <Pencil className="w-3.5 h-3.5" />,
        onClick: startRename,
      });
    }
    if (onChangeRepeat && sub.date && !pickedDays) {
      actions.push({
        key: 'repeat',
        label: repeating ? 'Edit repeat…' : 'Repeat weekly…',
        icon: <Repeat className="w-3.5 h-3.5" />,
        onClick: openRepeat,
      });
    }
    if (onChangeRepeat && repeating) {
      actions.push({
        key: 'stop',
        label: 'Stop repeating',
        icon: <CalendarX className="w-3.5 h-3.5" />,
        onClick: () => {
          setRepeatOpen(false);
          setConfirm('stop');
        },
      });
    }
    menuSections.push({ items: actions });

    if (canSetRole && onSetRole) {
      menuSections.push({
        heading: 'Who can edit',
        items: [
          {
            key: 'role-all',
            label: 'Client & Pros',
            active: !sub.editorRole,
            onClick: () => onSetRole(''),
          },
          ...PROFESSIONAL_ROLES.map((role) => ({
            key: `role-${role}`,
            label: `${role} only`,
            active: sub.editorRole === role,
            onClick: () => onSetRole(role),
          })),
        ],
      });
    }

    if (onDelete) {
      const removals: MenuSection['items'] = [
        {
          key: 'delete',
          label: repeating ? 'Delete this day' : 'Delete subcategory',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          onClick: () => {
            setRepeatOpen(false);
            setConfirm('delete-one');
          },
        },
      ];
      if (repeating) {
        removals.push({
          key: 'delete-future',
          label: 'Delete this & later days',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          onClick: () => {
            setRepeatOpen(false);
            setConfirm('delete-future');
          },
        });
      }
      menuSections.push({ items: removals });
    }
  }

  const handleAddTask = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !onAddTask) return;
    onAddTask(value, priority, repeating && later.days > 0 && forward);
    setText('');
  };

  return (
    <section className="neu rounded-2xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GlassIconButton
          variant="tone"
          size="sm"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </GlassIconButton>

        {renaming ? (
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                }
                if (e.key === 'Escape') setRenaming(false);
              }}
              autoFocus
              aria-label="Subcategory name"
              className="flex-1 min-w-0 text-sm font-semibold rounded-xl px-3 py-1.5"
            />
            <GlassIconButton variant="tone" size="md" onClick={saveRename} title="Save name">
              <Check className="w-4 h-4" />
            </GlassIconButton>
            <GlassIconButton variant="slate" size="md" onClick={() => setRenaming(false)} title="Cancel">
              <X className="w-4 h-4" />
            </GlassIconButton>
          </div>
        ) : (
          <>
            <button
              type="button"
              data-plain
              onClick={onToggle}
              className="min-w-0 flex-1 text-left cursor-pointer"
            >
              <span className="block truncate text-sm font-bold text-slate-800">{name}</span>
            </button>

            {repeating && (repeatDays.length > 0 || pickedDays) && (
              <span
                className="badge shrink-0 max-sm:hidden!"
                title={pickedDays ? 'Repeats on days picked on a calendar' : repeatEvery > 1 ? 'Repeats every other week' : 'Repeats every week'}
              >
                <Repeat className="w-3 h-3" />
                {sub ? describeRepeat(sub, plan.subcategories.filter((s) => s.repeatId === sub.repeatId).length) : ''}
              </span>
            )}
            {sub?.editorRole && <span className="badge shrink-0">{sub.editorRole} only</span>}
            <span className="badge tabular-nums shrink-0">
              {done}/{tasks.length}
            </span>
          </>
        )}

        {!renaming && <MenuButton sections={menuSections} title="Subcategory actions" />}
      </div>

      {confirm && (
        <div className="mx-3 mb-3 neu-inset-sm px-3.5 py-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-[12rem] text-xs font-medium text-slate-700">{confirmText()}</p>
          <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => setConfirm(null)}>
            Keep
          </button>
          <button type="button" className="btn-danger px-3.5 py-1.5 text-xs" onClick={runConfirm}>
            {confirm === 'stop' ? 'Stop repeating' : 'Yes, delete'}
          </button>
        </div>
      )}

      {repeatOpen && sub && (
        <div className="mx-3 mb-3 neu-inset-sm p-3.5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="chip px-3 py-1.5 text-xs" data-active={everyDraft === 1} onClick={() => setEveryDraft(1)}>
              Every week
            </button>
            <button type="button" className="chip px-3 py-1.5 text-xs" data-active={everyDraft === 2} onClick={() => setEveryDraft(2)}>
              Every other week
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="section-label">On</span>
            <WeekdayPicker value={repeatDraft} onChange={setRepeatDraft} />
          </div>
          <p className="text-[11px] font-medium text-slate-600">{previewText()}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="chip px-3 py-1.5 text-xs" onClick={() => setRepeatOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-tone px-3.5 py-1.5 text-xs"
              disabled={!repeatChanged}
              onClick={() => {
                onChangeRepeat?.(sortWeekdays(repeatDraft), everyDraft);
                setRepeatOpen(false);
              }}
            >
              Apply from this day
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {sortedTasks.length === 0 ? (
            <p className="px-1 text-xs text-slate-500">
              {canEditTasks ? 'No tasks yet. Add the first one below.' : 'No tasks in this group.'}
            </p>
          ) : (
            <ul className="neu-inset-sm p-1.5 space-y-0.5">
              {sortedTasks.map((t) => {
                const level: Priority = t.priority || 'medium';

                if (editingTaskId === t.id) {
                  const save = () => {
                    if (editText.trim() && onUpdateTask) {
                      onUpdateTask(t.id, { text: editText.trim(), priority: editPriority });
                    }
                    setEditingTaskId(null);
                  };
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                      <input
                        type="text"
                        value={editText}
                        autoFocus
                        aria-label="Task"
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            save();
                          }
                          if (e.key === 'Escape') setEditingTaskId(null);
                        }}
                        className="flex-1 min-w-[10rem] text-sm font-medium rounded-xl px-3 py-2"
                      />
                      <PriorityKey value={editPriority} onChange={setEditPriority} />
                      <GlassIconButton variant="tone" size="md" onClick={save} title="Save task">
                        <Check className="w-4 h-4" />
                      </GlassIconButton>
                      <GlassIconButton variant="slate" size="md" onClick={() => setEditingTaskId(null)} title="Cancel">
                        <X className="w-4 h-4" />
                      </GlassIconButton>
                    </li>
                  );
                }

                return (
                  <li
                    key={t.id}
                    className="group flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/45"
                  >
                    <label
                      className={`flex items-start gap-3 flex-1 min-w-0 ${
                        canEditTasks ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={t.completed}
                        disabled={!canEditTasks}
                        onChange={() => onToggleTask?.(t.id)}
                        className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer disabled:opacity-50"
                      />
                      <span
                        className={`text-sm break-words ${
                          t.completed ? 'line-through text-slate-400' : 'font-medium text-slate-800'
                        }`}
                      >
                        {t.text}
                      </span>
                    </label>

                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[level]}`}
                      title={`${PRIORITY_LABEL[level]} priority`}
                    />

                    {canEditTasks && (onUpdateTask || onDeleteTask) && (
                      <div className="flex items-center gap-1 shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                        {onUpdateTask && (
                          <GlassIconButton
                            variant="tone"
                            size="xs"
                            title="Edit task"
                            onClick={() => {
                              setEditingTaskId(t.id);
                              setEditText(t.text);
                              setEditPriority(level);
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </GlassIconButton>
                        )}
                        {onDeleteTask && (
                          <GlassIconButton variant="rose" size="xs" title="Delete task" onClick={() => onDeleteTask(t.id)}>
                            <Trash2 className="w-3 h-3" />
                          </GlassIconButton>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canEditTasks && onAddTask && (
            <form onSubmit={handleAddTask} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add a task…"
                  aria-label="New task"
                  className="flex-1 min-w-[10rem] text-sm rounded-xl px-3.5 py-2.5"
                />
                <PriorityKey value={priority} onChange={setPriority} />
                <button type="submit" disabled={!text.trim()} className="btn-tone px-4 py-2.5 text-xs">
                  Add
                </button>
              </div>
              {repeating && later.days > 0 && (
                <label className="flex items-center gap-2 px-1 text-[11px] font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forward}
                    onChange={(e) => setForward(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span>Also add to the next {plural(later.days, 'day')} of this routine</span>
                </label>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
};
