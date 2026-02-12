import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DoseLog, DoseLogStatus, Medication, Schedule } from '../models';
import { rescheduleAllMedicationNotifications } from '../notifications/notificationScheduler';
import {
  addDoseLog as addDoseLogToStore,
  addMedication as addMedicationToStore,
  addSchedule as addScheduleToStore,
  AppState,
  loadState,
  seedIfEmpty,
} from '../storage/localStore';

type AddMedicationInput = Omit<Medication, 'id' | 'createdAt'>;
type AddScheduleInput = Omit<Schedule, 'id' | 'createdAt'>;
type AddDoseLogInput = {
  medicationId: string;
  scheduledAt: string;
  status: DoseLogStatus;
  note?: string;
};

type AppStateContextValue = {
  state: AppState;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addMedication: (input: AddMedicationInput) => Promise<Medication>;
  addSchedule: (input: AddScheduleInput) => Promise<Schedule>;
  addDoseLog: (input: AddDoseLogInput) => Promise<void>;
};

const EMPTY_STATE: AppState = {
  medications: [],
  schedules: [],
  doseLogs: [],
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const nextState = await loadState();
    setState(nextState);
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const seeded = await seedIfEmpty();
      setState(seeded);
      await rescheduleAllMedicationNotifications(seeded);
      setIsLoading(false);
    }

    void bootstrap();
  }, []);

  const addMedication = useCallback(async (input: AddMedicationInput) => {
    const medication: Medication = {
      id: createId('med'),
      name: input.name,
      strength: input.strength,
      instructions: input.instructions,
      createdAt: new Date().toISOString(),
    };

    const next = await addMedicationToStore(medication);
    setState(next);
    await rescheduleAllMedicationNotifications(next);
    return medication;
  }, []);

  const addSchedule = useCallback(async (input: AddScheduleInput) => {
    const schedule: Schedule = {
      id: createId('sch'),
      medicationId: input.medicationId,
      times: input.times,
      timezone: input.timezone,
      startDate: input.startDate,
      daysOfWeek: input.daysOfWeek,
      createdAt: new Date().toISOString(),
    };

    const next = await addScheduleToStore(schedule);
    setState(next);
    await rescheduleAllMedicationNotifications(next);
    return schedule;
  }, []);

  const addDoseLog = useCallback(async (input: AddDoseLogInput) => {
    const log: DoseLog = {
      id: createId('log'),
      medicationId: input.medicationId,
      scheduledAt: input.scheduledAt,
      status: input.status,
      loggedAt: new Date().toISOString(),
      note: input.note,
    };

    const next = await addDoseLogToStore(log);
    setState(next);
  }, []);

  const value = useMemo(
    () => ({
      state,
      isLoading,
      refresh,
      addMedication,
      addSchedule,
      addDoseLog,
    }),
    [state, isLoading, refresh, addMedication, addSchedule, addDoseLog],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}
