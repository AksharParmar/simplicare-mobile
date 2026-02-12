import { AppState, saveState } from '../storage/localStore';
import { getLastSyncedAt, setLastSyncedAt } from '../storage/syncPrefs';
import { scopeKey, StorageScope } from '../storage/scope';
import { enqueueOutboxEvent, incrementRetry, loadOutbox, removeOutboxEvent } from './outbox';
import { mergeRemoteIntoLocal, shouldPushLocalMedication } from './merge';
import {
  fetchAllMedicationLogs,
  fetchAllMedicationRows,
  fetchMedicationLogsSince,
  fetchMedicationRowsSince,
  logToCloudRow,
  medicationToCloudRow,
  softDeleteMedicationRow,
  upsertMedicationLogs,
  upsertMedicationRows,
} from './supabaseApi';

export type SyncStatus = 'idle' | 'syncing' | 'error';

function isUserScope(scope: StorageScope): scope is { kind: 'user'; userId: string } {
  return scope.kind === 'user';
}

function nowIso(): string {
  return new Date().toISOString();
}

function devLog(message: string, data?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (data !== undefined) {
    console.log(`[sync] ${message}`, data);
    return;
  }

  console.log(`[sync] ${message}`);
}

export async function queueMedicationUpsert(
  scope: StorageScope,
  input: {
    medication: AppState['medications'][number];
    schedules: AppState['schedules'];
  },
): Promise<void> {
  if (!isUserScope(scope)) {
    return;
  }

  const medicationSchedules = input.schedules.filter(
    (schedule) => schedule.medicationId === input.medication.id,
  );

  await enqueueOutboxEvent(scope, {
    type: 'UPSERT_MED',
    payload: {
      medication: input.medication,
      schedules: medicationSchedules,
      updatedAt: input.medication.updatedAt ?? nowIso(),
    },
  });
}

export async function queueMedicationDelete(scope: StorageScope, medicationId: string): Promise<void> {
  if (!isUserScope(scope)) {
    return;
  }

  await enqueueOutboxEvent(scope, {
    type: 'SOFT_DELETE_MED',
    payload: {
      medicationId,
      deletedAt: nowIso(),
    },
  });
}

export async function queueLogInsert(
  scope: StorageScope,
  log: AppState['doseLogs'][number],
): Promise<void> {
  if (!isUserScope(scope)) {
    return;
  }

  await enqueueOutboxEvent(scope, {
    type: 'INSERT_LOG',
    payload: {
      log,
    },
  });
}

export async function flushOutbox(scope: StorageScope): Promise<void> {
  if (!isUserScope(scope)) {
    return;
  }

  const events = await loadOutbox(scope);
  devLog(`flush start scope=${scopeKey(scope)} outbox=${events.length}`);

  for (const event of events) {
    try {
      if (event.type === 'UPSERT_MED') {
        const row = medicationToCloudRow({
          userId: scope.userId,
          medication: event.payload.medication,
          schedules: event.payload.schedules,
          updatedAt: event.payload.updatedAt,
        });
        await upsertMedicationRows([row]);
      } else if (event.type === 'SOFT_DELETE_MED') {
        await softDeleteMedicationRow({
          userId: scope.userId,
          medicationId: event.payload.medicationId,
          deletedAt: event.payload.deletedAt,
        });
      } else if (event.type === 'INSERT_LOG') {
        await upsertMedicationLogs([logToCloudRow(scope.userId, event.payload.log)]);
      }

      await removeOutboxEvent(scope, event.id);
    } catch (error) {
      await incrementRetry(scope, event.id);
      devLog(`flush failed event=${event.id} retry=${event.retryCount + 1}`);
      if (__DEV__ && error instanceof Error) {
        console.log('[sync] flush error message', error.message);
      }
      break;
    }
  }

  devLog(`flush end scope=${scopeKey(scope)}`);
}

async function pushMissingLocalData(
  scope: { kind: 'user'; userId: string },
  localState: AppState,
): Promise<void> {
  const remoteRows = await fetchAllMedicationRows(scope.userId);
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));

  const medicationRowsToPush = localState.medications
    .filter((medication) =>
      shouldPushLocalMedication(localState, remoteById.get(medication.id), medication.id),
    )
    .map((medication) =>
      medicationToCloudRow({
        userId: scope.userId,
        medication,
        schedules: localState.schedules.filter((schedule) => schedule.medicationId === medication.id),
        updatedAt: medication.updatedAt ?? nowIso(),
      }),
    );

  await upsertMedicationRows(medicationRowsToPush);

  const remoteLogs = await fetchAllMedicationLogs(scope.userId);
  const remoteLogIds = new Set(remoteLogs.map((log) => log.id));
  const logsToPush = localState.doseLogs
    .filter((log) => !remoteLogIds.has(log.id))
    .map((log) => logToCloudRow(scope.userId, log));

  await upsertMedicationLogs(logsToPush);
}

export async function performFullSync(input: {
  scope: StorageScope;
  localState: AppState;
}): Promise<{ nextState: AppState; syncedAt: string } | null> {
  if (!isUserScope(input.scope)) {
    return null;
  }

  devLog(`full sync start scope=${scopeKey(input.scope)}`);

  await flushOutbox(input.scope);
  await pushMissingLocalData(input.scope, input.localState);

  const remoteRows = await fetchAllMedicationRows(input.scope.userId);
  const remoteLogs = await fetchAllMedicationLogs(input.scope.userId);

  const merged = mergeRemoteIntoLocal(input.localState, remoteRows, remoteLogs);
  const syncedAt = nowIso();

  await saveState(input.scope, merged.state);
  await setLastSyncedAt(input.scope, syncedAt);

  devLog(`full sync end scope=${scopeKey(input.scope)}`);

  return {
    nextState: merged.state,
    syncedAt,
  };
}

export async function performIncrementalPull(input: {
  scope: StorageScope;
  localState: AppState;
}): Promise<{ nextState: AppState; syncedAt: string } | null> {
  if (!isUserScope(input.scope)) {
    return null;
  }

  const lastSyncedAt = await getLastSyncedAt(input.scope);
  if (!lastSyncedAt) {
    return performFullSync(input);
  }

  devLog(`incremental sync start scope=${scopeKey(input.scope)} since=${lastSyncedAt}`);

  await flushOutbox(input.scope);

  const remoteRows = await fetchMedicationRowsSince(input.scope.userId, lastSyncedAt);
  const remoteLogs = await fetchMedicationLogsSince(input.scope.userId, lastSyncedAt);

  const merged = mergeRemoteIntoLocal(input.localState, remoteRows, remoteLogs);

  await pushMissingLocalData(input.scope, merged.state);

  const syncedAt = nowIso();

  if (merged.changed) {
    await saveState(input.scope, merged.state);
  }
  await setLastSyncedAt(input.scope, syncedAt);

  devLog(`incremental sync end scope=${scopeKey(input.scope)} changed=${merged.changed}`);

  return {
    nextState: merged.state,
    syncedAt,
  };
}

export function canSyncScope(scope: StorageScope): boolean {
  return isUserScope(scope);
}

export function getScopeLabel(scope: StorageScope): string {
  return scopeKey(scope);
}
