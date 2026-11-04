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
 * Consecutive days the couple showed up together.
 *
 * Only couple-visible logs count: a private habit is invisible to the other
 * phone, so counting it would make the two devices disagree about the same
 * streak. Anchor on the selected day so the "maju 1 hari" simulator behaves
 * like a real day passing; a day that has just started is not a broken streak yet.
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
