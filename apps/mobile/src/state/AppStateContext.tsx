import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DoseLog, DoseLogStatus, Medication, Schedule } from '../models';
import { switchNotificationScope, rescheduleAllMedicationNotifications } from '../notifications/notificationScheduler';
import { useAuth } from './AuthContext';
import {
  addDoseLog as addDoseLogToStore,
  addMedication as addMedicationToStore,
  addSchedule as addScheduleToStore,
  AppState,
  clearState as clearStateInStore,
  deleteMedication as deleteMedicationInStore,
  deleteSchedule as deleteScheduleInStore,
  loadState,
  seedIfEmpty,
  updateMedication as updateMedicationInStore,
  updateSchedule as updateScheduleInStore,
} from '../storage/localStore';
import { scopeKey, StorageScope } from '../storage/scope';

type AddMedicationInput = Omit<Medication, 'id' | 'createdAt'>;
type AddScheduleInput = Omit<Schedule, 'id' | 'createdAt'>;
type UpdateMedicationInput = Partial<Omit<Medication, 'id' | 'createdAt'>>;
type UpdateScheduleInput = Partial<Omit<Schedule, 'id' | 'medicationId' | 'createdAt'>>;
type AddDoseLogInput = {
  medicationId: string;
  scheduledAt: string;
  status: DoseLogStatus;
  note?: string;
};

type AppStateContextValue = {
  state: AppState;
  isLoading: boolean;
  currentScope: StorageScope;
  currentScopeKey: string;
  refresh: () => Promise<void>;
  addMedication: (input: AddMedicationInput) => Promise<Medication>;
  addSchedule: (input: AddScheduleInput) => Promise<Schedule>;
  addDoseLog: (input: AddDoseLogInput) => Promise<void>;
  updateMedication: (id: string, patch: UpdateMedicationInput) => Promise<Medication | null>;
  updateSchedule: (id: string, patch: UpdateScheduleInput) => Promise<Schedule | null>;
  deleteMedication: (id: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  resetState: () => Promise<void>;
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
  const { activeScope } = useAuth();

  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const currentScopeRef = useRef<StorageScope>(activeScope);
  const previousScopeRef = useRef<StorageScope | null>(null);
  const scopeLoadVersionRef = useRef(0);

  const currentScopeKey = scopeKey(activeScope);

  const refresh = useCallback(async () => {
    const nextState = await loadState(currentScopeRef.current);
    setState(nextState);
  }, []);

  useEffect(() => {
    currentScopeRef.current = activeScope;
  }, [activeScope]);

  useEffect(() => {
    let cancelled = false;
    const loadVersion = ++scopeLoadVersionRef.current;

    async function bootstrapForScope() {
      setIsLoading(true);
      setState(EMPTY_STATE);

      const seeded = await seedIfEmpty(activeScope);

      if (cancelled || loadVersion !== scopeLoadVersionRef.current) {
        return;
      }

      await switchNotificationScope(previousScopeRef.current, activeScope, seeded);

      if (cancelled || loadVersion !== scopeLoadVersionRef.current) {
        return;
      }

      setState(seeded);
      setIsLoading(false);
      previousScopeRef.current = activeScope;
    }

    void bootstrapForScope();

    return () => {
      cancelled = true;
    };
  }, [activeScope]);

  const addMedication = useCallback(async (input: AddMedicationInput) => {
    const medication: Medication = {
      id: createId('med'),
      name: input.name,
      strength: input.strength,
      instructions: input.instructions,
      scanText: input.scanText,
      scanSource: input.scanSource,
      scanCapturedAt: input.scanCapturedAt,
      createdAt: new Date().toISOString(),
    };

    const scope = currentScopeRef.current;
    const next = await addMedicationToStore(scope, medication);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
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

    const scope = currentScopeRef.current;
    const next = await addScheduleToStore(scope, schedule);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
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

    const scope = currentScopeRef.current;
    const next = await addDoseLogToStore(scope, log);
    setState(next);
  }, []);

  const updateMedication = useCallback(async (id: string, patch: UpdateMedicationInput) => {
    const scope = currentScopeRef.current;
    const next = await updateMedicationInStore(scope, id, patch);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
    return next.medications.find((medication) => medication.id === id) ?? null;
  }, []);

  const updateSchedule = useCallback(async (id: string, patch: UpdateScheduleInput) => {
    const scope = currentScopeRef.current;
    const next = await updateScheduleInStore(scope, id, patch);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
    return next.schedules.find((schedule) => schedule.id === id) ?? null;
  }, []);

  const deleteMedication = useCallback(async (id: string) => {
    const scope = currentScopeRef.current;
    const next = await deleteMedicationInStore(scope, id);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    const scope = currentScopeRef.current;
    const next = await deleteScheduleInStore(scope, id);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
  }, []);

  const resetState = useCallback(async () => {
    const scope = currentScopeRef.current;
    const next = await clearStateInStore(scope);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);
  }, []);

  const value = useMemo(
    () => ({
      state,
      isLoading,
      currentScope: activeScope,
      currentScopeKey,
      refresh,
      addMedication,
      addSchedule,
      addDoseLog,
      updateMedication,
      updateSchedule,
      deleteMedication,
      deleteSchedule,
      resetState,
    }),
    [
      state,
      isLoading,
      activeScope,
      currentScopeKey,
      refresh,
      addMedication,
      addSchedule,
      addDoseLog,
      updateMedication,
      updateSchedule,
      deleteMedication,
      deleteSchedule,
      resetState,
    ],
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
