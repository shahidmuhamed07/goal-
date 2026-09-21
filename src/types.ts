/**
 * How much a professional may do inside one specific goal.
 * - 'view': read-only, they can see the goal but change nothing.
 * - 'edit': they can also change tasks, milestones and subcategories.
 */
export type GoalAccessLevel = 'view' | 'edit';

export interface Milestone {
  id: string;
  monthKey: string;
  title: string;
  completed: boolean;
}

export interface Subcategory {
  id: string;
  name: string;
  order: number;
  date?: string;
  editorRole?: string | null;
}

export interface TaskItem {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  date: string;
  subcategoryId?: string;
  goalId?: string;
  goalTitle?: string;
  subcategoryName?: string;
  editorRole?: string | null;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  category: string;
  description?: string;
  createdAt: string;
  targetDate: string;
  milestones: Milestone[];
  subcategories: Subcategory[];
  tasks: TaskItem[];
  /** Read-only members of this goal. */
  viewerUids?: string[];
  /** Members allowed to change tasks, milestones and subcategories. */
  editorUids?: string[];
}

export interface Collaborator {
  uid: string;
  role: string;
  addedAt: string;
  name?: string;
  email?: string;
  /** Per-goal permission, keyed by goal id. */
  goalAccess?: Record<string, GoalAccessLevel>;
  /** Legacy field kept only so older accounts still load. */
  assignedGoalIds?: string[];
}

export interface UserProfile {
  id?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  code?: string;
  collaborators?: Collaborator[];
  collaboratorUids?: string[];
  createdAt?: string;
  /** Self-declared on first sign-in; it never grants access to anyone's data. */
  persona?: AccountPersona;
  personaChosenAt?: string;
}

export type AccountPersona = 'client' | 'professional';

/**
 * A qualification the professional claims, with a link a client can check.
 * Deliberately not a file upload: a reference link to a verifiable source is
 * more useful and needs no extra storage service.
 */
export interface Credential {
  id: string;
  title: string;
  issuer: string;
  year?: string;
  /** LinkedIn profile, issuer verification page, or similar. */
  referenceUrl?: string;
}

/** A piece of work the professional wants to show off. */
export interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  link?: string;
}

/**
 * Stored in `publicProfiles/{uid}` rather than on the user document, so a
 * connected client can read it without also seeing the professional's own
 * connection code and their list of other clients.
 */
export interface ProfessionalProfile {
  uid: string;
  /** How the professional wants their name shown to clients. */
  displayName?: string;
  headline?: string;
  roles: ProfessionalRole[];
  yearsExperience?: string;
  languages?: string;
  bio?: string;
  /** Shown to connected clients. Kept to email on purpose: nothing that pulls
   *  the conversation out of the app. */
  contactEmail?: string;
  /** LinkedIn or another source a client can verify against. */
  referenceUrl?: string;
  credentials: Credential[];
  showcase: ShowcaseItem[];
  acceptingClients?: boolean;
  updatedAt?: string;
}

export interface AccessRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromEmail: string;
  fromPhoto?: string;
  toUid: string;
  toCode: string;
  role: string;
  status: 'pending' | 'approved' | 'denied' | 'removed';
  createdAt: string;
}

export type ProfessionalRole = 'Trainer' | 'Dietitian' | 'Doctor';
