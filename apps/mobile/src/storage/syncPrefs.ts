import AsyncStorage from '@react-native-async-storage/async-storage';

import { scopeKey, StorageScope } from './scope';

const LAST_SYNCED_PREFIX = 'simplicare_lastSyncedAt__';

function lastSyncedKey(scope: StorageScope): string {
  return `${LAST_SYNCED_PREFIX}${scopeKey(scope)}`;
}

export async function getLastSyncedAt(scope: StorageScope): Promise<string | null> {
  return await AsyncStorage.getItem(lastSyncedKey(scope));
}

export async function setLastSyncedAt(scope: StorageScope, iso: string): Promise<void> {
  await AsyncStorage.setItem(lastSyncedKey(scope), iso);
}

export async function clearSyncPrefs(scope: StorageScope): Promise<void> {
  await AsyncStorage.removeItem(lastSyncedKey(scope));
}
