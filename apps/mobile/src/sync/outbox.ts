import AsyncStorage from '@react-native-async-storage/async-storage';

import { DoseLog, Medication, Schedule } from '../models';
import { scopeKey, StorageScope } from '../storage/scope';

const OUTBOX_PREFIX = 'simplicare_outbox__';

export type OutboxEvent =
  | {
      id: string;
      type: 'UPSERT_MED';
      payload: {
        medication: Medication;
        schedules: Schedule[];
        updatedAt: string;
      };
      createdAt: string;
      retryCount: number;
    }
  | {
      id: string;
      type: 'SOFT_DELETE_MED';
      payload: {
        medicationId: string;
        deletedAt: string;
      };
      createdAt: string;
      retryCount: number;
    }
  | {
      id: string;
      type: 'INSERT_LOG';
      payload: {
        log: DoseLog;
      };
      createdAt: string;
      retryCount: number;
    };

function outboxKey(scope: StorageScope): string {
  return `${OUTBOX_PREFIX}${scopeKey(scope)}`;
}

function makeEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadOutbox(scope: StorageScope): Promise<OutboxEvent[]> {
  const raw = await AsyncStorage.getItem(outboxKey(scope));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OutboxEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOutbox(scope: StorageScope, events: OutboxEvent[]): Promise<void> {
  await AsyncStorage.setItem(outboxKey(scope), JSON.stringify(events));
}

export async function enqueueOutboxEvent(
  scope: StorageScope,
  event: Omit<OutboxEvent, 'id' | 'createdAt' | 'retryCount'>,
): Promise<void> {
  const existing = await loadOutbox(scope);
  const next = {
    ...(event as OutboxEvent),
    id: makeEventId(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  } as OutboxEvent;
  await saveOutbox(scope, [...existing, next]);
}

export async function incrementRetry(scope: StorageScope, eventId: string): Promise<void> {
  const existing = await loadOutbox(scope);
  const next = existing.map((event) =>
    event.id === eventId ? { ...event, retryCount: event.retryCount + 1 } : event,
  );
  await saveOutbox(scope, next);
}

export async function removeOutboxEvent(scope: StorageScope, eventId: string): Promise<void> {
  const existing = await loadOutbox(scope);
  const next = existing.filter((event) => event.id !== eventId);
  await saveOutbox(scope, next);
}

export async function clearOutbox(scope: StorageScope): Promise<void> {
  await AsyncStorage.removeItem(outboxKey(scope));
}
