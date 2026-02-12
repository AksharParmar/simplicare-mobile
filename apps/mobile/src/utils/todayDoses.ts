import { Medication } from '../models';
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
