import { DoseLog, Medication } from '../models';
import { AppState } from '../storage/localStore';

export type TodayDoseInstance = {
  id: string;
  medicationId: string;
  medicationName: string;
  scheduleId: string;
  scheduledAt: string;
  timeLabel: string;
  isUpcoming: boolean;
};

export type TodayDoseStats = {
  total: number;
  taken: number;
  skipped: number;
  remaining: number;
};

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':');
  return {
    hours: Number(h),
    minutes: Number(m),
  };
}

function isScheduledForToday(daysOfWeek: number[] | undefined, todayDay: number): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    return true;
  }

  return daysOfWeek.includes(todayDay);
}

function medNameById(medications: Medication[], medicationId: string): string {
  const medication = medications.find((med) => med.id === medicationId);
  return medication?.name ?? 'Unknown medication';
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toDoseKey(medicationId: string, localDateKey: string, timeLabel: string): string {
  return `${medicationId}:${localDateKey}:${timeLabel}`;
}

export function getDoseKeyFromInstance(dose: TodayDoseInstance): string {
  const scheduledDate = new Date(dose.scheduledAt);
  return toDoseKey(dose.medicationId, toLocalDateKey(scheduledDate), dose.timeLabel);
}

export function getDoseKeyFromLog(log: DoseLog): string {
  const scheduledDate = new Date(log.scheduledAt);
  return toDoseKey(log.medicationId, toLocalDateKey(scheduledDate), toTimeLabel(scheduledDate));
}

export function getTodayDoseInstances(state: AppState, now: Date = new Date()): TodayDoseInstance[] {
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const todayDay = now.getDay();

  const doses: TodayDoseInstance[] = [];

  for (const schedule of state.schedules) {
    if (!isScheduledForToday(schedule.daysOfWeek, todayDay)) {
      continue;
    }

    for (const time of schedule.times) {
      const { hours, minutes } = parseTime(time);
      const scheduledDate = new Date(todayYear, todayMonth, todayDate, hours, minutes, 0, 0);

      doses.push({
        id: `${schedule.id}_${time}`,
        medicationId: schedule.medicationId,
        medicationName: medNameById(state.medications, schedule.medicationId),
        scheduleId: schedule.id,
        scheduledAt: scheduledDate.toISOString(),
        timeLabel: time,
        isUpcoming: scheduledDate.getTime() >= now.getTime(),
      });
    }
  }

  return doses.sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

export function getCompletedDoseKeySetForToday(
  state: AppState,
  now: Date = new Date(),
): Set<string> {
  const todayKey = toLocalDateKey(now);

  return new Set(
    state.doseLogs
      .map((log) => getDoseKeyFromLog(log))
      .filter((key) => key.includes(`:${todayKey}:`)),
  );
}

export function getTodayDoseStats(
  allDoses: TodayDoseInstance[],
  state: AppState,
  now: Date = new Date(),
): TodayDoseStats {
  const allDoseKeys = allDoses.map((dose) => getDoseKeyFromInstance(dose));
  const allDoseKeySet = new Set(allDoseKeys);

  let taken = 0;
  let skipped = 0;

  const seen = new Set<string>();
  for (const log of state.doseLogs) {
    const key = getDoseKeyFromLog(log);
    if (!allDoseKeySet.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    if (log.status === 'taken') {
      taken += 1;
    } else if (log.status === 'skipped') {
      skipped += 1;
    }
  }

  const total = allDoses.length;
  const remaining = Math.max(0, total - taken - skipped);

  return {
    total,
    taken,
    skipped,
    remaining,
  };
}
