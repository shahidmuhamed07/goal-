import type { Banner, Page, PlanTemplate, Popup, TeamMember } from '@goalpath/shared';

/**
 * How the admin reads and writes content.
 *
 * The screens only know this interface. Today it is answered by `mockApi.ts`
 * (browser storage with sample data). When the backend exists, one new file
 * answers the same interface by calling the real API, and no screen changes.
 */
export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  /** Creates the item, or replaces it when the id already exists. */
  save(item: T): Promise<T>;
  remove(id: string): Promise<void>;
}

/** Managing who may use the admin. Only owners are allowed to call it. */
export interface TeamApi {
  list(): Promise<TeamMember[]>;
  add(email: string): Promise<void>;
  remove(email: string): Promise<void>;
}

export interface ContentApi {
  /** True while data is fake and only lives in this browser. */
  readonly isMock: boolean;
  banners: Repository<Banner>;
  popups: Repository<Popup>;
  pages: Repository<Page>;
  plans: Repository<PlanTemplate>;
  /** Only available when the server has real login (not in practice mode). */
  team?: TeamApi;
  /** Puts the sample data back. Only meaningful for the mock. */
  resetSamples?(): Promise<void>;
}
