import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DoseActionSheet } from '../components/DoseActionSheet';
import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import {
  getScheduledNotificationCount,
  scheduleSnoozeNotification,
  scheduleTestNotificationInOneMinute,
} from '../notifications/notificationScheduler';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import { getTodayDoseInstances, TodayDoseInstance } from '../utils/todayDoses';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

type ActiveDose = TodayDoseInstance & {
  instructions?: string;
};

export function TodayScreen({ navigation, route }: Props) {
  const { state, isLoading, addDoseLog, refresh } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [selectedDose, setSelectedDose] = useState<ActiveDose | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const medicationById = useMemo(() => {
    const map = new Map(state.medications.map((medication) => [medication.id, medication]));
    return map;
  }, [state.medications]);

  const doses = useMemo(() => getTodayDoseInstances(state, new Date()), [state]);

  const dosesWithInstructions = useMemo(
    () =>
      doses.map((dose) => ({
        ...dose,
        instructions: medicationById.get(dose.medicationId)?.instructions,
      })),
    [doses, medicationById],
  );

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Next doses</Text>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && dosesWithInstructions.length === 0 ? (
        <Text style={styles.empty}>No doses scheduled for today.</Text>
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
          <Pressable style={styles.debugButton} onPress={runDebugNotification}>
            <Text style={styles.debugText}>Test notification in 1 minute</Text>
          </Pressable>
          {debugInfo ? <Text style={styles.debugInfo}>{debugInfo}</Text> : null}
        </View>
      ) : null}

      <ScreenNavLinks current="Today" navigation={navigation} />

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
    paddingTop: spacing.lg,
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
    color: '#475569',
    marginBottom: spacing.md,
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
