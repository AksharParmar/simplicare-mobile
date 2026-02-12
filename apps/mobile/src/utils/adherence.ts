import { AppState } from '../storage/localStore';

type DailyAdherence = {
  taken: number;
  skipped: number;
  total: number;
  rate: number;
};

type DailyAdherenceRow = DailyAdherence & {
  dateISO: string;
};

function toLocalDateParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

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

function getScheduledDoseKeysForDate(state: AppState, date: Date): Set<string> {
  const keys = new Set<string>();
  const dayOfWeek = date.getDay();
  const { year, month, day } = toLocalDateParts(date);

  for (const schedule of state.schedules) {
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(dayOfWeek)) {
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

export function getDoseKey(medicationId: string, scheduledAtISO: string): string {
  const date = new Date(scheduledAtISO);
  return `${medicationId}:${toDateISO(date)}:${toTimeHHMM(date)}`;
}

export function getDailyAdherence(state: AppState, date: Date): DailyAdherence {
  const scheduledKeys = getScheduledDoseKeysForDate(state, date);
  const dateISO = toDateISO(date);

  let taken = 0;
  let skipped = 0;
  const counted = new Set<string>();

  for (const log of state.doseLogs) {
    const key = getDoseKey(log.medicationId, log.scheduledAt);
    if (counted.has(key) || !scheduledKeys.has(key) || !key.includes(`:${dateISO}:`)) {
      continue;
    }

    if (log.status === 'taken') {
      taken += 1;
      counted.add(key);
      continue;
    }

    if (log.status === 'skipped') {
      skipped += 1;
      counted.add(key);
    }
  }

  const total = scheduledKeys.size;
  const denominator = taken + skipped;

  return {
    taken,
    skipped,
    total,
    rate: denominator > 0 ? taken / denominator : 0,
  };
}

export function getLastNDaysAdherence(
  state: AppState,
  n: number,
  now: Date,
): {
  days: DailyAdherenceRow[];
  overallRate: number;
} {
  const days: DailyAdherenceRow[] = [];

  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const daily = getDailyAdherence(state, date);

    days.push({
      dateISO: toDateISO(date),
      ...daily,
    });
  }

  const taken = days.reduce((sum, day) => sum + day.taken, 0);
  const skipped = days.reduce((sum, day) => sum + day.skipped, 0);
  const denominator = taken + skipped;

  return {
    days,
    overallRate: denominator > 0 ? taken / denominator : 0,
  };
}

function isPerfectDay(day: DailyAdherence): boolean {
  return day.total > 0 && day.taken === day.total && day.skipped === 0;
}

export function getAdherenceStreak(state: AppState, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStats = getDailyAdherence(state, today);
  const includeToday = isPerfectDay(todayStats);

  let cursor = new Date(today);
  if (!includeToday) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const stats = getDailyAdherence(state, cursor);
    if (!isPerfectDay(stats)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
