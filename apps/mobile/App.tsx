import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';

import { DoseReminderPayload, addDoseReminderResponseListener, getInitialDoseReminderPayload } from './src/notifications/notificationHandlers';
import { configureNotificationChannel, requestNotificationPermissions } from './src/notifications/notificationScheduler';
import { RootStackParamList } from './src/navigation/types';
import { AddMedicationScreen } from './src/screens/AddMedicationScreen';
import { CopilotScreen } from './src/screens/CopilotScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { AppStateProvider } from './src/state/AppStateContext';
import { hasSeenWelcomeModal, setHasSeenWelcomeModal } from './src/storage/welcomeModalStorage';
import { WelcomeModal } from './src/components/WelcomeModal';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppShell() {
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
  const [queuedReminder, setQueuedReminder] = useState<DoseReminderPayload | null>(null);

  const openDoseReminder = useCallback((payload: DoseReminderPayload) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Today', {
        reminder: payload,
        openedAt: Date.now(),
      });
      return;
    }

    setQueuedReminder(payload);
  }, []);

  useEffect(() => {
    async function setupNotifications() {
      await configureNotificationChannel();
      await requestNotificationPermissions();
    }

    void setupNotifications();
  }, []);

  useEffect(() => {
    async function checkWelcomeModal() {
      const seen = await hasSeenWelcomeModal();
      if (!seen) {
        setIsWelcomeVisible(true);
      }
    }

    void checkWelcomeModal();
  }, []);

  useEffect(() => {
    const subscription = addDoseReminderResponseListener(openDoseReminder);

    async function handleInitialResponse() {
      const payload = await getInitialDoseReminderPayload();
      if (payload) {
        openDoseReminder(payload);
      }
    }

    void handleInitialResponse();

    return () => {
      subscription.remove();
    };
  }, [openDoseReminder]);

  async function handleGetStarted() {
    await setHasSeenWelcomeModal(true);
    setIsWelcomeVisible(false);
  }

  async function handleAddMedicationFromWelcome() {
    await setHasSeenWelcomeModal(true);
    setIsWelcomeVisible(false);

    if (navigationRef.isReady()) {
      navigationRef.navigate('AddMedication');
    }
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (queuedReminder) {
            navigationRef.navigate('Today', {
              reminder: queuedReminder,
              openedAt: Date.now(),
            });
            setQueuedReminder(null);
          }
        }}
      >
        <StatusBar style="dark" />
        <Stack.Navigator initialRouteName="Today">
          <Stack.Screen name="Today" component={TodayScreen} />
          <Stack.Screen
            name="AddMedication"
            component={AddMedicationScreen}
            options={{ title: 'Add Medication' }}
          />
          <Stack.Screen name="Copilot" component={CopilotScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      <WelcomeModal
        visible={isWelcomeVisible}
        onGetStarted={() => void handleGetStarted()}
        onAddMedication={() => void handleAddMedicationFromWelcome()}
      />
    </>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
