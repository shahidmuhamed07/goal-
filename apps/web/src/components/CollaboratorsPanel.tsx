import React, { useState } from 'react';
import { LogOut, Check, Target, Eye, Pencil, BadgeCheck, ExternalLink, Trash2, MessageCircle, ArrowRight } from 'lucide-react';
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
import { AccessPicker } from './AccessPicker';
import { AppSelect } from './AppSelect';
import { Dialog } from './Dialog';
import { ConfirmDialog } from './ConfirmDialog';

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
  onOpenChat: (other: { uid: string; name: string; role?: string }) => void;
  /** Uids this user has an unread message from. */
  unreadChatUids: Set<string>;
}

/** The initial of a name in a round tone badge: the face of a person in a list. */
const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <span
    aria-hidden="true"
    className="w-10 h-10 shrink-0 rounded-full grid place-items-center text-sm font-black bg-[color-mix(in_srgb,var(--tone-500)_14%,white)] text-[color:var(--tone-700)]"
  >
    {(name.trim().charAt(0) || '?').toUpperCase()}
  </span>
);

/** A labelled action for a person in a list: an icon and a word, so nothing has to be guessed. */
const RowAction: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
  /** A count shown after the label. */
  count?: number;
  /** A red dot for something unread. */
  dot?: boolean;
  active?: boolean;
}> = ({ onClick, label, children, danger, count, dot, active }) => (
  <button
    type="button"
    onClick={onClick}
    data-danger={danger ? 'true' : undefined}
    data-active={active ? 'true' : undefined}
    className="chip relative inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs"
  >
    {children}
    <span>{label}</span>
    {typeof count === 'number' && count > 0 && (
      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--tone-600)] text-white text-[10px] font-bold grid place-items-center leading-none">
        {count}
      </span>
    )}
    {dot && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />}
  </button>
);

/** Who can see which goal, as small chips (green pencil = can edit, blue eye = view only). */
const SharedGoalChips: React.FC<{ items: Array<{ goal: Goal; level: GoalAccessLevel | null }> }> = ({ items }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <span className="section-label mr-0.5">Can see</span>
    {items.length === 0 ? (
      <span className="meta">no goals yet</span>
    ) : (
      items.map(({ goal, level }) => (
        <span
          key={goal.id}
          className={`text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${
            level === 'edit' ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'
          }`}
        >
          {level === 'edit' ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          <span>{goal.title}</span>
        </span>
      ))
    )}
  </div>
);

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
  onOpenChat,
  unreadChatUids,
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
      <div className="space-y-4 sm:space-y-6 max-w-3xl">
        {/* ACTIVE CLIENT WORKSPACE BANNER WITH GREEN EXIT BUTTON */}
        <div className="neu-deep text-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Active Client Workspace
              </span>
            </div>
            <p className="text-sm font-bold text-slate-800">
              Currently viewing: <span className="text-blue-800">{activeClient?.displayName || activeClient?.email || 'Client'}</span>
            </p>
            <p className="text-xs text-slate-600">
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
          <h1 className="page-title">Client Collaborators</h1>
          <p className="page-lede">
            Viewing team members and professionals connected to <strong>{activeClient?.displayName || activeClient?.email || 'this client'}</strong>.
          </p>
        </div>

        {/* WHO ALL THE PEOPLE ARE COLLABORATED WITH THIS CLIENT */}
        <div className="neu rounded-2xl p-4 sm:p-6">
          <h2 className="card-title flex items-center gap-2">
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
                    className="neu-inset-sm p-4 space-y-2.5"
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
                        <span className="text-xs text-slate-500 font-medium bg-slate-300/30 px-2 py-0.5 rounded-md">
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
        <div className="neu rounded-2xl p-4 sm:p-6">
          <h2 className="card-title">All Clients You Work With</h2>
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
                    className="neu-inset-sm flex items-center justify-between gap-3 p-3.5"
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
                      className="chip px-3 py-1.5 text-xs"
                      data-active={isActive}
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
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      {isViewingClient && (
        <div className="neu-deep text-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Active Client Workspace
              </span>
            </div>
            <p className="text-sm font-bold text-slate-800">
              Currently viewing: <span className="text-emerald-800">{activeClient?.displayName || activeClient?.email || 'Client'}</span>
            </p>
            <p className="text-xs text-slate-600">
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
        <h1 className="page-title">Collaborate</h1>
        <p className="page-lede">
          Share your code with a trainer, doctor, or dietitian. When you approve access, you can choose exactly which goals they are assigned to manage.
        </p>
      </div>

      <div className="neu rounded-2xl p-4 sm:p-6">
        <h2 className="card-title">My Code</h2>
        <p className="card-lede">Give this to a professional so they can request access to your account.</p>
        <div className="flex items-center gap-3">
          <div className="neu-inset-sm font-mono text-2xl tracking-[0.3em] font-bold text-slate-900 px-5 py-3">
            {profile?.code || '••••••'}
          </div>
          <button
            type="button"
            onClick={copyCode}
            disabled={!profile?.code}
            className="chip px-3.5 py-2 text-xs"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="neu rounded-2xl p-4 sm:p-6">
        <h2 className="card-title">Connect as Professional</h2>
        <p className="card-lede">Enter a client’s code and the role you are requesting.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            maxLength={6}
            placeholder="ABC123"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            className="sm:w-36 font-mono tracking-widest text-sm rounded-xl px-3 py-2.5"
          />
          <AppSelect
            value={role}
            onChange={(value) => setRole(value as ProfessionalRole)}
            options={PROFESSIONAL_ROLES.map((r) => ({ value: r, label: r }))}
            ariaLabel="Role you are requesting"
            align="left"
            size="md"
            wrapperClassName="sm:w-44"
            className="field-control w-full text-sm rounded-xl px-3 py-2.5"
          />
          <button
            type="submit"
            className="btn-tone px-4 py-2.5 text-sm"
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
      <div className="neu rounded-2xl p-4 sm:p-6">
        <h2 className="card-title">Pending requests</h2>
        <p className="card-lede">Professionals waiting for your approval. You will choose which goals to assign upon approving.</p>
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
              <li key={r.id} className="neu-inset-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
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
                    className="chip px-3 py-2 text-xs"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CONNECTED PROFESSIONALS: one flat row per person, every action labelled */}
      <div className="neu rounded-2xl p-4 sm:p-6">
        <h2 className="card-title">Connected professionals</h2>
        <p className="card-lede">
          People connected to your account. They can only edit daily tasks and subcategories in the goals assigned to them.
        </p>
        {collaborators.length === 0 ? (
          <p className="meta">None yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--hairline)]">
            {collaborators.map((c) => {
              const sharedGoals = goals
                .map((g) => ({ goal: g, level: getGoalAccessLevel(c, g.id) }))
                .filter((entry) => entry.level !== null);
              const name = c.name || c.email || c.uid;

              return (
                <li key={c.uid} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 break-words">{name}</span>
                        <span className="badge">{c.role}</span>
                      </div>
                      {c.email && <div className="meta truncate">{c.email}</div>}
                    </div>
                  </div>

                  <SharedGoalChips items={sharedGoals} />

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <RowAction
                      label="Message"
                      dot={unreadChatUids.has(c.uid)}
                      onClick={() =>
                        onOpenChat({ uid: c.uid, name: c.name || c.email || 'Professional', role: c.role })
                      }
                    >
                      <MessageCircle className="w-4 h-4" />
                    </RowAction>
                    <RowAction label="Profile" onClick={() => handleOpenCredentials(c)}>
                      <BadgeCheck className="w-4 h-4" />
                    </RowAction>
                    <RowAction label="Goal access" count={sharedGoals.length} onClick={() => handleOpenManageModal(c)}>
                      <Target className="w-4 h-4" />
                    </RowAction>
                    <RowAction label="Remove" danger onClick={() => setConfirmRemoveUid(c.uid)}>
                      <Trash2 className="w-4 h-4" />
                    </RowAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* CLIENTS I SUPPORT */}
      <div className="neu rounded-2xl p-4 sm:p-6">
        <h2 className="card-title">Clients I support</h2>
        <p className="card-lede">Accounts that approved you as a professional.</p>
        {clientList.length === 0 ? (
          <p className="meta">You are not connected to any clients yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--hairline)]">
            {clientList.map((c) => {
              const myCollab = (c.collaborators || []).find((x) => x.uid === user.uid);
              const active = workspaceUid === c.id;
              const joinedOn = formatJoinedDate(c.createdAt);
              const connectedOn = formatJoinedDate(myCollab?.addedAt);
              const clientName = c.displayName || c.email || 'Client';
              return (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={clientName} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 break-words">{clientName}</div>
                      {(joinedOn || connectedOn) && (
                        <div className="meta">{joinedOn ? `Joined ${joinedOn}` : `Connected ${connectedOn}`}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    <RowAction
                      label="Message"
                      dot={unreadChatUids.has(c.id || '')}
                      onClick={() => onOpenChat({ uid: c.id || '', name: clientName })}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </RowAction>
                    <RowAction
                      label={active ? 'Viewing' : 'Open'}
                      active={active}
                      onClick={() => onSwitchWorkspace(active ? user.uid : c.id || '')}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </RowAction>
                    <RowAction label="Remove" danger onClick={() => setConfirmRemoveClientId(c.id || '')}>
                      <Trash2 className="w-4 h-4" />
                    </RowAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* REMOVE CONFIRMS: a dialog, never an inline Remove / Cancel pair */}
      {confirmRemoveUid && (
        <ConfirmDialog
          title="Remove this professional?"
          description={
            <>
              <strong>{collaborators.find((c) => c.uid === confirmRemoveUid)?.name || collaborators.find((c) => c.uid === confirmRemoveUid)?.email || 'They'}</strong>{' '}
              will lose access to your account and every goal you shared. They can ask again with your code.
            </>
          }
          confirmLabel="Yes, remove"
          busyLabel="Removing…"
          busy={isRemoving}
          onCancel={() => setConfirmRemoveUid(null)}
          onConfirm={async () => {
            try {
              setIsRemoving(true);
              await onRemove(confirmRemoveUid);
            } finally {
              setIsRemoving(false);
              setConfirmRemoveUid(null);
            }
          }}
        />
      )}
      {confirmRemoveClientId && (
        <ConfirmDialog
          title="Remove this client?"
          description={
            <>
              <strong>{(() => { const c = clientList.find((x) => x.id === confirmRemoveClientId); return c?.displayName || c?.email || 'This client'; })()}</strong>{' '}
              will leave your client list and you will no longer see their goals. They can connect with you again later.
            </>
          }
          confirmLabel="Yes, remove"
          busyLabel="Removing…"
          busy={isRemovingClient}
          onCancel={() => setConfirmRemoveClientId(null)}
          onConfirm={async () => {
            const c = clientList.find((x) => x.id === confirmRemoveClientId);
            try {
              setIsRemovingClient(true);
              await onRemoveClient(confirmRemoveClientId, c?.displayName || c?.email || 'Client');
            } finally {
              setIsRemovingClient(false);
              setConfirmRemoveClientId(null);
            }
          }}
        />
      )}

      {/* ASSIGN GOALS DIALOG */}
      {isModalOpen && (
        <Dialog
          size="xl"
          kicker={modalTargetRequest ? 'Approve & assign goals' : 'Manage assigned goals'}
          title={`Assign goals to ${targetPersonName}`}
          description={
            <>
              Choose what this <strong>{targetPersonRole}</strong> may do with each goal. <strong>View</strong> is
              read-only, <strong>Edit</strong> also lets them add and change routines and daily tasks. Goals left on{' '}
              <strong>No access</strong> stay invisible to them.
            </>
          }
          onClose={handleCloseModal}
          footer={
            <>
              <button type="button" onClick={handleCloseModal} className="chip px-4 py-2.5 text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmAssignment} className="btn-tone inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
                <Check className="w-4 h-4 stroke-[2.5]" />
                {modalTargetRequest ? `Approve with ${Object.keys(goalAccess).length} goals` : 'Save goal access'}
              </button>
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-sm font-semibold text-slate-800">
              Shared goals ({Object.keys(goalAccess).length}/{goals.length})
            </span>
            {goals.length > 0 && (
              <div className="flex items-center gap-3 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, GoalAccessLevel> = {};
                    goals.forEach((g) => {
                      next[g.id] = 'edit';
                    });
                    setGoalAccess(next);
                  }}
                  className="text-[color:var(--tone-700)] hover:underline cursor-pointer"
                >
                  Everyone can edit
                </button>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <button type="button" onClick={() => setGoalAccess({})} className="text-rose-600 hover:underline cursor-pointer">
                  Clear
                </button>
              </div>
            )}
          </div>

          {goals.length === 0 ? (
            <div className="neu-inset p-5 text-center">
              <p className="meta">
                You haven’t created any goals yet. You can approve access now, and assign goals later once you create them.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {goals.map((g) => (
                <li key={g.id} className="neu-inset-sm flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{g.title}</span>
                      <span className="badge">{g.category || 'General'}</span>
                    </div>
                    <p className="meta mt-0.5">
                      Target {formatMonthKey(g.targetDate)} · {g.milestones?.length || 0} milestones
                    </p>
                  </div>
                  <AccessPicker value={goalAccess[g.id]} onChange={(level) => setGoalLevel(g.id, level)} who={g.title} />
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}

      {/* PROFESSIONAL PROFILE DIALOG: what a client can see about a connected professional */}
      {credentialTarget && (
        <Dialog
          size="xl"
          kicker="Professional profile"
          title={credentialTarget.name || credentialTarget.email || 'Professional'}
          description="Shared by them. Qualifications link out to a source you can verify yourself."
          onClose={() => setCredentialTarget(null)}
          footer={
            <>
              <span className="meta mr-auto inline-flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Links open in a new tab
              </span>
              <button type="button" onClick={() => setCredentialTarget(null)} className="chip px-4 py-2.5 text-sm">
                Close
              </button>
            </>
          }
        >
          {credentialLoading ? (
            <p className="meta py-6 text-center font-semibold">Loading profile…</p>
          ) : credentialProfile ? (
            <ProfessionalProfileCard value={credentialProfile} />
          ) : (
            <div className="neu-inset space-y-1 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">This professional has not added a profile yet.</p>
              <p className="meta">You can still see the goals they have been given access to.</p>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
};

