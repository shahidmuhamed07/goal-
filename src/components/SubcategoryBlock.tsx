import React, { useState, useMemo } from 'react';
import { Goal, TaskItem } from '../types';
import { PriorityBadge } from './UIElements';
import { PROFESSIONAL_ROLES } from '../utils';

interface SubcategoryBlockProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  onRename?: (nextName: string) => void;
  onDelete?: () => void;
  tasks: TaskItem[];
  goal: Goal;
  subcategoryId?: string;
  selectedDate?: string;
  editorRole?: string;
  canDelete?: boolean;
  canAdd?: boolean;
  canRename?: boolean;
  canEditTasks?: boolean;
  onSetRole?: (nextRole: string) => void;
  onAddTask?: (goalId: string, text: string, priority: 'high' | 'medium' | 'low', subcategoryId?: string, date?: string) => void;
  onUpdateTask?: (goalId: string, taskId: string, updates: Partial<TaskItem>) => void;
  onToggleTask?: (goalId: string, taskId: string) => void;
  onDeleteTask?: (goalId: string, taskId: string) => void;
}

export const SubcategoryBlock: React.FC<SubcategoryBlockProps> = ({
  name,
  expanded,
  onToggle,
  onRename,
  onDelete,
  tasks,
  goal,
  subcategoryId,
  selectedDate,
  editorRole = '',
  canDelete = true,
  canAdd = true,
  canRename = true,
  canEditTasks = true,
  onSetRole,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(name);

  // Inline editing state for individual tasks
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [tasks]);

  const done = tasks.filter((t) => t.completed).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !subcategoryId || !onAddTask) return;
    onAddTask(goal.id, text.trim(), priority, subcategoryId, selectedDate);
    setText('');
  };

  const handleSaveRename = () => {
    const next = editVal.trim();
    if (next && next !== name && onRename) {
      onRename(next);
    } else {
      setEditVal(name);
    }
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 p-2 bg-slate-50/90 border-b border-slate-100 transition">
        {/* Toggle Expand / Collapse Button */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
            title={expanded ? 'Collapse' : 'Expand to see tasks'}
          >
            <span className="w-5 h-5 flex items-center justify-center text-[13px] font-bold text-slate-700 border border-slate-300 rounded-md bg-white shadow-2xs">
              {expanded ? '−' : '+'}
            </span>
          </button>

          {editing ? (
            <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-1.5 min-w-0 py-0.5">
              <input
                type="text"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveRename();
                  }
                  if (e.key === 'Escape') {
                    setEditVal(name);
                    setEditing(false);
                  }
                }}
                autoFocus
                className="flex-1 min-w-[140px] text-sm font-semibold text-slate-900 bg-white border border-emerald-500 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Subcategory name..."
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1"
                  title="Save changes"
                >
                  <span>✓</span>
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditVal(name);
                    setEditing(false);
                  }}
                  className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                  title="Cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              className="flex-1 min-w-0 text-left py-1 pr-1 cursor-pointer group"
            >
              <span className="block text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                {name}
              </span>
            </button>
          )}
        </div>

        {/* Right side controls: Count, Role, Edit, Delete */}
        {!editing && (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-auto pl-1">
            <span className="text-[11px] text-slate-500 font-semibold tabular-nums px-1.5 sm:px-2 py-0.5 rounded-md bg-white border border-slate-200">
              {done}/{tasks.length}
            </span>

            {onSetRole ? (
              <select
                value={editorRole || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onSetRole(e.target.value)}
                className="text-[10px] sm:text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-1.5 sm:px-2 py-1 max-w-[6.5rem] sm:max-w-[8.5rem] cursor-pointer hover:border-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                title="Assign role to this subcategory"
              >
                <option value="">Client & Pros</option>
                {PROFESSIONAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r} only
                  </option>
                ))}
              </select>
            ) : editorRole ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                {editorRole}
              </span>
            ) : null}

            {canRename && (
              <button
                type="button"
                title="Edit / Rename Subcategory"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditVal(name);
                  setEditing(true);
                }}
                className="flex items-center gap-1 text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs active:scale-95 min-h-[28px] sm:min-h-[30px]"
              >
                <span>✏️</span>
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {canDelete && onDelete && (
              <button
                type="button"
                title="Delete subcategory"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-200 p-2.5 sm:p-3 space-y-2 bg-white">
          {canAdd && onAddTask && (
            <form onSubmit={handleSubmit} className="space-y-1.5 sm:space-y-2">
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  placeholder="Add a task…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] sm:text-xs">Priority:</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[11px] sm:text-xs"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </form>
          )}

          {sortedTasks.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-xs">
              {canAdd ? 'No tasks yet. Add one above.' : 'No tasks in this group.'}
            </div>
          ) : (
            sortedTasks.map((t) => (
              <div
                key={t.id}
                className={`p-2.5 sm:p-3 rounded-xl border transition ${
                  t.completed
                    ? 'bg-slate-50/80 border-slate-100 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                {editingTaskId === t.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTaskText}
                      onChange={(e) => setEditTaskText(e.target.value)}
                      className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                      autoFocus
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <select
                        value={editTaskPriority}
                        onChange={(e) => setEditTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (editTaskText.trim() && onUpdateTask) {
                              onUpdateTask(goal.id, t.id, {
                                text: editTaskText.trim(),
                                priority: editTaskPriority,
                              });
                            }
                            setEditingTaskId(null);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold cursor-pointer shadow-2xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <label className={`flex items-start gap-2.5 flex-1 min-w-0 pr-1 ${canEditTasks ? 'cursor-pointer' : 'cursor-default'}`}>
                      <input
                        type="checkbox"
                        checked={t.completed}
                        disabled={!canEditTasks}
                        onChange={() => onToggleTask && onToggleTask(goal.id, t.id)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-xs sm:text-sm break-words ${
                            t.completed ? 'line-through text-slate-400' : 'font-medium text-slate-800'
                          }`}
                        >
                          {t.text}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <PriorityBadge priority={t.priority} />
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      {canEditTasks && onUpdateTask && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTaskId(t.id);
                            setEditTaskText(t.text);
                            setEditTaskPriority(t.priority || 'medium');
                          }}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs transition cursor-pointer"
                          title="Edit task"
                        >
                          ✏️
                        </button>
                      )}
                      {canEditTasks && onDeleteTask && (
                        <button
                          type="button"
                          onClick={() => onDeleteTask(goal.id, t.id)}
                          className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="Delete task"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
