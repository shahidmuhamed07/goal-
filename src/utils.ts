export const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

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
