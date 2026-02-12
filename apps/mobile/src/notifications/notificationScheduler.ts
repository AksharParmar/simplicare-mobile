import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { AppState } from '../storage/localStore';
import { loadPreferences } from '../storage/preferencesStore';
import { scopeKey, StorageScope } from '../storage/scope';

export const MEDICATION_NOTIFICATION_TAG = 'simplicare-medication-reminder';
const NOTIFICATION_IDS_PREFIX = 'simplicare_notifs__';

function notificationIdsKey(scope: StorageScope): string {
  return `${NOTIFICATION_IDS_PREFIX}${scopeKey(scope)}`;
}

async function loadScopedNotificationIds(scope: StorageScope): Promise<string[]> {
  const raw = await AsyncStorage.getItem(notificationIdsKey(scope));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveScopedNotificationIds(scope: StorageScope, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(notificationIdsKey(scope), JSON.stringify(ids));
}

async function clearScopedNotificationIds(scope: StorageScope): Promise<void> {
  await AsyncStorage.removeItem(notificationIdsKey(scope));
}

function parseHHMM(time: string): { hour: number; minute: number } | null {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hour = Number(hoursRaw);
  const minute = Number(minutesRaw);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function formatReminderBody(displayName: string, medName: string, strength?: string): string {
  const medLabel = strength ? `${medName} ${strength}` : medName;
  if (displayName.trim()) {
    return `Hi ${displayName.trim()}, time to take ${medLabel}.`;
  }

  return `Time to take ${medLabel}.`;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function configureNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync('medication-reminders', {
    name: 'Medication reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function cancelMedicationNotificationsForScope(scope: StorageScope): Promise<void> {
  const ids = await loadScopedNotificationIds(scope);

  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  await clearScopedNotificationIds(scope);
}

export async function cancelAllMedicationNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const keys = await AsyncStorage.getAllKeys();
  const scopedNotificationKeys = keys.filter((key) => key.startsWith(NOTIFICATION_IDS_PREFIX));
  if (scopedNotificationKeys.length > 0) {
    await AsyncStorage.multiRemove(scopedNotificationKeys);
  }
}

export async function scheduleMedicationNotificationsFromState(
  scope: StorageScope,
  state: AppState,
): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return;
  }

  const prefs = await loadPreferences();
  if (!prefs.remindersEnabled) {
    return;
  }

  const scheduledIds: string[] = [];
  const scopeValue = scopeKey(scope);

  for (const schedule of state.schedules) {
    const medication = state.medications.find((med) => med.id === schedule.medicationId);
    const medicationName = medication?.name ?? 'Medication';

    for (const time of schedule.times) {
      const parsed = parseHHMM(time);
      if (!parsed) {
        continue;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication reminder',
          body: formatReminderBody(prefs.displayName, medicationName, medication?.strength),
          data: {
            type: 'doseReminder',
            tag: MEDICATION_NOTIFICATION_TAG,
            scope: scopeValue,
            medicationId: schedule.medicationId,
            scheduleId: schedule.id,
            timeHHMM: time,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: 'medication-reminders',
        },
      });

      scheduledIds.push(id);
    }
  }

  await saveScopedNotificationIds(scope, scheduledIds);
}

export async function rescheduleAllMedicationNotifications(
  scope: StorageScope,
  state: AppState,
): Promise<void> {
  await cancelMedicationNotificationsForScope(scope);
  await scheduleMedicationNotificationsFromState(scope, state);
}

export async function switchNotificationScope(
  previousScope: StorageScope | null,
  nextScope: StorageScope,
  nextState: AppState,
): Promise<void> {
  if (previousScope) {
    await cancelMedicationNotificationsForScope(previousScope);
  }

  await rescheduleAllMedicationNotifications(nextScope, nextState);
}

export async function scheduleSnoozeNotification(input: {
  scope: StorageScope;
  medicationId: string;
  medicationName: string;
  strength?: string;
  scheduleId: string;
  originalTimeHHMM: string;
  snoozeMinutes?: 5 | 10 | 15;
}): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return;
  }

  const prefs = await loadPreferences();
  if (!prefs.remindersEnabled) {
    return;
  }

  const snoozeMinutes = input.snoozeMinutes ?? prefs.defaultSnoozeMinutes;
  const snoozedAt = new Date(Date.now() + snoozeMinutes * 60 * 1000);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Snoozed reminder',
      body: formatReminderBody(prefs.displayName, input.medicationName, input.strength),
      data: {
        type: 'doseSnooze',
        tag: MEDICATION_NOTIFICATION_TAG,
        scope: scopeKey(input.scope),
        medicationId: input.medicationId,
        scheduleId: input.scheduleId,
        originalTimeHHMM: input.originalTimeHHMM,
        snoozedUntilISO: snoozedAt.toISOString(),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: snoozedAt,
      channelId: 'medication-reminders',
    },
  });

  const existingIds = await loadScopedNotificationIds(input.scope);
  await saveScopedNotificationIds(input.scope, [...existingIds, id]);
}

export async function scheduleTestNotificationInOneMinute(): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return;
  }

  const date = new Date(Date.now() + 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SimpliCare test reminder',
      body: 'This is a one-minute test notification.',
      data: { type: 'testReminder', tag: MEDICATION_NOTIFICATION_TAG },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'medication-reminders',
    },
  });
}

export async function getScheduledNotificationCount(): Promise<number> {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.length;
}
