import { NavigatorScreenParams } from '@react-navigation/native';

import { DoseReminderPayload } from '../notifications/notificationHandlers';

export type HomeRouteParams =
  | {
      reminder?: DoseReminderPayload;
      openedAt?: number;
      flashMessage?: string;
    }
  | undefined;

export type RootTabParamList = {
  Home: HomeRouteParams;
  History: undefined;
  AddHub: undefined;
  Copilot: undefined;
  Settings: undefined;
};

export type ScreenName = keyof RootTabParamList;

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  ManualAddMedication: undefined;
  ScanAddMedication: undefined;
  ConfirmScannedMedication: {
    imageUri?: string;
    rawText: string;
    ocrError?: string;
  };
};
