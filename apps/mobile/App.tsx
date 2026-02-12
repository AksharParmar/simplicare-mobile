import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddHubActionSheet } from './src/components/AddHubActionSheet';
import { WelcomeModal } from './src/components/WelcomeModal';
import { RootStackParamList, RootTabParamList } from './src/navigation/types';
import {
  DoseReminderPayload,
  addDoseReminderResponseListener,
  getInitialDoseReminderPayload,
} from './src/notifications/notificationHandlers';
import {
  configureNotificationChannel,
  requestNotificationPermissions,
} from './src/notifications/notificationScheduler';
import { ConfirmScannedMedicationScreen } from './src/screens/ConfirmScannedMedicationScreen';
import { CopilotScreen } from './src/screens/CopilotScreen';
import { EditMedicationScreen } from './src/screens/EditMedicationScreen';
import { ManualAddMedicationScreen } from './src/screens/ManualAddMedicationScreen';
import { MedicationDetailScreen } from './src/screens/MedicationDetailScreen';
import { MyMedicationsScreen } from './src/screens/MyMedicationsScreen';
import { ScanAddMedicationScreen } from './src/screens/ScanAddMedicationScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { AppStateProvider } from './src/state/AppStateContext';
import { PreferencesProvider } from './src/state/PreferencesContext';
import {
  hasSeenWelcomeModal,
  setHasSeenWelcomeModal,
} from './src/storage/welcomeModalStorage';
import { spacing, typography } from './src/theme/tokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AddHubPlaceholder() {
  return <View style={styles.placeholder} />;
}

function AddHubTabButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable style={styles.plusButtonWrap} onPress={onPress}>
      <View style={styles.plusButton}>
        <Text style={styles.plusText}>+</Text>
      </View>
    </Pressable>
  );
}

function TabsNavigator({ onOpenAddHub }: { onOpenAddHub: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Home" component={TodayScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen
        name="Medications"
        component={MyMedicationsScreen}
        options={{ tabBarLabel: 'Medications' }}
      />
      <Tab.Screen
        name="AddHub"
        component={AddHubPlaceholder}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <AddHubTabButton onPress={onOpenAddHub} />,
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            onOpenAddHub();
          },
        }}
      />
      <Tab.Screen name="Copilot" component={CopilotScreen} options={{ tabBarLabel: 'Copilot' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

function AppShell() {
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
  const [isAddHubVisible, setIsAddHubVisible] = useState(false);
  const [queuedReminder, setQueuedReminder] = useState<DoseReminderPayload | null>(null);

  const openDoseReminder = useCallback((payload: DoseReminderPayload) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Tabs', {
        screen: 'Home',
        params: {
          reminder: payload,
          openedAt: Date.now(),
        },
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
      navigationRef.navigate('ManualAddMedication');
    }
  }

  function handleOpenScan() {
    setIsAddHubVisible(false);
    navigationRef.navigate('ScanAddMedication');
  }

  function handleOpenManual() {
    setIsAddHubVisible(false);
    navigationRef.navigate('ManualAddMedication');
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (queuedReminder) {
            navigationRef.navigate('Tabs', {
              screen: 'Home',
              params: {
                reminder: queuedReminder,
                openedAt: Date.now(),
              },
            });
            setQueuedReminder(null);
          }
        }}
      >
        <StatusBar style="dark" />
        <Stack.Navigator>
          <Stack.Screen name="Tabs" options={{ headerShown: false }}>
            {() => <TabsNavigator onOpenAddHub={() => setIsAddHubVisible(true)} />}
          </Stack.Screen>
          <Stack.Screen
            name="ManualAddMedication"
            component={ManualAddMedicationScreen}
            options={{ title: 'Add Medication' }}
          />
          <Stack.Screen
            name="ScanAddMedication"
            component={ScanAddMedicationScreen}
            options={{ title: 'Scan Label' }}
          />
          <Stack.Screen
            name="ConfirmScannedMedication"
            component={ConfirmScannedMedicationScreen}
            options={{ title: 'Confirm Scan' }}
          />
          <Stack.Screen
            name="MedicationDetail"
            component={MedicationDetailScreen}
            options={{ title: 'Medication' }}
          />
          <Stack.Screen
            name="EditMedication"
            component={EditMedicationScreen}
            options={{ title: 'Edit Medication' }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      <AddHubActionSheet
        visible={isAddHubVisible}
        onClose={() => setIsAddHubVisible(false)}
        onScanLabel={handleOpenScan}
        onAddManual={handleOpenManual}
      />

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
    <SafeAreaProvider>
      <PreferencesProvider>
        <AppStateProvider>
          <AppShell />
        </AppStateProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  plusButtonWrap: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  plusText: {
    color: '#ffffff',
    fontSize: 34,
    marginTop: -2,
    fontWeight: '500',
  },
  tabBar: {
    height: 86,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  tabLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
});
