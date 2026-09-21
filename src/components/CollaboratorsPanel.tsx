import React, { useState } from 'react';
import { LogOut, Check, Target, X, Eye, Pencil, Ban, BadgeCheck, ExternalLink, Trash2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  UserProfile,
  AccessRequest,
  ProfessionalRole,
  Goal,
  Collaborator,
  GoalAccessLevel,
  ProfessionalProfile,
} from '../types';
import { PROFESSIONAL_ROLES, formatMonthKey, formatJoinedDate, getGoalAccessLevel } from '../utils';
import { ProfessionalProfileCard } from './ProfessionalProfilePanel';

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
  onApprove: (request: AccessRequest, goalAccess: Record<string, GoalAccessLevel>) => void;
  onDeny: (request: AccessRequest) => void;
  onRemove: (professionalUid: string) => void;
  onUpdateAssignedGoals: (
    professionalUid: string,
    goalAccess: Record<string, GoalAccessLevel>
  ) => void;
  onSwitchWorkspace: (uid: string) => void;
  onRemoveClient: (clientId: string, clientName: string) => void;
}

const ACCESS_LEVELS: { value: GoalAccessLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'view', label: 'View', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'edit', label: 'Edit', icon: <Pencil className="w-3.5 h-3.5" /> },
];

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
  onRemoveClient,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [role, setRole] = useState<ProfessionalRole>(PROFESSIONAL_ROLES[0]);
  const [copied, setCopied] = useState(false);

  // Modal State for Assigning Goals
  const [modalTargetRequest, setModalTargetRequest] = useState<AccessRequest | null>(null);
  const [modalTargetCollaborator, setModalTargetCollaborator] = useState<Collaborator | null>(null);
  const [goalAccess, setGoalAccess] = useState<Record<string, GoalAccessLevel>>({});
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemoveClientId, setConfirmRemoveClientId] = useState<string | null>(null);
  const [isRemovingClient, setIsRemovingClient] = useState(false);

  // A client reading a professional's credentials
  const [credentialTarget, setCredentialTarget] = useState<Collaborator | null>(null);
  const [credentialProfile, setCredentialProfile] = useState<ProfessionalProfile | null>(null);
  const [credentialLoading, setCredentialLoading] = useState(false);

  const handleOpenCredentials = async (collab: Collaborator) => {
    setCredentialTarget(collab);
    setCredentialProfile(null);
    setCredentialLoading(true);
    try {
      const snap = await getDoc(doc(db, 'publicProfiles', collab.uid));
      if (snap.exists()) {
        const data = snap.data() as Partial<ProfessionalProfile>;
        setCredentialProfile({
          uid: collab.uid,
          roles: [],
          credentials: [],
          showcase: [],
          ...data,
        } as ProfessionalProfile);
      }
    } catch (err) {
      console.error('Load professional credentials:', err);
    } finally {
      setCredentialLoading(false);
    }
  };

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
    // Nothing is shared until the client picks it explicitly.
    setGoalAccess({});
  };

  // Open modal to manage existing collaborator's assigned goals
  const handleOpenManageModal = (collab: Collaborator) => {
    setModalTargetRequest(null);
    setModalTargetCollaborator(collab);
    const current: Record<string, GoalAccessLevel> = {};
    goals.forEach((g) => {
      const level = getGoalAccessLevel(collab, g.id);
      if (level) current[g.id] = level;
    });
    setGoalAccess(current);
  };

  const handleCloseModal = () => {
    setModalTargetRequest(null);
    setModalTargetCollaborator(null);
    setGoalAccess({});
  };

  const setGoalLevel = (goalId: string, level: GoalAccessLevel | null) => {
    setGoalAccess((prev) => {
      const next = { ...prev };
      if (level) next[goalId] = level;
      else delete next[goalId];
      return next;
    });
  };

  const handleConfirmAssignment = () => {
    if (modalTargetRequest) {
      onApprove(modalTargetRequest, goalAccess);
    } else if (modalTargetCollaborator) {
      onUpdateAssignedGoals(modalTargetCollaborator.uid, goalAccess);
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

  // WHEN VIEWING A CLIENT WORKSPACE AS A TRAINER / PROFESSIONAL:
  // Strictly respect user intent: only show who is collaborating with this client, the exit button, and the list of clients they work on.
  if (isViewingClient) {
    return (
      <div className="space-y-6 max-w-3xl">
        {/* ACTIVE CLIENT WORKSPACE BANNER WITH GREEN EXIT BUTTON */}
        <div className="glass-deep sheen border border-white/25 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                Active Client Workspace
              </span>
            </div>
            <p className="text-sm font-bold text-white">
              Currently viewing: <span className="text-blue-200">{activeClient?.displayName || activeClient?.email || 'Client'}</span>
            </p>
            <p className="text-xs text-blue-100/80">
              You are managing this client's workspace. You can edit their goals, routine subcategories, and daily task plans.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchWorkspace(user.uid)}
            className="self-start sm:self-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
            title="Return to your personal workspace"
          >
            <LogOut className="w-3.5 h-3.5 text-white" />
            <span>Exit Client Workspace</span>
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Collaborators</h1>
          <p className="text-sm text-slate-500 mt-1">
            Viewing team members and professionals connected to <strong>{activeClient?.displayName || activeClient?.email || 'this client'}</strong>.
          </p>
        </div>

        {/* WHO ALL THE PEOPLE ARE COLLABORATED WITH THIS CLIENT */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>People Connected with this Client</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
              {collaborators.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Professionals and trainers who have access to support this client's goals.
          </p>
          {collaborators.length === 0 ? (
            <p className="text-sm text-slate-400">No other professionals connected.</p>
          ) : (
            <ul className="space-y-3">
              {collaborators.map((c) => {
                const isMe = c.uid === user.uid;
                const sharedGoals = goals
                  .map((g) => ({ goal: g, level: getGoalAccessLevel(c, g.id) }))
                  .filter((entry) => entry.level !== null);

                return (
                  <li
                    key={c.uid}
                    className={`border rounded-xl p-4 space-y-2.5 transition ${
                      isMe
                        ? 'bg-blue-50/50 border-blue-300/80 shadow-2xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {c.name || c.email || c.uid}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-200 text-blue-950 rounded-md">
                            You
                          </span>
                        )}
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md border border-blue-200">
                          {c.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </div>

                    {/* Goals assigned to this collaborator */}
                    <div className="pt-2 border-t border-slate-100/90 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Assigned Goals:
                      </span>
                      {sharedGoals.length === 0 ? (
                        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                          No goals shared
                        </span>
                      ) : (
                        sharedGoals.map(({ goal, level }) => (
                          <span
                            key={goal.id}
                            className={`text-xs px-2 py-0.5 rounded-md font-medium shadow-2xs border flex items-center gap-1 ${
                              level === 'edit'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-sky-50 text-sky-800 border-sky-200'
                            }`}
                          >
                            {level === 'edit' ? (
                              <Pencil className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            <span>{goal.title}</span>
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

        {/* ALL CLIENTS YOU SUPPORT */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">All Clients You Work With</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Switch between client accounts you have been approved to manage.
          </p>
          {clientList.length === 0 ? (
            <p className="text-sm text-slate-400">You are not connected to any other clients.</p>
          ) : (
            <ul className="space-y-3">
              {clientList.map((c) => {
                const myCollab = (c.collaborators || []).find((x) => x.uid === user.uid);
                const myRole = myCollab?.role;
                const isActive = workspaceUid === c.id;
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-3 border rounded-xl p-3.5 transition ${
                      isActive
                        ? 'bg-blue-50/70 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {c.displayName || c.email || 'Client'}
                      </div>
                      <div className="text-xs text-slate-500">Your role: {myRole || 'Professional'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSwitchWorkspace(isActive ? user.uid : (c.id || ''))}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition ${
                        isActive
                          ? 'bg-blue-700 text-white font-bold shadow-2xs'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isActive ? 'Current Client' : 'Switch Client'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // DEFAULT OWNER VIEW:
  return (
    <div className="space-y-6 max-w-3xl">
      {isViewingClient && (
        <div className="glass-deep sheen border-2 border-emerald-400/60 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            <LogOut className="w-3.5 h-3.5" />
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

      <div className="glass rounded-2xl p-6">
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

      <div className="glass rounded-2xl p-6">
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
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl press cursor-pointer"
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
      <div className="glass rounded-2xl p-6">
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
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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
      <div className="glass rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Connected professionals</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          People connected to your account. They can only edit daily tasks and subcategories in the goals assigned to them.
        </p>
        {collaborators.length === 0 ? (
          <p className="text-sm text-slate-400">None yet.</p>
        ) : (
          <ul className="space-y-3.5">
            {collaborators.map((c) => {
              const sharedGoals = goals
                .map((g) => ({ goal: g, level: getGoalAccessLevel(c, g.id) }))
                .filter((entry) => entry.level !== null);

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
                        onClick={() => handleOpenCredentials(c)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                        title="See this professional's qualifications and references"
                      >
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Credentials</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenManageModal(c)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                        title="Change which goals this professional can manage"
                      >
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Manage Access ({sharedGoals.length})</span>
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
                      Shared Goals:
                    </span>
                    {sharedGoals.length === 0 ? (
                      <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        No access to any goal
                      </span>
                    ) : (
                      sharedGoals.map(({ goal, level }) => (
                        <span
                          key={goal.id}
                          className={`text-xs px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                            level === 'edit'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          {level === 'edit' ? (
                            <Pencil className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          <span>{goal.title}</span>
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
      <div className="glass rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Clients I support</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Accounts that approved you as a professional.</p>
        {clientList.length === 0 ? (
          <p className="text-sm text-slate-400">You are not connected to any clients yet.</p>
        ) : (
          <ul className="space-y-3">
            {clientList.map((c) => {
              const myCollab = (c.collaborators || []).find((x) => x.uid === user.uid);
              const active = workspaceUid === c.id;
              const joinedOn = formatJoinedDate(c.createdAt);
              const connectedOn = formatJoinedDate(myCollab?.addedAt);
              const clientName = c.displayName || c.email || 'Client';
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border border-slate-200 rounded-xl px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{clientName}</div>
                    {(joinedOn || connectedOn) && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {joinedOn ? `Joined ${joinedOn}` : `Connected ${connectedOn}`}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSwitchWorkspace(active ? user.uid : (c.id || ''))}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                        active
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {active ? 'Viewing' : 'Open'}
                    </button>

                    {confirmRemoveClientId === c.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-1 rounded-lg">
                        <button
                          type="button"
                          disabled={isRemovingClient}
                          onClick={async () => {
                            try {
                              setIsRemovingClient(true);
                              await onRemoveClient(c.id || '', clientName);
                            } finally {
                              setIsRemovingClient(false);
                              setConfirmRemoveClientId(null);
                            }
                          }}
                          className="text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-md cursor-pointer transition shadow-2xs disabled:opacity-50"
                        >
                          {isRemovingClient ? '...' : 'Remove'}
                        </button>
                        <button
                          type="button"
                          disabled={isRemovingClient}
                          onClick={() => setConfirmRemoveClientId(null)}
                          className="text-[11px] font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 px-2 py-1 rounded-md cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveClientId(c.id || '')}
                        aria-label={`Remove ${clientName} from your client list`}
                        title="Remove this client"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ASSIGN GOALS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 fade">
          <div className="glass rounded-3xl max-w-lg w-full p-6 space-y-5 pop">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                  {modalTargetRequest ? 'Approve & Assign Goals' : 'Manage Assigned Goals'}
                </span>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-2">
                Assign Goals to {targetPersonName}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Choose what this <strong>{targetPersonRole}</strong> may do with each goal.{' '}
                <strong>View</strong> is read-only, <strong>Edit</strong> also lets them add and change
                routines and daily tasks. Goals left on <strong>No access</strong> stay invisible to them.
              </p>
            </div>

            {/* Goals selection list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Shared Goals ({Object.keys(goalAccess).length}/{goals.length}):
                </span>
                {goals.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, GoalAccessLevel> = {};
                        goals.forEach((g) => {
                          next[g.id] = 'edit';
                        });
                        setGoalAccess(next);
                      }}
                      className="text-emerald-600 font-semibold hover:underline cursor-pointer text-xs"
                    >
                      Everyone can edit
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setGoalAccess({})}
                      className="text-rose-600 font-semibold hover:underline cursor-pointer text-xs"
                    >
                      Clear
                    </button>
                  </div>
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
                    const level = goalAccess[g.id];
                    const cardTone =
                      level === 'edit'
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : level === 'view'
                          ? 'bg-sky-50/60 border-sky-300'
                          : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50';
                    return (
                      <div
                        key={g.id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition ${cardTone}`}
                      >
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

                        <div className="flex items-center gap-1 bg-white/80 border border-slate-200 rounded-lg p-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setGoalLevel(g.id, null)}
                            title="No access"
                            className={`px-1.5 py-1 rounded-md transition cursor-pointer ${
                              !level ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          {ACCESS_LEVELS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setGoalLevel(g.id, option.value)}
                              title={option.value === 'view' ? 'Read-only' : 'Can edit'}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                                level === option.value
                                  ? option.value === 'edit'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-sky-600 text-white'
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
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {modalTargetRequest
                    ? `Confirm & Approve (${Object.keys(goalAccess).length} Goals)`
                    : 'Save Goal Access'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS MODAL: what a client can see about a connected professional */}
      {credentialTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 fade">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  Professional profile
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {credentialTarget.name || credentialTarget.email || 'Professional'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shared by them. Qualifications link out to a source you can verify yourself.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCredentialTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {credentialLoading ? (
              <p className="text-xs font-semibold text-slate-500 py-6 text-center">
                Loading profile...
              </p>
            ) : credentialProfile ? (
              <ProfessionalProfileCard value={credentialProfile} />
            ) : (
              <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  This professional has not added a profile yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  You can still see the goals they have been given access to.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Links open in a new tab
              </span>
              <button
                type="button"
                onClick={() => setCredentialTarget(null)}
                className="text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

