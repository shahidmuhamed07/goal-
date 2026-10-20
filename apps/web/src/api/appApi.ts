import type {
  AccessRequest,
  ChatMessage,
  ChatThread,
  Goal,
  GoalAccessLevel,
  ProfessionalProfile,
  ProfessionalRole,
  UserProfile,
} from '../types';
import { ApiError, api } from './client';
import type { SessionDraft } from '../program';

/** What the app tells the AI planner: the area and what was chosen, as plain question and answer text. */
export interface AiBrief {
  niche: string;
  answers: { q: string; a: string }[];
  week?: { days: string[]; minutes: number | null; months: number };
  /** Fitness: the only exercises the AI may use. */
  menu?: string[];
}
/** What the AI sends back for a new goal: the outline of the whole program and the full first week. */
export interface AiProgramDraft {
  title: string;
  description: string;
  outline: { focus: string; note: string }[];
  week: SessionDraft[];
}
/** What the AI needs to write one later week. */
export interface AiWeekRequest extends AiBrief {
  weekNumber: number;
  totalWeeks: number;
  outline: { focus: string; note: string }[];
  last: { done: string[]; skipped: string[] };
  /** Fitness: the exercises used last week, so this week brings new ones. */
  recent?: string[];
}
export interface AiFollowUp {
  id: string;
  title: string;
  options: { value: string; label: string }[];
}

/** Everything the app shows, in one answer (see `GET /api/overview`). */
export interface Overview {
  profile: UserProfile;
  clients: UserProfile[];
  incoming: AccessRequest[];
  outgoing: AccessRequest[];
  threads: ChatThread[];
  goals: Goal[];
  sharedGoals: Goal[];
}

/** What a goal needs when it is created; the server adds the id, the owner and the access lists. */
export interface NewGoal {
  title: string;
  category: string;
  description: string;
  createdAt: string;
  targetDate: string;
  milestones: Goal['milestones'];
  subcategories: Goal['subcategories'];
  tasks: Goal['tasks'];
  /** Set when the AI writes this goal week by week. */
  program?: Goal['program'];
  /** Connected professionals who start with edit access. */
  assignedProfessionalUids?: string[];
}

/** The parts of a goal that may change after it exists. */
export type GoalChanges = Partial<Pick<Goal, 'title' | 'category' | 'description' | 'targetDate' | 'milestones' | 'subcategories' | 'tasks' | 'program'>>;

export type RequestResult = { result: 'sent' | 'sent_again'; request: AccessRequest };

/** Every call the app makes for its own data. Each one is a single request to the API. */
export const appApi = {
  /** Creates the account on first sign-in (with its access code) and returns it. */
  sync: () => api<UserProfile>('POST', '/api/me/sync'),
  overview: (signal?: AbortSignal) => api<Overview>('GET', '/api/overview', undefined, signal),
  patchMe: (changes: Partial<Pick<UserProfile, 'persona' | 'personaChosenAt' | 'onboardedAt' | 'onboarding'>>) =>
    api<UserProfile>('PATCH', '/api/me', changes),

  /** The AI planner. Rejects when the AI is off, busy or out of free quota; callers then use the fixed questions. */
  aiFollowUps: (brief: AiBrief, signal?: AbortSignal) =>
    api<{ questions: AiFollowUp[] }>('POST', '/api/plan', { stage: 'questions', ...brief }, signal).then((r) => r.questions),
  aiProgram: (brief: AiBrief, signal?: AbortSignal) =>
    api<{ program: AiProgramDraft }>('POST', '/api/plan', { stage: 'program', ...brief }, signal).then((r) => r.program),
  aiWeek: (request: AiWeekRequest, signal?: AbortSignal) =>
    api<{ days: SessionDraft[] }>('POST', '/api/plan', { stage: 'week', ...request }, signal).then((r) => r.days),

  createGoal: (goal: NewGoal) => api<Goal>('POST', '/api/goals', goal),
  patchGoal: (goalId: string, changes: GoalChanges) => api<Goal>('PATCH', `/api/goals/${encodeURIComponent(goalId)}`, changes),
  deleteGoal: (goalId: string) => api<void>('DELETE', `/api/goals/${encodeURIComponent(goalId)}`),
  setGoalAssignments: (goalId: string, assignments: Record<string, GoalAccessLevel | null>) =>
    api<UserProfile>('PUT', `/api/goals/${encodeURIComponent(goalId)}/assignments`, { assignments }),

  requestAccess: (code: string, role: ProfessionalRole) => api<RequestResult>('POST', '/api/access-requests', { code, role }),
  approveRequest: (requestId: string, goalAccess: Record<string, GoalAccessLevel>) =>
    api<UserProfile>('POST', `/api/access-requests/${encodeURIComponent(requestId)}/approve`, { goalAccess }),
  denyRequest: (requestId: string) => api<void>('POST', `/api/access-requests/${encodeURIComponent(requestId)}/deny`),
  setCollaboratorAccess: (uid: string, goalAccess: Record<string, GoalAccessLevel>) =>
    api<UserProfile>('PUT', `/api/collaborators/${encodeURIComponent(uid)}/access`, { goalAccess }),
  removeCollaborator: (uid: string) => api<UserProfile>('DELETE', `/api/collaborators/${encodeURIComponent(uid)}`),
  removeClient: (clientId: string) => api<void>('DELETE', `/api/clients/${encodeURIComponent(clientId)}`),
  leaveProfessional: () => api<{ profile: UserProfile; disconnected: number }>('POST', '/api/me/leave-professional'),

  /** A professional's public profile, or null when there is none to see. */
  getPublicProfile: async (uid: string): Promise<ProfessionalProfile | null> => {
    try {
      return await api<ProfessionalProfile>('GET', `/api/public-profiles/${encodeURIComponent(uid)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  savePublicProfile: (profile: Omit<ProfessionalProfile, 'uid' | 'updatedAt'>) =>
    api<ProfessionalProfile>('PUT', '/api/me/public-profile', profile),

  messages: (chatId: string, signal?: AbortSignal) =>
    api<ChatMessage[]>('GET', `/api/chats/${encodeURIComponent(chatId)}/messages`, undefined, signal),
  sendMessage: (chatId: string, text: string) => api<ChatMessage>('POST', `/api/chats/${encodeURIComponent(chatId)}/messages`, { text }),
  markRead: (chatId: string) => api<void>('POST', `/api/chats/${encodeURIComponent(chatId)}/read`),
};
