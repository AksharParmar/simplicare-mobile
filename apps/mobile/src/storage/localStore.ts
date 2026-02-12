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

function parseState(raw: string | null): AppState {
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      medications: parsed.medications ?? [],
      schedules: parsed.schedules ?? [],
      doseLogs: parsed.doseLogs ?? [],
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
  const raw = await AsyncStorage.getItem(scopedStoreKey(scope));
  return parseState(raw);
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
  const next = {
    ...state,
    medications: state.medications.map((medication) =>
      medication.id === id ? { ...medication, ...patch } : medication,
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
  const next = {
    ...state,
    schedules: state.schedules.map((schedule) =>
      schedule.id === id ? { ...schedule, ...patch } : schedule,
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
