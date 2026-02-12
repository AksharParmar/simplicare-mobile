import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '../theme/tokens';

export function AddMedicationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Medication</Text>
      <Text style={styles.body}>Use the center plus button from tabs to add medication.</Text>
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
