import { HabitLog } from '../types/index';

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return toKey(new Date(y, m - 1, d + days));
}

/**
 * The day the streak is counted back from.
 *
 * A phone left open past midnight still holds yesterday as its selected day, and
 * that would quietly give the two partners different streak numbers for the same
 * room. The real day therefore wins, except when this device is deliberately
 * living in a later day (the "maju 1 hari" simulator), which stays intact.
 */
export function streakAnchor(selectedDate: string, today: string): string {
  return selectedDate > today ? selectedDate : today;
}

/**
 * Consecutive days the couple showed up together.
 *
 * Only couple-visible logs count: a private habit is invisible to the other
 * phone, so counting it would make the two devices disagree about the same
 * streak. A day that has just started is not a broken streak yet.
 */
export function coupleStreak(logs: HabitLog[], anchorDate: string): number {
  const doneDays = new Set(
    logs
      .filter((log) => log.completed && log.visibility !== 'private')
      .map((log) => log.date)
  );
  if (doneDays.size === 0) return 0;

  let cursor = doneDays.has(anchorDate) ? anchorDate : shiftKey(anchorDate, -1);
  let streak = 0;
  while (doneDays.has(cursor)) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}
