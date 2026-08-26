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
}

export interface Collaborator {
  uid: string;
  role: string;
  addedAt: string;
  name?: string;
  email?: string;
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
