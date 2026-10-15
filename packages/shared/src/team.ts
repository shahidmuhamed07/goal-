/**
 * Who may use the admin.
 *
 * - `owner`: set in the server's private settings (ADMIN_EMAILS). Can change
 *   content and add or remove managers. Cannot be changed from the screen.
 * - `manager`: added by an owner, stored in the database. Can change content,
 *   cannot add or remove anyone.
 */
export type AdminRole = 'owner' | 'manager';

/** A manager as stored. The email, lower-case, is also the id. */
export interface AdminUser {
  id: string;
  email: string;
  role: 'manager';
  /** The owner who added them. */
  addedBy: string;
  /** ISO timestamp. */
  addedAt: string;
}

/** The answer to "who am I, and what may I do?". Email is null on a developer's machine with no login set up. */
export interface Me {
  email: string | null;
  role: AdminRole;
}

/** One row of the team list. Owners come from the settings and cannot be removed here. */
export interface TeamMember {
  email: string;
  role: AdminRole;
  addedBy?: string;
  addedAt?: string;
}
