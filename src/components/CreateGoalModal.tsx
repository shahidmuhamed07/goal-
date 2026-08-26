import React, { useState } from 'react';
import { getCurrentMonthKey } from '../utils';
import { Collaborator } from '../types';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators?: Collaborator[];
  onSave: (data: {
    title: string;
    category: string;
    description: string;
    targetDate: string;
    assignedProfessionalUids?: string[];
  }) => Promise<void>;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  collaborators = [],
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Career & Business');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [assignedUids, setAssignedUids] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleProfessional = (uid: string) => {
    setAssignedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate || saving) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        description: description.trim(),
        targetDate,
        assignedProfessionalUids: assignedUids,
      });

      setTitle('');
      setDescription('');
      setTargetDate('');
      setAssignedUids([]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const minMonth = getCurrentMonthKey();

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-slate-900">Define New Goal Path</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Goal Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Launch New Mobile App"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="Career & Business">Career & Business</option>
                <option value="Health & Fitness">Health & Fitness</option>
                <option value="Creative Writing">Creative Writing</option>
                <option value="Finance & Wealth">Finance & Wealth</option>
                <option value="Learning & Skills">Learning & Skills</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Target Month
              </label>
              <input
                type="month"
                required
                min={minMonth}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Description / Definition of Done
            </label>
            <textarea
              rows={3}
              placeholder="What does success look like once completed?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
            />
          </div>

          {collaborators.length > 0 && (
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Assign Connected Professionals (Optional)
              </label>
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {collaborators.map((c) => {
                  const isChecked = assignedUids.includes(c.uid);
                  return (
                    <label
                      key={c.uid}
                      className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer text-xs ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-slate-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfessional(c.uid)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>{c.name || c.email || c.uid}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {c.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-medium text-sm rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition cursor-pointer"
            >
              {saving ? 'Creating...' : 'Generate Roadmap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

