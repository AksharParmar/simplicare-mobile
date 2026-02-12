import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '../theme/tokens';

export function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.body}>Welcome flow has moved to the welcome modal.</Text>
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
