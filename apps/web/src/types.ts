/**
 * The shapes of people's own data (goals, profiles, connections, chat) are shared
 * with the API, which is where they are stored and checked. They live in
 * `@goalpath/shared`; this file keeps the app's imports short.
 */
export type {
  GoalAccessLevel,
  Milestone,
  Subcategory,
  TaskItem,
  Goal,
  Collaborator,
  UserProfile,
  AccountPersona,
  Credential,
  ShowcaseItem,
  ProfessionalProfile,
  AccessRequest,
  ProfessionalRole,
  ChatMessage,
  ChatThread,
} from '@goalpath/shared';
