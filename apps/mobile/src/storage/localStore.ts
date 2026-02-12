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

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDeviceTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone || 'America/New_York';
}

function buildSeedState(): AppState {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const timezone = getDeviceTimezone();

  const medications: Medication[] = [
    {
      id: createId('med'),
      name: 'Lisinopril',
      strength: '10 mg',
      instructions: 'Take with water.',
      createdAt: nowIso,
    },
    {
      id: createId('med'),
      name: 'Metformin',
      strength: '500 mg',
      instructions: 'Take with food.',
      createdAt: nowIso,
    },
  ];

  const schedules: Schedule[] = [
    {
      id: createId('sch'),
      medicationId: medications[0].id,
      times: ['08:00', '20:00'],
      timezone,
      startDate: today,
      createdAt: nowIso,
    },
    {
      id: createId('sch'),
      medicationId: medications[1].id,
      times: ['09:00', '21:00'],
      timezone,
      startDate: today,
      createdAt: nowIso,
    },
  ];

  return {
    medications,
    schedules,
    doseLogs: [],
  };
}

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

  const seeded = buildSeedState();
  await saveState(seeded);
  return seeded;
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
