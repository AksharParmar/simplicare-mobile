import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';

export function HistoryScreen() {
  const { state, isLoading } = useAppState();

  const medicationNameById = useMemo(
    () => new Map(state.medications.map((medication) => [medication.id, medication.name])),
    [state.medications],
  );

  const logs = useMemo(
    () =>
      [...state.doseLogs].sort(
        (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
      ),
    [state.doseLogs],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Dose logs</Text>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && logs.length === 0 ? <Text style={styles.empty}>No dose logs yet.</Text> : null}

      {!isLoading
        ? logs.map((log) => (
            <View key={log.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {medicationNameById.get(log.medicationId) ?? 'Unknown medication'}
              </Text>
              <Text style={styles.cardStatus}>Status: {log.status}</Text>
              <Text style={styles.cardDate}>Scheduled: {new Date(log.scheduledAt).toLocaleString()}</Text>
            </View>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.subtitle,
    color: '#334155',
    marginBottom: spacing.md,
  },
  loader: {
    marginBottom: spacing.md,
  },
  empty: {
    fontSize: typography.body,
    marginBottom: spacing.md,
    color: '#64748b',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: '#0f172a',
  },
  cardStatus: {
    fontSize: typography.body,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
    color: '#1e293b',
  },
  cardDate: {
    fontSize: typography.caption,
    color: '#64748b',
  },
});
