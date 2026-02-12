import * as Notifications from 'expo-notifications';

export type DoseReminderPayload = {
  type: 'doseReminder';
  medicationId: string;
  scheduleId: string;
  timeHHMM: string;
};

function toDoseReminderPayload(data: unknown): DoseReminderPayload | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  if (
    candidate.type === 'doseReminder' &&
    typeof candidate.medicationId === 'string' &&
    typeof candidate.scheduleId === 'string' &&
    typeof candidate.timeHHMM === 'string'
  ) {
    return {
      type: 'doseReminder',
      medicationId: candidate.medicationId,
      scheduleId: candidate.scheduleId,
      timeHHMM: candidate.timeHHMM,
    };
  }

  return null;
}

export function addDoseReminderResponseListener(
  onDoseReminder: (payload: DoseReminderPayload) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = toDoseReminderPayload(response.notification.request.content.data);
    if (payload) {
      onDoseReminder(payload);
    }
  });
}

export async function getInitialDoseReminderPayload(): Promise<DoseReminderPayload | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return null;
  }

  return toDoseReminderPayload(response.notification.request.content.data);
}
