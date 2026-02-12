import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

export function CopilotScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Copilot</Text>
        <Text style={styles.body}>Source-grounded assistant placeholder.</Text>
      </View>
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
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: '#0f172a',
  },
  body: {
    fontSize: typography.body,
    color: '#475569',
  },
});
