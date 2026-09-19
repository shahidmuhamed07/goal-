import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Goal, Collaborator } from '../types';

interface GoalAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  collaborators: Collaborator[];
  onSave: (goalId: string, assignedCollaboratorUids: string[]) => Promise<void>;
}

export const GoalAssignmentModal: React.FC<GoalAssignmentModalProps> = ({
  isOpen,
  onClose,
  goal,
  collaborators,
  onSave,
}) => {
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal && isOpen) {
      // Find which collaborators currently have this goal assigned
      const assigned = collaborators
        .filter((c) => {
          if (c.assignedGoalIds !== undefined) {
            return c.assignedGoalIds.includes(goal.id);
          }
          return true; // Default legacy
        })
        .map((c) => c.uid);
      setSelectedUids(assigned);
    }
  }, [goal, isOpen, collaborators]);

  if (!isOpen || !goal) return null;

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAll = () => {
    setSelectedUids(collaborators.map((c) => c.uid));
  };

  const handleDeselectAll = () => {
    setSelectedUids([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(goal.id, selectedUids);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
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
          Choose which connected professionals are authorized to create subcategories, schedule routines, and manage daily tasks for{' '}
          <strong className="text-slate-800">"{goal.title}"</strong>.
        </p>

        {collaborators.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
            <p className="text-xs text-slate-600 font-medium">No connected professionals yet.</p>
            <p className="text-[11px] text-slate-400">
              Go to the Collaborate tab and share your connection code with your trainer, dietitian, or coach.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-1">
              <span className="font-semibold text-slate-700">
                Connected Professionals ({selectedUids.length}/{collaborators.length} assigned)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-[11px] cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:text-slate-700 font-medium text-[11px] cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {collaborators.map((c) => {
                const isSelected = selectedUids.includes(c.uid);
                return (
                  <label
                    key={c.uid}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUid(c.uid)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {c.name || c.email || 'Professional'}
                        </div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400 truncate">{c.email}</div>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                      {c.role}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-medium text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Assigned Professionals'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
