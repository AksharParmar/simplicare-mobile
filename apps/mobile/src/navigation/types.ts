import { DoseReminderPayload } from '../notifications/notificationHandlers';

export type RootStackParamList = {
  Today:
    | {
        reminder?: DoseReminderPayload;
        openedAt?: number;
      }
    | undefined;
  AddMedication: undefined;
  Copilot: undefined;
  History: undefined;
  Settings: undefined;
};

export type ScreenName = keyof RootStackParamList;
