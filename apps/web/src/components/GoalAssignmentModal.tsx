import React, { useState, useEffect } from 'react';
import { Goal, Collaborator, GoalAccessLevel } from '../types';
import { getGoalAccessLevel } from '../utils';
import { AccessPicker } from './AccessPicker';
import { Dialog } from './Dialog';

interface GoalAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  collaborators: Collaborator[];
  onSave: (goalId: string, access: Record<string, GoalAccessLevel>) => Promise<void>;
}

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
    <Dialog
      size="xl"
      kicker="Goal assignment"
      title="Assign professionals"
      description={
        <>
          Choose who can reach <strong className="text-slate-800">“{goal.title}”</strong>. <strong>View</strong> is read-only,{' '}
          <strong>Edit</strong> also allows changing subcategories, routines and daily tasks. Anyone left on{' '}
          <strong>No access</strong> cannot see this goal at all.
        </>
      }
      onClose={onClose}
      footer={
        collaborators.length === 0 ? (
          <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-sm">
            Close
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className="chip px-4 py-2.5 text-sm">
              Cancel
            </button>
            <button type="submit" form="goal-assignment-form" disabled={saving} className="btn-tone px-5 py-2.5 text-sm">
              {saving ? 'Saving…' : 'Save access'}
            </button>
          </>
        )
      }
    >
      {collaborators.length === 0 ? (
        <div className="neu-inset space-y-1 p-5 text-center">
          <p className="text-sm font-semibold text-slate-700">No connected professionals yet.</p>
          <p className="meta">Go to the Collaborate tab and share your connection code with your trainer, dietitian, or coach.</p>
        </div>
      ) : (
        <form id="goal-assignment-form" onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-sm font-semibold text-slate-800">
              Connected professionals ({selectedCount}/{collaborators.length} with access)
            </span>
            <div className="flex items-center gap-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, GoalAccessLevel> = {};
                  collaborators.forEach((c) => {
                    next[c.uid] = 'edit';
                  });
                  setAccess(next);
                }}
                className="text-[color:var(--tone-700)] hover:underline cursor-pointer"
              >
                Everyone can edit
              </button>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button type="button" onClick={() => setAccess({})} className="text-rose-600 hover:underline cursor-pointer">
                Clear
              </button>
            </div>
          </div>

          <ul className="max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
            {collaborators.map((c) => (
              <li key={c.uid} className="neu-inset-sm flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{c.name || c.email || 'Professional'}</span>
                    <span className="badge">{c.role}</span>
                  </div>
                  {c.email && <p className="meta mt-0.5 truncate">{c.email}</p>}
                </div>
                <AccessPicker value={access[c.uid]} onChange={(level) => setLevel(c.uid, level)} who={c.name || c.email || 'this professional'} />
              </li>
            ))}
          </ul>
        </form>
      )}
    </Dialog>
  );
};
