import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatHHMMTo12Hour, formatISOTo12Hour } from '../utils/timeFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationDetail'>;

export function MedicationDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { medicationId } = route.params;
  const { state, deleteMedication } = useAppState();

  const medication = state.medications.find((item) => item.id === medicationId);
  const schedules = state.schedules.filter((schedule) => schedule.medicationId === medicationId);
  const logs = [...state.doseLogs]
    .filter((log) => log.medicationId === medicationId)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  if (!medication) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Medication not found.</Text>
      </View>
    );
  }

  const currentMedication = medication;

  function confirmDelete() {
    Alert.alert('Delete medication?', 'This removes the medication, schedules, and related logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteMedication(currentMedication.id);
          navigation.navigate('Tabs', {
            screen: 'Medications',
            params: { flashMessage: `${currentMedication.name} deleted`, openedAt: Date.now() },
          });
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>{medication.name}</Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Text style={styles.rowLabel}>Strength</Text>
        <Text style={styles.rowValue}>{medication.strength ?? 'Not set'}</Text>
        <Text style={styles.rowLabel}>Instructions</Text>
        <Text style={styles.rowValue}>{medication.instructions ?? 'Not set'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.chipsWrap}>
          {schedules.flatMap((schedule) => schedule.times).length === 0 ? (
            <Text style={styles.rowValue}>No times set.</Text>
          ) : (
            schedules
              .flatMap((schedule) => schedule.times)
              .sort()
              .map((time, index) => (
                <View key={`${time}_${index}`} style={styles.chip}>
                  <Text style={styles.chipText}>{formatHHMMTo12Hour(time)}</Text>
                </View>
              ))
          )}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>History</Text>
        {logs.length === 0 ? (
          <Text style={styles.rowValue}>No logs yet.</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logStatus}>Status: {log.status}</Text>
              <Text style={styles.logDate}>Scheduled: {formatISOTo12Hour(log.scheduledAt)}</Text>
            </View>
          ))
        )}
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate('EditMedication', { medicationId })}
      >
        <Text style={styles.primaryButtonText}>Edit medication</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={confirmDelete}>
        <Text style={styles.deleteButtonText}>Delete medication</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: typography.body,
    color: '#64748b',
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.md,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  rowLabel: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  rowValue: {
    fontSize: typography.body,
    color: '#334155',
    marginBottom: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '600',
  },
  logRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  logStatus: {
    fontSize: typography.body,
    color: '#334155',
    textTransform: 'capitalize',
  },
  logDate: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
