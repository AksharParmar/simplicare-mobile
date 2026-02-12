import * as Notifications from 'expo-notifications';

import { loadPreferences } from '../storage/preferencesStore';
import { AppState } from '../storage/localStore';

export const MEDICATION_NOTIFICATION_TAG = 'simplicare-medication-reminder';

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

export async function cancelAllMedicationNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleMedicationNotificationsFromState(state: AppState): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return;
  }

  const prefs = await loadPreferences();
  if (!prefs.remindersEnabled) {
    return;
  }

  for (const schedule of state.schedules) {
    const medication = state.medications.find((med) => med.id === schedule.medicationId);
    const medicationName = medication?.name ?? 'Medication';

    for (const time of schedule.times) {
      const parsed = parseHHMM(time);
      if (!parsed) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication reminder',
          body: formatReminderBody(prefs.displayName, medicationName, medication?.strength),
          data: {
            type: 'doseReminder',
            tag: MEDICATION_NOTIFICATION_TAG,
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
    }
  }
}

export async function rescheduleAllMedicationNotifications(state: AppState): Promise<void> {
  await cancelAllMedicationNotifications();
  await scheduleMedicationNotificationsFromState(state);
}

export async function scheduleSnoozeNotification(input: {
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

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Snoozed reminder',
      body: formatReminderBody(prefs.displayName, input.medicationName, input.strength),
      data: {
        type: 'doseSnooze',
        tag: MEDICATION_NOTIFICATION_TAG,
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
