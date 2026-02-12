import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state } = useAppState();
  const [banner, setBanner] = useState<string | null>(null);

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Medications</Text>
        <Text style={styles.editText}>Edit</Text>
      </View>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      {state.medications.length === 0 ? (
        <Text style={styles.empty}>No medications yet. Tap + to add one.</Text>
      ) : null}

      {state.medications.map((medication) => {
        const allTimes = schedulesByMedication.get(medication.id) ?? [];
        return (
          <Pressable
            key={medication.id}
            style={styles.card}
            onPress={() => stackNavigation.navigate('MedicationDetail', { medicationId: medication.id })}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{medication.name}</Text>
                {medication.strength ? <Text style={styles.cardSubtitle}>{medication.strength}</Text> : null}
                <Text style={styles.cardMeta}>{formatNextTime(allTimes)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
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
  editText: {
    fontSize: typography.body,
    color: '#64748b',
    fontWeight: '600',
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
  chevron: {
    fontSize: 28,
    color: '#94a3b8',
    marginTop: -2,
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
