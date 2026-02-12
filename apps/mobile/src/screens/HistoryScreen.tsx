import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const { state, isLoading } = useAppState();

  const medicationNameById = useMemo(() => {
    const map = new Map<string, string>();
    state.medications.forEach((medication) => {
      map.set(medication.id, medication.name);
    });
    return map;
  }, [state.medications]);

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

      {!isLoading && logs.length === 0 ? (
        <Text style={styles.empty}>No dose logs yet.</Text>
      ) : null}

      {!isLoading
        ? logs.map((log) => (
            <View key={log.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {medicationNameById.get(log.medicationId) ?? 'Unknown medication'}
              </Text>
              <Text style={styles.cardStatus}>Status: {log.status}</Text>
              <Text style={styles.cardDate}>
                Scheduled: {new Date(log.scheduledAt).toLocaleString()}
              </Text>
            </View>
          ))
        : null}

      <ScreenNavLinks current="History" navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.subtitle,
    marginBottom: spacing.md,
  },
  loader: {
    marginBottom: spacing.md,
  },
  empty: {
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  cardStatus: {
    fontSize: typography.body,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: typography.caption,
    color: '#666666',
  },
});
