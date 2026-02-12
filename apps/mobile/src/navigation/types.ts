import { NavigatorScreenParams } from '@react-navigation/native';

import { DoseReminderPayload } from '../notifications/notificationHandlers';

export type HomeRouteParams =
  | {
      reminder?: DoseReminderPayload;
      openedAt?: number;
      flashMessage?: string;
    }
  | undefined;

export type MedicationsRouteParams =
  | {
      flashMessage?: string;
      openedAt?: number;
    }
  | undefined;

export type RootTabParamList = {
  Home: HomeRouteParams;
  Medications: MedicationsRouteParams;
  AddHub: undefined;
  Copilot: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  ManualAddMedication: undefined;
  ScanAddMedication: undefined;
  ConfirmScannedMedication: {
    imageUri?: string;
    rawText: string;
    ocrError?: string;
  };
  MedicationDetail: {
    medicationId: string;
  };
  EditMedication: {
    medicationId: string;
  };
};
