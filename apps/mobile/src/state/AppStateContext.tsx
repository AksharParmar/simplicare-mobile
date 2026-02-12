import { AppState as RNAppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DoseLog, DoseLogStatus, Medication, Schedule } from '../models';
import {
  rescheduleAllMedicationNotifications,
  switchNotificationScope,
} from '../notifications/notificationScheduler';
import {
  canSyncScope,
  performFullSync,
  performIncrementalPull,
  queueLogInsert,
  queueMedicationDelete,
  queueMedicationUpsert,
  SyncStatus,
} from '../sync/syncEngine';
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
import { getLastSyncedAt } from '../storage/syncPrefs';
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
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  retrySync: () => Promise<void>;
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

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { activeScope, session, isGuest } = useAuth();

  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);

  const currentScopeRef = useRef<StorageScope>(activeScope);
  const previousScopeRef = useRef<StorageScope | null>(null);
  const scopeLoadVersionRef = useRef(0);
  const syncInFlightRef = useRef(false);

  const currentScopeKey = scopeKey(activeScope);

  const runSync = useCallback(
    async (options: { forceFull?: boolean; localState?: AppState } = {}) => {
      const scope = currentScopeRef.current;
      if (!canSyncScope(scope) || syncInFlightRef.current || !session || isGuest) {
        return;
      }

      syncInFlightRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const baseState = options.localState ?? (await loadState(scope));

        const result = options.forceFull
          ? await performFullSync({ scope, localState: baseState })
          : await performIncrementalPull({ scope, localState: baseState });

        if (result) {
          setState(result.nextState);
          setLastSyncedAtState(result.syncedAt);
          await rescheduleAllMedicationNotifications(scope, result.nextState);
        }

        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Sync failed.');
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [session, isGuest],
  );

  const refresh = useCallback(async () => {
    const nextState = await loadState(currentScopeRef.current);
    setState(nextState);

    void runSync({ localState: nextState });
  }, [runSync]);

  useEffect(() => {
    currentScopeRef.current = activeScope;
  }, [activeScope]);

  useEffect(() => {
    let cancelled = false;
    const loadVersion = ++scopeLoadVersionRef.current;

    async function bootstrapForScope() {
      setIsLoading(true);
      setState(EMPTY_STATE);
      setLastSyncedAtState(null);

      const seeded = await seedIfEmpty(activeScope);

      if (cancelled || loadVersion !== scopeLoadVersionRef.current) {
        return;
      }

      await switchNotificationScope(previousScopeRef.current, activeScope, seeded);

      if (cancelled || loadVersion !== scopeLoadVersionRef.current) {
        return;
      }

      let nextState = seeded;
      if (canSyncScope(activeScope) && session && !isGuest) {
        try {
          setSyncStatus('syncing');
          const result = await performFullSync({ scope: activeScope, localState: seeded });
          if (result) {
            nextState = result.nextState;
            setLastSyncedAtState(result.syncedAt);
          }
          setSyncStatus('idle');
          setSyncError(null);
        } catch (error) {
          setSyncStatus('error');
          setSyncError(error instanceof Error ? error.message : 'Sync failed.');
        }
      } else {
        setSyncStatus('idle');
        setSyncError(null);
      }

      const knownLastSynced = await getLastSyncedAt(activeScope);
      setLastSyncedAtState((prev) => prev ?? knownLastSynced);

      await rescheduleAllMedicationNotifications(activeScope, nextState);

      if (cancelled || loadVersion !== scopeLoadVersionRef.current) {
        return;
      }

      setState(nextState);
      setIsLoading(false);
      previousScopeRef.current = activeScope;
    }

    void bootstrapForScope();

    return () => {
      cancelled = true;
    };
  }, [activeScope, session, isGuest]);

  useEffect(() => {
    if (!canSyncScope(activeScope) || !session || isGuest) {
      return;
    }

    const interval = setInterval(() => {
      void runSync();
    }, 45000);

    const appStateSubscription = RNAppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runSync();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [activeScope, session, isGuest, runSync]);

  const retrySync = useCallback(async () => {
    await runSync({ forceFull: true });
  }, [runSync]);

  const addMedication = useCallback(async (input: AddMedicationInput) => {
    const now = new Date().toISOString();
    const medication: Medication = {
      id: createId(),
      name: input.name,
      strength: input.strength,
      instructions: input.instructions,
      scanText: input.scanText,
      scanSource: input.scanSource,
      scanCapturedAt: input.scanCapturedAt,
      createdAt: now,
      updatedAt: now,
    };

    const scope = currentScopeRef.current;
    const next = await addMedicationToStore(scope, medication);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    await queueMedicationUpsert(scope, {
      medication,
      schedules: next.schedules,
    });

    void runSync({ localState: next });

    return medication;
  }, [runSync]);

  const addSchedule = useCallback(async (input: AddScheduleInput) => {
    const now = new Date().toISOString();
    const schedule: Schedule = {
      id: createId(),
      medicationId: input.medicationId,
      times: input.times,
      timezone: input.timezone,
      startDate: input.startDate,
      daysOfWeek: input.daysOfWeek,
      createdAt: now,
      updatedAt: now,
    };

    const scope = currentScopeRef.current;
    const next = await addScheduleToStore(scope, schedule);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    const medication = next.medications.find((item) => item.id === input.medicationId);
    if (medication) {
      await queueMedicationUpsert(scope, {
        medication: { ...medication, updatedAt: now },
        schedules: next.schedules,
      });
    }

    void runSync({ localState: next });

    return schedule;
  }, [runSync]);

  const addDoseLog = useCallback(async (input: AddDoseLogInput) => {
    const now = new Date().toISOString();
    const log: DoseLog = {
      id: createId(),
      medicationId: input.medicationId,
      scheduledAt: input.scheduledAt,
      status: input.status,
      loggedAt: now,
      updatedAt: now,
      note: input.note,
    };

    const scope = currentScopeRef.current;
    const next = await addDoseLogToStore(scope, log);
    setState(next);

    await queueLogInsert(scope, log);
    void runSync({ localState: next });
  }, [runSync]);

  const updateMedication = useCallback(async (id: string, patch: UpdateMedicationInput) => {
    const scope = currentScopeRef.current;
    const next = await updateMedicationInStore(scope, id, patch);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    const medication = next.medications.find((item) => item.id === id);
    if (medication) {
      await queueMedicationUpsert(scope, {
        medication,
        schedules: next.schedules,
      });
    }

    void runSync({ localState: next });

    return medication ?? null;
  }, [runSync]);

  const updateSchedule = useCallback(async (id: string, patch: UpdateScheduleInput) => {
    const scope = currentScopeRef.current;
    const next = await updateScheduleInStore(scope, id, patch);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    const schedule = next.schedules.find((item) => item.id === id) ?? null;
    if (schedule) {
      const medication = next.medications.find((item) => item.id === schedule.medicationId);
      if (medication) {
        await queueMedicationUpsert(scope, {
          medication,
          schedules: next.schedules,
        });
      }
    }

    void runSync({ localState: next });

    return schedule;
  }, [runSync]);

  const deleteMedication = useCallback(async (id: string) => {
    const scope = currentScopeRef.current;
    const next = await deleteMedicationInStore(scope, id);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    await queueMedicationDelete(scope, id);
    void runSync({ localState: next });
  }, [runSync]);

  const deleteSchedule = useCallback(async (id: string) => {
    const scope = currentScopeRef.current;
    const before = await loadState(scope);
    const deletingSchedule = before.schedules.find((item) => item.id === id);

    const next = await deleteScheduleInStore(scope, id);
    setState(next);
    await rescheduleAllMedicationNotifications(scope, next);

    if (deletingSchedule) {
      const medication = next.medications.find((item) => item.id === deletingSchedule.medicationId);
      if (medication) {
        await queueMedicationUpsert(scope, {
          medication,
          schedules: next.schedules,
        });
      }
    }

    void runSync({ localState: next });
  }, [runSync]);

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
      syncStatus,
      syncError,
      lastSyncedAt,
      retrySync,
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
      syncStatus,
      syncError,
      lastSyncedAt,
      retrySync,
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
