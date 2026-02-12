import { AppState } from '../storage/localStore';
import type { CloudMedicationLogRow, CloudMedicationRow } from './types';

export type MergeResult = {
  state: AppState;
  changed: boolean;
};

function toMillis(iso: string | null | undefined): number {
  if (!iso) {
    return 0;
  }

  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function localMedicationUpdatedAt(state: AppState, medicationId: string): number {
  const medication = state.medications.find((item) => item.id === medicationId);
  if (!medication) {
    return 0;
  }

  const scheduleTimes = state.schedules
    .filter((schedule) => schedule.medicationId === medicationId)
    .map((schedule) => new Date(schedule.updatedAt ?? schedule.createdAt).getTime());

  const medicationTime = new Date(medication.updatedAt ?? medication.createdAt).getTime();
  const latestScheduleTime = scheduleTimes.length > 0 ? Math.max(...scheduleTimes) : 0;
  return Math.max(medicationTime, latestScheduleTime);
}

export function mergeRemoteIntoLocal(
  localState: AppState,
  remoteMedications: CloudMedicationRow[],
  remoteLogs: CloudMedicationLogRow[],
): MergeResult {
  let changed = false;

  let medications = [...localState.medications];
  let schedules = [...localState.schedules];
  let doseLogs = [...localState.doseLogs];

  for (const remote of remoteMedications) {
    const localUpdated = localMedicationUpdatedAt(
      {
        medications,
        schedules,
        doseLogs,
      },
      remote.id,
    );

    const remoteUpdated = toMillis(remote.updated_at);
    const remoteDeleted = toMillis(remote.deleted_at);

    if (remoteDeleted > 0 && remoteDeleted >= localUpdated) {
      const prevMedicationLen = medications.length;
      medications = medications.filter((item) => item.id !== remote.id);
      schedules = schedules.filter((item) => item.medicationId !== remote.id);
      doseLogs = doseLogs.filter((item) => item.medicationId !== remote.id);
      changed = changed || prevMedicationLen !== medications.length;
      continue;
    }

    if (remoteUpdated >= localUpdated) {
      const existingMed = medications.find((item) => item.id === remote.id);
      const nextMed = {
        id: remote.id,
        name: remote.name,
        strength: remote.strength ?? undefined,
        instructions: remote.instructions ?? undefined,
        scanText: remote.scan_text ?? undefined,
        scanSource: remote.scan_source ?? undefined,
        scanCapturedAt: remote.scan_captured_at ?? undefined,
        createdAt: remote.created_at,
        updatedAt: remote.updated_at,
      };

      if (!existingMed) {
        medications.push(nextMed);
        changed = true;
      } else if (JSON.stringify(existingMed) !== JSON.stringify(nextMed)) {
        medications = medications.map((item) => (item.id === remote.id ? nextMed : item));
        changed = true;
      }

      const existingSchedule = schedules.find((item) => item.medicationId === remote.id);
      const scheduleId = existingSchedule?.id ?? createUuid();
      const nextSchedule = {
        id: scheduleId,
        medicationId: remote.id,
        times: remote.dose_times ?? [],
        timezone:
          remote.timezone ??
          (Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'),
        startDate: remote.start_date ?? new Date().toISOString().slice(0, 10),
        daysOfWeek: remote.days_of_week ?? undefined,
        createdAt: remote.created_at,
        updatedAt: remote.updated_at,
      };

      if (!existingSchedule) {
        schedules.push(nextSchedule);
        changed = true;
      } else if (JSON.stringify(existingSchedule) !== JSON.stringify(nextSchedule)) {
        schedules = schedules.map((item) =>
          item.medicationId === remote.id ? nextSchedule : item,
        );
        changed = true;
      }
    }
  }

  const localLogMap = new Map(doseLogs.map((log) => [log.id, log]));

  for (const remoteLog of remoteLogs) {
    if (remoteLog.deleted_at) {
      if (localLogMap.has(remoteLog.id)) {
        doseLogs = doseLogs.filter((log) => log.id !== remoteLog.id);
        changed = true;
      }
      continue;
    }

    const existing = localLogMap.get(remoteLog.id);
    const nextLog = {
      id: remoteLog.id,
      medicationId: remoteLog.medication_id,
      scheduledAt: remoteLog.scheduled_at,
      status: remoteLog.status,
      loggedAt: remoteLog.logged_at,
      updatedAt: remoteLog.updated_at,
      note: remoteLog.note ?? undefined,
    };

    if (!existing) {
      doseLogs.push(nextLog);
      changed = true;
      continue;
    }

    const localUpdated = toMillis(existing.updatedAt ?? existing.loggedAt);
    const remoteUpdated = toMillis(remoteLog.updated_at);

    if (remoteUpdated > localUpdated && JSON.stringify(existing) !== JSON.stringify(nextLog)) {
      doseLogs = doseLogs.map((log) => (log.id === remoteLog.id ? nextLog : log));
      changed = true;
    }
  }

  return {
    state: {
      medications,
      schedules,
      doseLogs,
    },
    changed,
  };
}

export function shouldPushLocalMedication(
  localState: AppState,
  remoteRow: CloudMedicationRow | undefined,
  medicationId: string,
): boolean {
  if (!remoteRow) {
    return true;
  }

  const localUpdated = localMedicationUpdatedAt(localState, medicationId);
  const remoteUpdated = toMillis(remoteRow.updated_at);
  return localUpdated > remoteUpdated;
}
