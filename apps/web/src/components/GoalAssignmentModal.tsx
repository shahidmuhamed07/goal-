import React, { useState, useEffect } from 'react';
import { X, Eye, Pencil, Ban } from 'lucide-react';
import { Goal, Collaborator, GoalAccessLevel } from '../types';
import { getGoalAccessLevel } from '../utils';

interface GoalAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  collaborators: Collaborator[];
  onSave: (goalId: string, access: Record<string, GoalAccessLevel>) => Promise<void>;
}

const LEVEL_OPTIONS: { value: GoalAccessLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'view', label: 'View', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'edit', label: 'Edit', icon: <Pencil className="w-3.5 h-3.5" /> },
];

export const GoalAssignmentModal: React.FC<GoalAssignmentModalProps> = ({
  isOpen,
  onClose,
  goal,
  collaborators,
  onSave,
}) => {
  const [access, setAccess] = useState<Record<string, GoalAccessLevel>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal && isOpen) {
      const current: Record<string, GoalAccessLevel> = {};
      collaborators.forEach((c) => {
        const level = getGoalAccessLevel(c, goal.id);
        if (level) current[c.uid] = level;
      });
      setAccess(current);
    }
  }, [goal, isOpen, collaborators]);

  if (!isOpen || !goal) return null;

  const setLevel = (uid: string, level: GoalAccessLevel | null) => {
    setAccess((prev) => {
      const next = { ...prev };
      if (level) next[uid] = level;
      else delete next[uid];
      return next;
    });
  };

  const selectedCount = Object.keys(access).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(goal.id, access);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-4 z-[60] fade fade">
      <div className="neu rounded-2xl max-w-md w-full p-6 pop max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              Goal Assignment
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Assign Professionals</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Choose who can reach <strong className="text-slate-800">"{goal.title}"</strong>.{' '}
          <strong className="text-slate-800">View</strong> is read-only,{' '}
          <strong className="text-slate-800">Edit</strong> also allows changing subcategories, routines
          and daily tasks. Anyone left on <strong className="text-slate-800">No access</strong> cannot see
          this goal at all.
        </p>

        {collaborators.length === 0 ? (
          <div className="neu-inset text-center py-6 px-4 space-y-2">
            <p className="text-xs text-slate-600 font-medium">No connected professionals yet.</p>
            <p className="text-[11px] text-slate-400">
              Go to the Collaborate tab and share your connection code with your trainer, dietitian, or coach.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-1">
              <span className="font-semibold text-slate-700">
                Connected Professionals ({selectedCount}/{collaborators.length} with access)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, GoalAccessLevel> = {};
                    collaborators.forEach((c) => {
                      next[c.uid] = 'edit';
                    });
                    setAccess(next);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-[11px] cursor-pointer"
                >
                  Everyone can edit
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setAccess({})}
                  className="text-rose-600 hover:text-rose-700 font-medium text-[11px] cursor-pointer"
                >
                  No access for everyone
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {collaborators.map((c) => {
                const level = access[c.uid];
                return (
                  <div
                    key={c.uid}
                    className={`neu-inset-sm flex items-center justify-between gap-3 p-3 transition ${
                      level === 'edit'
                        ? 'ring-2 ring-emerald-400/60'
                        : level === 'view'
                          ? 'ring-2 ring-sky-400/60'
                          : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {c.name || c.email || 'Professional'}
                          </span>
                          <span className="badge flex-shrink-0">
                            {c.role}
                          </span>
                        </div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{c.email}</div>
                        )}
                      </div>
                    </div>

                    <div className="neu-inset-sm flex items-center gap-1 p-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setLevel(c.uid, null)}
                        title="No access"
                        data-plain
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                          !level
                            ? 'bg-white text-slate-700 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                      {LEVEL_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLevel(c.uid, option.value)}
                          title={option.value === 'view' ? 'Read-only access' : 'Can edit tasks and routines'}
                          data-plain
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                            level === option.value
                              ? option.value === 'edit'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-sky-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="chip px-4 py-2.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
