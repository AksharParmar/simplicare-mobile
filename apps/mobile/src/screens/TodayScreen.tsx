import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DoseActionSheet } from '../components/DoseActionSheet';
import { RootTabParamList } from '../navigation/types';
import {
  getScheduledNotificationCount,
  scheduleSnoozeNotification,
  scheduleTestNotificationInOneMinute,
} from '../notifications/notificationScheduler';
import { usePreferences } from '../state/PreferencesContext';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import {
  getCompletedDoseKeySetForToday,
  getDoseKeyFromInstance,
  getTodayDoseInstances,
  getTodayDoseStats,
  TodayDoseInstance,
} from '../utils/todayDoses';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

type ActiveDose = TodayDoseInstance & {
  instructions?: string;
};

export function TodayScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { prefs } = usePreferences();
  const { state, isLoading, addDoseLog, refresh } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [selectedDose, setSelectedDose] = useState<ActiveDose | null>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const greeting = prefs.displayName.trim() ? `Hi, ${prefs.displayName.trim()}` : 'Hi there';

  const medicationById = useMemo(
    () => new Map(state.medications.map((medication) => [medication.id, medication])),
    [state.medications],
  );

  const allDosesForToday = useMemo(() => getTodayDoseInstances(state, new Date()), [state]);

  const completedDoseKeys = useMemo(
    () => getCompletedDoseKeySetForToday(state, new Date()),
    [state],
  );

  const stats = useMemo(
    () => getTodayDoseStats(allDosesForToday, state, new Date()),
    [allDosesForToday, state],
  );

  const dosesWithInstructions = useMemo(
    () =>
      allDosesForToday
        .filter((dose) => !completedDoseKeys.has(getDoseKeyFromInstance(dose)))
        .map((dose) => ({
          ...dose,
          instructions: medicationById.get(dose.medicationId)?.instructions,
        })),
    [allDosesForToday, completedDoseKeys, medicationById],
  );

  const totalForBar = Math.max(1, stats.total);

  useEffect(() => {
    const reminder = route.params?.reminder;
    if (!reminder || route.params?.openedAt === undefined) {
      return;
    }

    const matchingDose = dosesWithInstructions.find(
      (dose) =>
        dose.medicationId === reminder.medicationId &&
        dose.scheduleId === reminder.scheduleId &&
        dose.timeLabel === reminder.timeHHMM,
    );

    if (matchingDose) {
      setSelectedDose(matchingDose);
    }
  }, [route.params?.openedAt, route.params?.reminder, dosesWithInstructions]);

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

  async function handleLog(status: 'taken' | 'skipped') {
    if (!selectedDose) {
      return;
    }

    setSubmitting(true);
    try {
      await addDoseLog({
        medicationId: selectedDose.medicationId,
        scheduledAt: selectedDose.scheduledAt,
        status,
      });
      await refresh();
      setSelectedDose(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSnooze() {
    if (!selectedDose) {
      return;
    }

    setSubmitting(true);
    try {
      await scheduleSnoozeNotification({
        medicationId: selectedDose.medicationId,
        medicationName: selectedDose.medicationName,
        scheduleId: selectedDose.scheduleId,
        originalTimeHHMM: selectedDose.timeLabel,
      });
      setSelectedDose(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function runDebugNotification() {
    await scheduleTestNotificationInOneMinute();
    const scheduledCount = await getScheduledNotificationCount();
    setDebugInfo(`Scheduled notifications: ${scheduledCount}`);
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Next doses</Text>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Today stats</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>Taken: {stats.taken}</Text>
          <Text style={styles.statLabel}>Skipped: {stats.skipped}</Text>
          <Text style={styles.statLabel}>Remaining: {stats.remaining}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barTaken, { flex: stats.taken / totalForBar }]} />
          <View style={[styles.barSkipped, { flex: stats.skipped / totalForBar }]} />
          <View style={[styles.barRemaining, { flex: stats.remaining / totalForBar }]} />
        </View>
      </View>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && dosesWithInstructions.length === 0 ? (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>All done for today 🎉</Text>
          <Text style={styles.doneSubtitle}>Your logs are saved in Medications.</Text>
        </View>
      ) : null}

      {!isLoading
        ? dosesWithInstructions.map((dose) => (
            <Pressable key={dose.id} style={styles.card} onPress={() => setSelectedDose(dose)}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>{dose.medicationName}</Text>
                <View style={[styles.badge, dose.isUpcoming ? styles.badgeUpcoming : styles.badgePast]}>
                  <Text style={styles.badgeText}>{dose.isUpcoming ? 'Upcoming' : 'Past'}</Text>
                </View>
              </View>
              <Text style={styles.cardTime}>{dose.timeLabel}</Text>
              <Text style={styles.cardHint}>Tap for actions</Text>
            </Pressable>
          ))
        : null}

      {__DEV__ ? (
        <View style={styles.debugWrap}>
          <Pressable style={styles.debugButton} onPress={() => void runDebugNotification()}>
            <Text style={styles.debugText}>Test notification in 1 minute</Text>
          </Pressable>
          {debugInfo ? <Text style={styles.debugInfo}>{debugInfo}</Text> : null}
        </View>
      ) : null}

      <DoseActionSheet
        visible={Boolean(selectedDose)}
        medicationName={selectedDose?.medicationName ?? ''}
        scheduledTime={selectedDose?.timeLabel ?? ''}
        instructions={selectedDose?.instructions}
        loading={submitting}
        onClose={() => setSelectedDose(null)}
        onMarkTaken={() => void handleLog('taken')}
        onSkip={() => void handleLog('skipped')}
        onSnooze={() => void handleSnooze()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  greeting: {
    fontSize: typography.body,
    color: '#64748b',
    marginBottom: spacing.xs,
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
  statsCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statsTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: typography.caption,
    color: '#475569',
    fontWeight: '600',
  },
  barTrack: {
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
  },
  barTaken: {
    backgroundColor: '#16a34a',
  },
  barSkipped: {
    backgroundColor: '#f59e0b',
  },
  barRemaining: {
    backgroundColor: '#94a3b8',
  },
  loader: {
    marginBottom: spacing.md,
  },
  doneCard: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#ecfdf5',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  doneTitle: {
    fontSize: typography.subtitle,
    color: '#065f46',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  doneSubtitle: {
    fontSize: typography.body,
    color: '#065f46',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#0f172a',
    marginRight: spacing.sm,
  },
  badge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeUpcoming: {
    backgroundColor: '#dcfce7',
  },
  badgePast: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: typography.caption,
    color: '#1f2937',
    fontWeight: '600',
  },
  cardTime: {
    fontSize: typography.body,
    color: '#1e293b',
    marginBottom: spacing.xs,
  },
  cardHint: {
    fontSize: typography.caption,
    color: '#64748b',
  },
  debugWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  debugButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  debugText: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    color: '#64748b',
  },
});
