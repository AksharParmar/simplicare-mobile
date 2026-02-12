import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import { resetWelcomeModalFlag } from '../storage/welcomeModalStorage';
import { radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  async function handleResetWelcomeModal() {
    await resetWelcomeModalFlag();
    Alert.alert('Welcome modal reset', 'It will appear again the next time the app starts.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>Privacy and app preferences placeholder.</Text>

      <Pressable style={styles.button} onPress={() => void handleResetWelcomeModal()}>
        <Text style={styles.buttonText}>Reset welcome modal</Text>
      </Pressable>

      <ScreenNavLinks current="Settings" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: '#0f172a',
  },
  body: {
    fontSize: typography.body,
    marginBottom: spacing.md,
    color: '#475569',
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#334155',
  },
});
