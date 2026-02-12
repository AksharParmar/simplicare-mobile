import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdherenceRing } from '../components/AdherenceRing';
import { DoseActionSheet } from '../components/DoseActionSheet';
import { RootTabParamList } from '../navigation/types';
import { scheduleSnoozeNotification } from '../notifications/notificationScheduler';
import { usePreferences } from '../state/PreferencesContext';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import { get7DayStats, getDayStats, getStreakDays } from '../utils/adherence';
import { formatHHMMTo12Hour } from '../utils/timeFormat';
import {
  getCompletedDoseKeySetForToday,
  getDoseKeyFromInstance,
  getTodayDoseInstances,
  TodayDoseInstance,
} from '../utils/todayDoses';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

type ActiveDose = TodayDoseInstance & {
  instructions?: string;
  strength?: string;
};

function formatRelativeTime(scheduledAtISO: string, now: Date): string {
  const target = new Date(scheduledAtISO);
  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (Math.abs(diffMinutes) <= 5) {
    return 'Now';
  }
  if (diffMinutes < 60) {
    return `In ${Math.max(1, diffMinutes)} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes === 0 ? `In ${hours} hr` : `In ${hours} hr ${minutes} min`;
}

export function TodayScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { prefs } = usePreferences();
  const { state, isLoading, addDoseLog, refresh } = useAppState();
  const [selectedDose, setSelectedDose] = useState<ActiveDose | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const now = new Date();
  const greeting = prefs.displayName.trim() ? `Hi, ${prefs.displayName.trim()}` : 'Hi there';
  const hasAnyMedication = state.medications.length > 0;
  const hasAnySchedule = state.schedules.length > 0;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const medicationById = useMemo(
    () => new Map(state.medications.map((medication) => [medication.id, medication])),
    [state.medications],
  );

  const allTodayDoses = useMemo(() => getTodayDoseInstances(state, now), [state, now]);
  const completedKeys = useMemo(() => getCompletedDoseKeySetForToday(state, now), [state, now]);

  const remainingTodayDoses = useMemo(
    () =>
      allTodayDoses
        .filter((dose) => !completedKeys.has(getDoseKeyFromInstance(dose)))
        .map((dose) => ({
          ...dose,
          strength: medicationById.get(dose.medicationId)?.strength,
          instructions: medicationById.get(dose.medicationId)?.instructions,
        })),
    [allTodayDoses, completedKeys, medicationById],
  );

  const upcomingDoses = useMemo(
    () =>
      remainingTodayDoses.filter(
        (dose) => new Date(dose.scheduledAt).getTime() >= now.getTime(),
      ),
    [remainingTodayDoses, now],
  );

  const nextDose = upcomingDoses[0] ?? null;
  const laterDoses = nextDose
    ? upcomingDoses.filter((dose) => dose.id !== nextDose.id).slice(0, 6)
    : [];
  const hiddenLaterCount = nextDose
    ? Math.max(0, upcomingDoses.length - 1 - laterDoses.length)
    : 0;

  const todayStats = useMemo(() => getDayStats(state, now), [state, now]);
  const sevenDayStats = useMemo(() => get7DayStats(state, now), [state, now]);
  const streakDays = useMemo(() => getStreakDays(state, now), [state, now]);

  const dayTotalForBar = Math.max(1, todayStats.total);
  const sevenDayPercent = Math.round(sevenDayStats.overallRate * 100);

  useEffect(() => {
    const reminder = route.params?.reminder;
    if (!reminder || route.params?.openedAt === undefined) {
      return;
    }

    const matched = remainingTodayDoses.find(
      (dose) =>
        dose.medicationId === reminder.medicationId &&
        dose.scheduleId === reminder.scheduleId &&
        dose.timeLabel === reminder.timeHHMM,
    );
    if (matched) {
      setSelectedDose(matched);
    }
  }, [route.params?.openedAt, route.params?.reminder, remainingTodayDoses]);

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

  async function logDose(dose: ActiveDose, status: 'taken' | 'skipped') {
    setSubmitting(true);
    try {
      await addDoseLog({
        medicationId: dose.medicationId,
        scheduledAt: dose.scheduledAt,
        status,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await refresh();
      setSelectedDose(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSheetLog(status: 'taken' | 'skipped') {
    if (!selectedDose) {
      return;
    }

    await logDose(selectedDose, status);
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
        strength: selectedDose.strength,
        scheduleId: selectedDose.scheduleId,
        originalTimeHHMM: selectedDose.timeLabel,
        snoozeMinutes: prefs.defaultSnoozeMinutes,
      });
      setSelectedDose(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.title}>Today</Text>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      <View style={styles.insightsCard}>
        <View style={styles.insightsLeft}>
          <Text style={styles.cardTitle}>7-day adherence</Text>
          <Text style={styles.cardSubtitle}>
            {sevenDayStats.totalLogged > 0 ? `${sevenDayPercent}% overall` : 'No data yet'}
          </Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
              {streakDays > 0 ? `🔥 ${streakDays}-day streak` : 'No streak yet'}
            </Text>
          </View>
        </View>
        <AdherenceRing
          progress={sevenDayStats.overallRate}
          noData={sevenDayStats.totalLogged === 0}
        />
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.cardTitle}>Day progress</Text>
        {todayStats.total > 0 ? (
          <>
            <View style={styles.progressStatsRow}>
              <Text style={styles.progressStat}>Taken {todayStats.taken}</Text>
              <Text style={styles.progressStat}>Skipped {todayStats.skipped}</Text>
              <Text style={styles.progressStat}>Remaining {todayStats.remaining}</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.barTaken, { flex: todayStats.taken / dayTotalForBar }]} />
              <View style={[styles.barSkipped, { flex: todayStats.skipped / dayTotalForBar }]} />
              <View style={[styles.barRemaining, { flex: todayStats.remaining / dayTotalForBar }]} />
            </View>
          </>
        ) : (
          <View>
            <Text style={styles.cardSubtitle}>No doses scheduled today</Text>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
              onPress={() => navigation.getParent()?.navigate('ManualAddMedication')}
            >
              <Text style={styles.addButtonText}>Add medication</Text>
            </Pressable>
          </View>
        )}
      </View>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && !hasAnyMedication && !hasAnySchedule ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No medications yet</Text>
          <Text style={styles.emptySubtitle}>Add your first medication to start reminders.</Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.getParent()?.navigate('ManualAddMedication')}
          >
            <Text style={styles.addButtonText}>Add medication</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && hasAnyMedication ? (
        nextDose ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>Next up</Text>
            <Text style={styles.nextMedication}>
              {nextDose.medicationName}
              {nextDose.strength ? ` · ${nextDose.strength}` : ''}
            </Text>
            <Text style={styles.nextTime}>
              {formatHHMMTo12Hour(nextDose.timeLabel)} ·{' '}
              {formatRelativeTime(nextDose.scheduledAt, now)}
            </Text>
            <View style={styles.nextActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryAction, pressed && styles.buttonPressed]}
                onPress={() => void logDose(nextDose, 'taken')}
                disabled={submitting}
              >
                <Text style={styles.primaryActionText}>Mark taken</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.buttonPressed]}
                onPress={() => void logDose(nextDose, 'skipped')}
                disabled={submitting}
              >
                <Text style={styles.secondaryActionText}>Skip</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>All done for today 🎉</Text>
            <Text style={styles.doneSubtitle}>Your history is saved in Medications.</Text>
          </View>
        )
      ) : null}

      {!isLoading && hasAnyMedication && laterDoses.length > 0 ? (
        <View style={styles.laterSection}>
          <View style={styles.laterHeader}>
            <Text style={styles.cardTitle}>Later today</Text>
            {hiddenLaterCount > 0 ? (
              <Pressable onPress={() => navigation.navigate('Medications')}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            ) : null}
          </View>
          {laterDoses.map((dose) => (
            <Pressable
              key={dose.id}
              style={({ pressed }) => [styles.laterRow, pressed && styles.buttonPressed]}
              onPress={() => setSelectedDose(dose)}
            >
              <Text style={styles.laterName}>{dose.medicationName}</Text>
              <Text style={styles.laterTime}>{formatHHMMTo12Hour(dose.timeLabel)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <DoseActionSheet
        visible={Boolean(selectedDose)}
        medicationName={selectedDose?.medicationName ?? ''}
        scheduledTime={selectedDose ? formatHHMMTo12Hour(selectedDose.timeLabel) : ''}
        instructions={selectedDose?.instructions}
        loading={submitting}
        snoozeMinutes={prefs.defaultSnoozeMinutes}
        onClose={() => setSelectedDose(null)}
        onMarkTaken={() => void handleSheetLog('taken')}
        onSkip={() => void handleSheetLog('skipped')}
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
  insightsCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  insightsLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    color: '#0f172a',
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: typography.body,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  streakBadge: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  streakText: {
    fontSize: typography.caption,
    color: '#9a3412',
    fontWeight: '700',
  },
  progressCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressStat: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '600',
  },
  progressBarTrack: {
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
  emptyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.subtitle,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: '#64748b',
    marginBottom: spacing.sm,
  },
  addButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
  nextCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  nextLabel: {
    fontSize: typography.caption,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  nextMedication: {
    fontSize: typography.title,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  nextTime: {
    fontSize: typography.body,
    color: '#334155',
    marginBottom: spacing.md,
  },
  nextActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#0f172a',
    fontSize: typography.body,
    fontWeight: '700',
  },
  doneCard: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: radius.lg,
    backgroundColor: '#ecfdf5',
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
  laterSection: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
  },
  laterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  seeAllText: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '700',
  },
  laterRow: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  laterName: {
    fontSize: typography.body,
    color: '#0f172a',
  },
  laterTime: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
