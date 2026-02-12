import AsyncStorage from '@react-native-async-storage/async-storage';

import { DoseLog, Medication, Schedule } from '../models';

export type AppState = {
  medications: Medication[];
  schedules: Schedule[];
  doseLogs: DoseLog[];
};

const STORE_KEY = 'simplicare_v1';

const EMPTY_STATE: AppState = {
  medications: [],
  schedules: [],
  doseLogs: [],
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
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

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export async function seedIfEmpty(): Promise<AppState> {
  const state = await loadState();
  const hasData =
    state.medications.length > 0 || state.schedules.length > 0 || state.doseLogs.length > 0;

  if (hasData) {
    return state;
  }

  await saveState(EMPTY_STATE);
  return EMPTY_STATE;
}

export async function addMedication(medication: Medication): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    medications: [...state.medications, medication],
  };
  await saveState(next);
  return next;
}

export async function addSchedule(schedule: Schedule): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    schedules: [...state.schedules, schedule],
  };
  await saveState(next);
  return next;
}

export async function addDoseLog(log: DoseLog): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    doseLogs: [...state.doseLogs, log],
  };
  await saveState(next);
  return next;
}

export async function updateMedication(
  id: string,
  patch: Partial<Omit<Medication, 'id' | 'createdAt'>>,
): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    medications: state.medications.map((medication) =>
      medication.id === id ? { ...medication, ...patch } : medication,
    ),
  };
  await saveState(next);
  return next;
}

export async function updateSchedule(
  id: string,
  patch: Partial<Omit<Schedule, 'id' | 'medicationId' | 'createdAt'>>,
): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    schedules: state.schedules.map((schedule) =>
      schedule.id === id ? { ...schedule, ...patch } : schedule,
    ),
  };
  await saveState(next);
  return next;
}

export async function deleteMedication(id: string): Promise<AppState> {
  const state = await loadState();
  const next = {
    medications: state.medications.filter((medication) => medication.id !== id),
    schedules: state.schedules.filter((schedule) => schedule.medicationId !== id),
    doseLogs: state.doseLogs.filter((log) => log.medicationId !== id),
  };
  await saveState(next);
  return next;
}

export async function deleteSchedule(id: string): Promise<AppState> {
  const state = await loadState();
  const next = {
    ...state,
    schedules: state.schedules.filter((schedule) => schedule.id !== id),
  };
  await saveState(next);
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
