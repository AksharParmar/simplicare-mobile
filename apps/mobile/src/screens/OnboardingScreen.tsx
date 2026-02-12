import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.body}>Welcome to SimpliCare. Onboarding flow placeholder.</Text>
      <ScreenNavLinks current="Onboarding" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.body,
  },
});
