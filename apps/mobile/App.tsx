import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { RootStackParamList } from './src/navigation/types';
import { AddMedicationScreen } from './src/screens/AddMedicationScreen';
import { CopilotScreen } from './src/screens/CopilotScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { AppStateProvider } from './src/state/AppStateContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AppStateProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Onboarding">
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen
            name="AddMedication"
            component={AddMedicationScreen}
            options={{ title: 'Add Medication' }}
          />
          <Stack.Screen name="Today" component={TodayScreen} />
          <Stack.Screen name="Copilot" component={CopilotScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppStateProvider>
  );
}
