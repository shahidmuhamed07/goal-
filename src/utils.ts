import { Collaborator, Goal, GoalAccessLevel } from './types';

export const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

/**
 * Permission a connected professional holds for one goal, or null when the goal
 * was never shared with them. Older accounts only stored `assignedGoalIds`,
 * which always meant full editing access.
 */
export const getGoalAccessLevel = (
  collaborator: Collaborator | null | undefined,
  goalId: string
): GoalAccessLevel | null => {
  if (!collaborator) return null;
  const explicit = collaborator.goalAccess?.[goalId];
  if (explicit === 'view' || explicit === 'edit') return explicit;
  if (collaborator.assignedGoalIds?.includes(goalId)) return 'edit';
  return null;
};

export const isGoalSharedWith = (
  collaborator: Collaborator | null | undefined,
  goalId: string
): boolean => getGoalAccessLevel(collaborator, goalId) !== null;

/**
 * The access lists a goal document must carry for Firestore to enforce who can
 * read and write it. Editors are also viewers, so a single `viewerUids` query
 * returns everything a professional is allowed to see.
 */
export const buildGoalAccessArrays = (
  collaborators: Collaborator[] | null | undefined,
  goalId: string
): { viewerUids: string[]; editorUids: string[] } => {
  const viewerUids: string[] = [];
  const editorUids: string[] = [];

  (collaborators || []).forEach((collaborator) => {
    const level = getGoalAccessLevel(collaborator, goalId);
    if (!level) return;
    viewerUids.push(collaborator.uid);
    if (level === 'edit') editorUids.push(collaborator.uid);
  });

  return { viewerUids, editorUids };
};

/** Access lists for every goal at once, keyed by goal id. */
export const buildGoalAccessMap = (
  goals: Goal[],
  collaborators: Collaborator[] | null | undefined
): Record<string, { viewerUids: string[]; editorUids: string[] }> => {
  const map: Record<string, { viewerUids: string[]; editorUids: string[] }> = {};
  goals.forEach((goal) => {
    map[goal.id] = buildGoalAccessArrays(collaborators, goal.id);
  });
  return map;
};

export const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const formatMonthKey = (monthKey?: string): string => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const formatFullMonth = (monthKey?: string): string => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const generateMonthRange = (startKey: string, targetKey: string): string[] => {
  const months: string[] = [];
  const [startYear, startMonth] = startKey.split('-').map(Number);
  const [endYear, endMonth] = targetKey.split('-').map(Number);

  let y = startYear;
  let m = startMonth;

  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
};

export const GOAL_CATEGORIES = [
  'Career',
  'Business',
  'Health',
  'Fitness',
  'Finance & Wealth',
  'Learning & Skills',
  'Creative Writing',
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const addMonthsToKey = (baseMonthKey: string, monthsToAdd: number): string => {
  const [yearStr, monthStr] = baseMonthKey.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) + monthsToAdd;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

export const getMonthsDifference = (startKey: string, endKey: string): number => {
  const [startY, startM] = startKey.split('-').map(Number);
  const [endY, endM] = endKey.split('-').map(Number);
  return (endY - startY) * 12 + (endM - startM);
};

export const PROFESSIONAL_ROLES = ['Trainer', 'Dietitian', 'Doctor'] as const;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInviteCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
};

export const requestDocId = (fromUid: string, toUid: string): string => `${fromUid}_${toUid}`;

export interface MonthDayInfo {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;  // 1..31
  dayName: string; // Mon, Tue, etc.
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isWeekend: boolean;
}

export const getDaysInMonth = (year: number, month1Indexed: number): number => {
  return new Date(year, month1Indexed, 0).getDate();
};

export const getMonthDays = (monthKey?: string): MonthDayInfo[] => {
  const todayStr = getTodayDateString();
  const mKey = monthKey || getCurrentMonthKey();
  const [yearStr, monthStr] = mKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDays = getDaysInMonth(year, month);

  const days: MonthDayInfo[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let d = 1; d <= totalDays; d++) {
    const dayPad = String(d).padStart(2, '0');
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${dayPad}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayName = dayNames[dayOfWeek];

    days.push({
      dateStr,
      dayNum: d,
      dayName,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isFuture: dateStr > todayStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return days;
};

export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const todayStr = getTodayDateString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formatted = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (dateStr === todayStr) {
    return `Today · ${formatted}`;
  }
  return formatted;
};

/**
 * A full calendar date such as "Sep 20, 2026" for stored timestamps, which may
 * be a plain "YYYY-MM-DD" day or a full ISO timestamp. Returns an empty string
 * when there is nothing usable to show, so callers can hide the line.
 */
export const formatJoinedDate = (value?: string): string => {
  if (!value) return '';
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
