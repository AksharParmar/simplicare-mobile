import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';

type Props = BottomTabScreenProps<RootTabParamList, 'Medications'>;

function formatNextTime(times: string[]): string {
  if (times.length === 0) {
    return 'No schedule set';
  }

  const sortedTimes = [...times].sort();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = sortedTimes.find((time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes >= currentMinutes;
  });

  const nextTime = upcoming ?? sortedTimes[0];
  const [hour, minute] = nextTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return `Next: ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function MyMedicationsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, deleteMedication } = useAppState();
  const [banner, setBanner] = useState<string | null>(null);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const schedulesByMedication = useMemo(() => {
    const map = new Map<string, string[]>();

    state.schedules.forEach((schedule) => {
      const existing = map.get(schedule.medicationId) ?? [];
      map.set(schedule.medicationId, [...existing, ...schedule.times]);
    });

    return map;
  }, [state.schedules]);

  const recentLogs = useMemo(
    () =>
      [...state.doseLogs]
        .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
        .slice(0, 10),
    [state.doseLogs],
  );

  const medicationNameById = useMemo(
    () => new Map(state.medications.map((medication) => [medication.id, medication.name])),
    [state.medications],
  );

  useEffect(() => {
    const flashMessage = route.params?.flashMessage;
    if (!flashMessage) {
      return;
    }

    setBanner(flashMessage);
    const timer = setTimeout(() => {
      setBanner(null);
      navigation.setParams({ flashMessage: undefined });
    }, 1600);

    return () => clearTimeout(timer);
  }, [route.params?.flashMessage, navigation]);

  function confirmDelete(medicationId: string, medicationName: string) {
    Alert.alert(`Delete ${medicationName}?`, 'This removes the medication, schedules, and related logs.', [
      { text: 'Cancel', style: 'cancel', onPress: () => swipeableRefs.current[medicationId]?.close() },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMedication(medicationId);
          navigation.setParams({
            flashMessage: `${medicationName} deleted`,
            openedAt: Date.now(),
          });
        },
      },
    ]);
  }

  function renderDeleteAction(medicationId: string, medicationName: string) {
    return (
      <Pressable
        style={styles.deleteSwipeAction}
        onPress={() => confirmDelete(medicationId, medicationName)}
      >
        <Text style={styles.deleteSwipeText}>Delete</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Medications</Text>
        <Pressable style={styles.addButton} onPress={() => stackNavigation.navigate('ManualAddMedication')}>
          <Text style={styles.addButtonText}>Add medication</Text>
        </Pressable>
      </View>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      {state.medications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No medications yet</Text>
          <Text style={styles.emptySubtitle}>Start by adding your first medication.</Text>
          <Pressable style={styles.emptyButton} onPress={() => stackNavigation.navigate('ManualAddMedication')}>
            <Text style={styles.emptyButtonText}>Add medication</Text>
          </Pressable>
        </View>
      ) : null}

      {state.medications.map((medication) => {
        const allTimes = schedulesByMedication.get(medication.id) ?? [];
        return (
          <Swipeable
            key={medication.id}
            ref={(ref: Swipeable | null) => {
              swipeableRefs.current[medication.id] = ref;
            }}
            overshootRight={false}
            renderRightActions={() => renderDeleteAction(medication.id, medication.name)}
          >
            <Pressable
              style={styles.card}
              onPress={() => stackNavigation.navigate('MedicationDetail', { medicationId: medication.id })}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>{medication.name}</Text>
                  {medication.strength ? <Text style={styles.cardSubtitle}>{medication.strength}</Text> : null}
                  <Text style={styles.cardMeta}>{formatNextTime(allTimes)}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.editPill}
                    onPress={() => stackNavigation.navigate('EditMedication', { medicationId: medication.id })}
                  >
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
            </Pressable>
          </Swipeable>
        );
      })}

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        {recentLogs.length === 0 ? (
          <Text style={styles.empty}>No dose logs yet.</Text>
        ) : (
          recentLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logName}>
                {medicationNameById.get(log.medicationId) ?? 'Unknown medication'}
              </Text>
              <Text style={styles.logMeta}>
                {log.status} · {new Date(log.scheduledAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
  },
  addButton: {
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  banner: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: typography.body,
    fontWeight: '600',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: '#64748b',
    marginBottom: spacing.sm,
  },
  emptyButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
  empty: {
    fontSize: typography.body,
    color: '#64748b',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: typography.body,
    color: '#334155',
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  cardActions: {
    alignItems: 'flex-end',
  },
  editPill: {
    minHeight: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  editPillText: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '700',
  },
  chevron: {
    fontSize: 24,
    color: '#94a3b8',
  },
  deleteSwipeAction: {
    width: 96,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSwipeText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '700',
  },
  sectionWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.md,
  },
  logRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  logMeta: {
    fontSize: typography.caption,
    color: '#64748b',
    textTransform: 'capitalize',
  },
});
