import { AppState } from '../storage/localStore';

export type DayStats = {
  taken: number;
  skipped: number;
  total: number;
  remaining: number;
  rate: number;
};

function toDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeHHMM(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function parseHHMM(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function isScheduledForDate(daysOfWeek: number[] | undefined, date: Date): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return true;
  }

  return daysOfWeek.includes(date.getDay());
}

function getScheduledDoseKeys(state: AppState, date: Date): Set<string> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const keys = new Set<string>();

  for (const schedule of state.schedules) {
    if (!isScheduledForDate(schedule.daysOfWeek, date)) {
      continue;
    }

    for (const time of schedule.times) {
      const parsed = parseHHMM(time);
      if (!parsed) {
        continue;
      }

      const scheduledDate = new Date(year, month, day, parsed.hour, parsed.minute, 0, 0);
      keys.add(getDoseKey(schedule.medicationId, scheduledDate.toISOString()));
    }
  }

  return keys;
}

function getLoggedCountsForDate(state: AppState, date: Date, scheduledKeys: Set<string>): { taken: number; skipped: number } {
  let taken = 0;
  let skipped = 0;
  const dateISO = toDateISO(date);
  const seen = new Set<string>();

  for (const log of state.doseLogs) {
    const key = getDoseKey(log.medicationId, log.scheduledAt);
    if (seen.has(key) || !scheduledKeys.has(key) || !key.includes(`:${dateISO}:`)) {
      continue;
    }

    if (log.status === 'taken') {
      taken += 1;
      seen.add(key);
      continue;
    }

    if (log.status === 'skipped') {
      skipped += 1;
      seen.add(key);
    }
  }

  return { taken, skipped };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getDoseKey(medicationId: string, scheduledAtISO: string): string {
  const date = new Date(scheduledAtISO);
  return `${medicationId}:${toDateISO(date)}:${toTimeHHMM(date)}`;
}

export function getDayStats(state: AppState, date: Date): DayStats {
  const target = startOfDay(date);
  const scheduledKeys = getScheduledDoseKeys(state, target);
  const total = scheduledKeys.size;
  const { taken, skipped } = getLoggedCountsForDate(state, target, scheduledKeys);
  const remaining = Math.max(0, total - taken - skipped);

  return {
    taken,
    skipped,
    total,
    remaining,
    rate: total > 0 ? taken / total : 0,
  };
}

export function get7DayStats(
  state: AppState,
  now: Date,
): {
  overallRate: number;
  taken: number;
  skipped: number;
  totalLogged: number;
} {
  let taken = 0;
  let skipped = 0;
  const end = startOfDay(now);

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    const dayStats = getDayStats(state, date);
    taken += dayStats.taken;
    skipped += dayStats.skipped;
  }

  const totalLogged = taken + skipped;
  return {
    overallRate: totalLogged > 0 ? taken / totalLogged : 0,
    taken,
    skipped,
    totalLogged,
  };
}

export function getStreakDays(state: AppState, now: Date): number {
  const today = startOfDay(now);
  const todayStats = getDayStats(state, today);
  const includeToday = todayStats.total > 0 && todayStats.remaining === 0 && todayStats.taken === todayStats.total && todayStats.skipped === 0;

  let cursor = new Date(today);
  if (!includeToday) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const dayStats = getDayStats(state, cursor);
    const isPerfect = dayStats.total > 0 && dayStats.taken === dayStats.total && dayStats.skipped === 0;
    if (!isPerfect) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
