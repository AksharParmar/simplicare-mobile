import AsyncStorage from '@react-native-async-storage/async-storage';

import { DoseLog, Medication, Schedule } from '../models';
import { GUEST_SCOPE, scopeKey, StorageScope } from './scope';

export type AppState = {
  medications: Medication[];
  schedules: Schedule[];
  doseLogs: DoseLog[];
};

export const LEGACY_STORE_KEY = 'simplicare_v1';
export const STORE_KEY_PREFIX = 'simplicare_v1__';
export const SCOPED_MIGRATION_FLAG_KEY = 'simplicare_migrated_v1_scoped';

const EMPTY_STATE: AppState = {
  medications: [],
  schedules: [],
  doseLogs: [],
};

function scopedStoreKey(scope: StorageScope): string {
  return `${STORE_KEY_PREFIX}${scopeKey(scope)}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function normalizeStateIds(state: AppState): { state: AppState; changed: boolean } {
  let changed = false;

  const medicationIdMap = new Map<string, string>();
  const normalizedMedications = state.medications.map((medication) => {
    if (isUuid(medication.id)) {
      medicationIdMap.set(medication.id, medication.id);
      return medication;
    }

    const nextId = createUuid();
    medicationIdMap.set(medication.id, nextId);
    changed = true;
    return {
      ...medication,
      id: nextId,
    };
  });

  const normalizedSchedules = state.schedules.map((schedule) => {
    const mappedMedicationId = medicationIdMap.get(schedule.medicationId) ?? schedule.medicationId;
    const nextId = isUuid(schedule.id) ? schedule.id : createUuid();

    if (mappedMedicationId !== schedule.medicationId || nextId !== schedule.id) {
      changed = true;
      return {
        ...schedule,
        id: nextId,
        medicationId: mappedMedicationId,
      };
    }

    return schedule;
  });

  const normalizedDoseLogs = state.doseLogs.map((log) => {
    const mappedMedicationId = medicationIdMap.get(log.medicationId) ?? log.medicationId;
    const nextId = isUuid(log.id) ? log.id : createUuid();

    if (mappedMedicationId !== log.medicationId || nextId !== log.id) {
      changed = true;
      return {
        ...log,
        id: nextId,
        medicationId: mappedMedicationId,
      };
    }

    return log;
  });

  return {
    state: {
      medications: normalizedMedications,
      schedules: normalizedSchedules,
      doseLogs: normalizedDoseLogs,
    },
    changed,
  };
}

function parseState(raw: string | null): AppState {
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const medications = (parsed.medications ?? []).map((medication) => ({
      ...medication,
      updatedAt: medication.updatedAt ?? medication.createdAt,
    }));
    const schedules = (parsed.schedules ?? []).map((schedule) => ({
      ...schedule,
      updatedAt: schedule.updatedAt ?? schedule.createdAt,
    }));
    const doseLogs = (parsed.doseLogs ?? []).map((log) => ({
      ...log,
      updatedAt: log.updatedAt ?? log.loggedAt,
    }));
    return {
      medications,
      schedules,
      doseLogs,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export async function migrateLegacyStoreToScoped(): Promise<void> {
  const migrated = await AsyncStorage.getItem(SCOPED_MIGRATION_FLAG_KEY);
  if (migrated === 'true') {
    return;
  }

  const legacy = await AsyncStorage.getItem(LEGACY_STORE_KEY);
  if (legacy) {
    const guestKey = scopedStoreKey(GUEST_SCOPE);
    const existingGuest = await AsyncStorage.getItem(guestKey);
    if (!existingGuest) {
      await AsyncStorage.setItem(guestKey, legacy);
    }

    await AsyncStorage.removeItem(LEGACY_STORE_KEY);
  }

  await AsyncStorage.setItem(SCOPED_MIGRATION_FLAG_KEY, 'true');
}

export async function loadState(scope: StorageScope): Promise<AppState> {
  await migrateLegacyStoreToScoped();
  const key = scopedStoreKey(scope);
  const raw = await AsyncStorage.getItem(key);
  const parsed = parseState(raw);
  const normalized = normalizeStateIds(parsed);

  if (normalized.changed) {
    await AsyncStorage.setItem(key, JSON.stringify(normalized.state));
  }

  return normalized.state;
}

export async function saveState(scope: StorageScope, state: AppState): Promise<void> {
  await AsyncStorage.setItem(scopedStoreKey(scope), JSON.stringify(state));
}

export async function clearState(scope: StorageScope): Promise<AppState> {
  await AsyncStorage.removeItem(scopedStoreKey(scope));
  return EMPTY_STATE;
}

export async function clearAllScopedData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const scopedKeys = keys.filter((key) => key.startsWith(STORE_KEY_PREFIX));
  if (scopedKeys.length > 0) {
    await AsyncStorage.multiRemove(scopedKeys);
  }

  await AsyncStorage.multiRemove([LEGACY_STORE_KEY, SCOPED_MIGRATION_FLAG_KEY]);
}

export async function seedIfEmpty(scope: StorageScope): Promise<AppState> {
  const state = await loadState(scope);
  const hasData =
    state.medications.length > 0 || state.schedules.length > 0 || state.doseLogs.length > 0;

  if (hasData) {
    return state;
  }

  await saveState(scope, EMPTY_STATE);
  return EMPTY_STATE;
}

export async function addMedication(scope: StorageScope, medication: Medication): Promise<AppState> {
  const state = await loadState(scope);
  const next = {
    ...state,
    medications: [...state.medications, medication],
  };
  await saveState(scope, next);
  return next;
}

export async function addSchedule(scope: StorageScope, schedule: Schedule): Promise<AppState> {
  const state = await loadState(scope);
  const next = {
    ...state,
    schedules: [...state.schedules, schedule],
  };
  await saveState(scope, next);
  return next;
}

export async function addDoseLog(scope: StorageScope, log: DoseLog): Promise<AppState> {
  const state = await loadState(scope);
  const next = {
    ...state,
    doseLogs: [...state.doseLogs, log],
  };
  await saveState(scope, next);
  return next;
}

export async function updateMedication(
  scope: StorageScope,
  id: string,
  patch: Partial<Omit<Medication, 'id' | 'createdAt'>>,
): Promise<AppState> {
  const state = await loadState(scope);
  const nextUpdatedAt = new Date().toISOString();
  const next = {
    ...state,
    medications: state.medications.map((medication) =>
      medication.id === id ? { ...medication, ...patch, updatedAt: nextUpdatedAt } : medication,
    ),
  };
  await saveState(scope, next);
  return next;
}

export async function updateSchedule(
  scope: StorageScope,
  id: string,
  patch: Partial<Omit<Schedule, 'id' | 'medicationId' | 'createdAt'>>,
): Promise<AppState> {
  const state = await loadState(scope);
  const nextUpdatedAt = new Date().toISOString();
  const next = {
    ...state,
    schedules: state.schedules.map((schedule) =>
      schedule.id === id ? { ...schedule, ...patch, updatedAt: nextUpdatedAt } : schedule,
    ),
  };
  await saveState(scope, next);
  return next;
}

export async function deleteMedication(scope: StorageScope, id: string): Promise<AppState> {
  const state = await loadState(scope);
  const next = {
    medications: state.medications.filter((medication) => medication.id !== id),
    schedules: state.schedules.filter((schedule) => schedule.medicationId !== id),
    doseLogs: state.doseLogs.filter((log) => log.medicationId !== id),
  };
  await saveState(scope, next);
  return next;
}

export async function deleteSchedule(scope: StorageScope, id: string): Promise<AppState> {
  const state = await loadState(scope);
  const next = {
    ...state,
    schedules: state.schedules.filter((schedule) => schedule.id !== id),
  };
  await saveState(scope, next);
  return next;
}

export function listMedications(state: AppState): Medication[] {
  return state.medications;
}

export function listSchedules(state: AppState): Schedule[] {
  return state.schedules;
}

export function listDoseLogs(state: AppState): DoseLog[] {
  return state.doseLogs;
}
