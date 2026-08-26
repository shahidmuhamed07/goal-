import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, AccessRequest, ProfessionalRole, Goal, Collaborator } from '../types';
import { PROFESSIONAL_ROLES, formatMonthKey } from '../utils';

interface CollaboratorsPanelProps {
  user: User;
  profile: UserProfile | null;
  incomingRequests: AccessRequest[];
  incomingError: string | null;
  outgoingRequests: AccessRequest[];
  clientList: UserProfile[];
  connectNotice: { type: 'ok' | 'error'; text: string } | null;
  workspaceUid: string | null;
  goals: Goal[];
  onRequestAccess: (rawCode: string, role: ProfessionalRole) => void;
  onApprove: (request: AccessRequest, assignedGoalIds: string[]) => void;
  onDeny: (request: AccessRequest) => void;
  onRemove: (professionalUid: string) => void;
  onUpdateAssignedGoals: (professionalUid: string, assignedGoalIds: string[]) => void;
  onSwitchWorkspace: (uid: string) => void;
}

export const CollaboratorsPanel: React.FC<CollaboratorsPanelProps> = ({
  user,
  profile,
  incomingRequests,
  incomingError,
  outgoingRequests,
  clientList,
  connectNotice,
  workspaceUid,
  goals,
  onRequestAccess,
  onApprove,
  onDeny,
  onRemove,
  onUpdateAssignedGoals,
  onSwitchWorkspace,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [role, setRole] = useState<ProfessionalRole>(PROFESSIONAL_ROLES[0]);
  const [copied, setCopied] = useState(false);

  // Modal State for Assigning Goals
  const [modalTargetRequest, setModalTargetRequest] = useState<AccessRequest | null>(null);
  const [modalTargetCollaborator, setModalTargetCollaborator] = useState<Collaborator | null>(null);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const pendingIn = (incomingRequests || []).filter((r) => r.status === 'pending');
  const pendingOut = (outgoingRequests || []).filter((r) => r.status === 'pending');
  const collaborators = profile?.collaborators || [];

  const copyCode = async () => {
    if (!profile?.code) return;
    try {
      await navigator.clipboard.writeText(profile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRequestAccess(codeInput, role);
  };

  // Open modal when approving a pending request
  const handleOpenApproveModal = (req: AccessRequest) => {
    setModalTargetCollaborator(null);
    setModalTargetRequest(req);
    // By default, pre-select all goals or let client choose
    setSelectedGoalIds(goals.map((g) => g.id));
  };

  // Open modal to manage existing collaborator's assigned goals
  const handleOpenManageModal = (collab: Collaborator) => {
    setModalTargetRequest(null);
    setModalTargetCollaborator(collab);
    // Load existing assignedGoalIds (if undefined/not set previously, default to all)
    if (collab.assignedGoalIds !== undefined) {
      setSelectedGoalIds(collab.assignedGoalIds);
    } else {
      setSelectedGoalIds(goals.map((g) => g.id));
    }
  };

  const handleCloseModal = () => {
    setModalTargetRequest(null);
    setModalTargetCollaborator(null);
    setSelectedGoalIds([]);
  };

  const handleToggleGoalSelect = (goalId: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const handleSelectAllGoals = () => {
    if (selectedGoalIds.length === goals.length) {
      setSelectedGoalIds([]);
    } else {
      setSelectedGoalIds(goals.map((g) => g.id));
    }
  };

  const handleConfirmAssignment = () => {
    if (modalTargetRequest) {
      onApprove(modalTargetRequest, selectedGoalIds);
    } else if (modalTargetCollaborator) {
      onUpdateAssignedGoals(modalTargetCollaborator.uid, selectedGoalIds);
    }
    handleCloseModal();
  };

  const isModalOpen = !!(modalTargetRequest || modalTargetCollaborator);
  const targetPersonName =
    modalTargetRequest?.fromName ||
    modalTargetRequest?.fromEmail ||
    modalTargetCollaborator?.name ||
    modalTargetCollaborator?.email ||
    'Professional';
  const targetPersonRole = modalTargetRequest?.role || modalTargetCollaborator?.role || 'Professional';

  const isViewingClient = !!workspaceUid && workspaceUid !== user.uid;
  const activeClient = isViewingClient ? clientList.find((c) => c.id === workspaceUid) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {isViewingClient && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Active Client Workspace
              </span>
            </div>
            <p className="text-sm font-bold text-white">
              Currently viewing: <span className="text-emerald-300">{activeClient?.displayName || activeClient?.email || 'Client'}</span>
            </p>
            <p className="text-xs text-slate-300">
              You can edit subcategories and daily tasks in the Goals tab, or return to your own dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchWorkspace(user.uid)}
            className="self-start sm:self-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <span>🚪</span>
            <span>Exit Client Workspace</span>
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Collaborate</h1>
        <p className="text-sm text-slate-500 mt-1">
          Share your code with a trainer, doctor, or dietitian. When you approve access, you can choose exactly which goals they are assigned to manage.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">My Code</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Give this to a professional so they can request access to your account.</p>
        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl tracking-[0.3em] font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
            {profile?.code || '••••••'}
          </div>
          <button
            type="button"
            onClick={copyCode}
            disabled={!profile?.code}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Connect as Professional</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Enter a client’s code and the role you are requesting.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            maxLength={6}
            placeholder="ABC123"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            className="sm:w-36 font-mono tracking-widest text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProfessionalRole)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          >
            {PROFESSIONAL_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Request access
          </button>
        </form>
        {connectNotice && (
          <p className={`text-xs mt-3 ${connectNotice.type === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>
            {connectNotice.text}
          </p>
        )}
        {pendingOut.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Your pending requests</p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {pendingOut.map((r) => (
                <li key={r.id}>
                  Code {r.toCode} · {r.role} · waiting
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* PENDING REQUESTS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pending requests</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Professionals waiting for your approval. You will choose which goals to assign upon approving.</p>
        {incomingError && (
          <p className="text-xs text-rose-600 mb-3">
            Could not load incoming requests: {incomingError}
          </p>
        )}
        {pendingIn.length === 0 ? (
          <p className="text-sm text-slate-400">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {pendingIn.map((r) => (
              <li key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{r.fromName || r.fromEmail || 'Professional'}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      {r.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.fromEmail}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => handleOpenApproveModal(r)}
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Approve & Assign Goals</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeny(r)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CONNECTED PROFESSIONALS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Connected professionals</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          People connected to your account. They can only edit daily tasks and subcategories in the goals assigned to them.
        </p>
        {collaborators.length === 0 ? (
          <p className="text-sm text-slate-400">None yet.</p>
        ) : (
          <ul className="space-y-3.5">
            {collaborators.map((c) => {
              const assignedIds = c.assignedGoalIds !== undefined ? c.assignedGoalIds : goals.map((g) => g.id);
              const assignedGoalList = goals.filter((g) => assignedIds.includes(g.id));

              return (
                <li key={c.uid} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{c.name || c.email || c.uid}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                          {c.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.email}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenManageModal(c)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Change which goals this professional can manage"
                      >
                        <span>🎯</span>
                        <span>Assign Goals ({assignedGoalList.length})</span>
                      </button>

                      {confirmRemoveUid === c.uid ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 rounded-lg animate-in fade-in duration-150">
                          <button
                            type="button"
                            disabled={isRemoving}
                            onClick={async () => {
                              try {
                                setIsRemoving(true);
                                await onRemove(c.uid);
                              } finally {
                                setIsRemoving(false);
                                setConfirmRemoveUid(null);
                              }
                            }}
                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-md cursor-pointer transition shadow-2xs disabled:opacity-50"
                          >
                            {isRemoving ? 'Removing...' : 'Confirm Remove'}
                          </button>
                          <button
                            type="button"
                            disabled={isRemoving}
                            onClick={() => setConfirmRemoveUid(null)}
                            className="text-xs font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 px-2 py-1 rounded-md cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveUid(c.uid)}
                          className="text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg cursor-pointer transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assigned Goals tags */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Assigned Goals:
                    </span>
                    {assignedGoalList.length === 0 ? (
                      <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        No goals assigned (Read-only access)
                      </span>
                    ) : (
                      assignedGoalList.map((g) => (
                        <span
                          key={g.id}
                          className="text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-medium"
                        >
                          {g.title}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* CLIENTS I SUPPORT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Clients I support</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Accounts that approved you as a professional.</p>
        {clientList.length === 0 ? (
          <p className="text-sm text-slate-400">You are not connected to any clients yet.</p>
        ) : (
          <ul className="space-y-3">
            {clientList.map((c) => {
              const myCollab = (c.collaborators || []).find((x) => x.uid === user.uid);
              const myRole = myCollab?.role;
              const active = workspaceUid === c.id;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl p-3.5">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{c.displayName || c.email || 'Client'}</div>
                    <div className="text-xs text-slate-500">Your role: {myRole || '—'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSwitchWorkspace(active ? user.uid : (c.id || ''))}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {active ? 'Viewing Workspace' : 'Open Workspace'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ASSIGN GOALS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                  {modalTargetRequest ? 'Approve & Assign Goals' : 'Manage Assigned Goals'}
                </span>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-2">
                Assign Goals to {targetPersonName}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Choose which goals this <strong>{targetPersonRole}</strong> is permitted to edit. They will only be able to add and edit daily tasks / subcategories tagged for their role inside assigned goals.
              </p>
            </div>

            {/* Goals selection list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Select Goals ({selectedGoalIds.length}/{goals.length} selected):
                </span>
                {goals.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllGoals}
                    className="text-emerald-600 font-semibold hover:underline cursor-pointer text-xs"
                  >
                    {selectedGoalIds.length === goals.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {goals.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-4">
                  <p className="text-xs text-slate-500">
                    You haven't created any goals yet. You can approve access now, and assign goals later once you create them.
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {goals.map((g) => {
                    const isChecked = selectedGoalIds.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-emerald-50/60 border-emerald-300 text-slate-900'
                            : 'bg-slate-50/40 border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleGoalSelect(g.id)}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {g.title}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                              {g.category || 'General'}
                            </span>
                          </div>
                          {g.description && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {g.description}
                            </p>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1">
                            Target: {formatMonthKey(g.targetDate)} · {g.milestones?.length || 0} milestones
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>
                  {modalTargetRequest
                    ? `Confirm & Approve (${selectedGoalIds.length} Goals)`
                    : 'Save Goal Access'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

