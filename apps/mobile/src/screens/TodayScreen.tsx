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

import { DoseActionSheet } from '../components/DoseActionSheet';
import { RootTabParamList } from '../navigation/types';
import { scheduleSnoozeNotification } from '../notifications/notificationScheduler';
import { usePreferences } from '../state/PreferencesContext';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatHHMMTo12Hour } from '../utils/timeFormat';
import { getAdherenceStreak, getLastNDaysAdherence } from '../utils/adherence';
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

function formatRelativeTime(scheduledAt: string, now: Date): string {
  const target = new Date(scheduledAt);
  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000);

  if (Math.abs(diffMinutes) <= 5) {
    return 'Now';
  }

  if (diffMinutes < 60) {
    return `In ${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (minutes === 0) {
    return `In ${hours} hr`;
  }

  return `In ${hours} hr ${minutes} min`;
}

export function TodayScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { prefs } = usePreferences();
  const { state, isLoading, addDoseLog, refresh } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [selectedDose, setSelectedDose] = useState<ActiveDose | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const greeting = prefs.displayName.trim() ? `Hi, ${prefs.displayName.trim()}` : 'Hi there';

  const medicationById = useMemo(
    () => new Map(state.medications.map((medication) => [medication.id, medication])),
    [state.medications],
  );

  const hasAnyMedication = state.medications.length > 0;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const now = new Date();
  const allDosesForToday = useMemo(() => getTodayDoseInstances(state, now), [state, now]);

  const completedDoseKeys = useMemo(
    () => getCompletedDoseKeySetForToday(state, now),
    [state, now],
  );

  const remainingDoses = useMemo(
    () =>
      allDosesForToday
        .filter((dose) => !completedDoseKeys.has(getDoseKeyFromInstance(dose)))
        .map((dose) => ({
          ...dose,
          instructions: medicationById.get(dose.medicationId)?.instructions,
          strength: medicationById.get(dose.medicationId)?.strength,
        })),
    [allDosesForToday, completedDoseKeys, medicationById],
  );

  const upcomingDoses = useMemo(
    () => remainingDoses.filter((dose) => new Date(dose.scheduledAt).getTime() >= now.getTime()),
    [remainingDoses, now],
  );

  const nextDose = upcomingDoses[0] ?? null;
  const laterDoses = nextDose
    ? upcomingDoses.filter((dose) => dose.id !== nextDose.id).slice(0, 5)
    : [];
  const hiddenLaterCount = nextDose ? Math.max(0, upcomingDoses.length - 1 - laterDoses.length) : 0;

  const last7Days = useMemo(() => getLastNDaysAdherence(state, 7, now), [state, now]);
  const streak = useMemo(() => getAdherenceStreak(state, now), [state, now]);
  const sevenDayPercent = Math.round(last7Days.overallRate * 100);
  const sevenDayTaken = useMemo(
    () => last7Days.days.reduce((sum, day) => sum + day.taken, 0),
    [last7Days.days],
  );
  const sevenDaySkipped = useMemo(
    () => last7Days.days.reduce((sum, day) => sum + day.skipped, 0),
    [last7Days.days],
  );
  const hasSevenDayData = sevenDayTaken + sevenDaySkipped > 0;
  const sevenDayDenominator = Math.max(1, sevenDayTaken + sevenDaySkipped);

  useEffect(() => {
    const reminder = route.params?.reminder;
    if (!reminder || route.params?.openedAt === undefined) {
      return;
    }

    const matchingDose = remainingDoses.find(
      (dose) =>
        dose.medicationId === reminder.medicationId &&
        dose.scheduleId === reminder.scheduleId &&
        dose.timeLabel === reminder.timeHHMM,
    );

    if (matchingDose) {
      setSelectedDose(matchingDose);
    }
  }, [route.params?.openedAt, route.params?.reminder, remainingDoses]);

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

  async function handleLogForDose(dose: ActiveDose, status: 'taken' | 'skipped') {
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

  async function handleLog(status: 'taken' | 'skipped') {
    if (!selectedDose) {
      return;
    }

    await handleLogForDose(selectedDose, status);
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
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.title}>Today</Text>
      <View style={styles.headerMetaRow}>
        {streak > 0 ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>🔥 {streak}-day streak</Text>
          </View>
        ) : null}
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>7-day: {sevenDayPercent}%</Text>
        </View>
      </View>

      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      <View style={styles.adherenceCard}>
        <View style={styles.adherenceHeaderRow}>
          <Text style={styles.adherenceTitle}>7-day adherence</Text>
          <Text style={styles.adherencePercent}>{hasSevenDayData ? `${sevenDayPercent}%` : 'No data yet'}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barTaken, { flex: hasSevenDayData ? sevenDayTaken / sevenDayDenominator : 1 }]} />
          <View style={[styles.barSkipped, { flex: hasSevenDayData ? sevenDaySkipped / sevenDayDenominator : 0 }]} />
        </View>
        {hasSevenDayData ? (
          <Text style={styles.adherenceMeta}>
            Taken {sevenDayTaken} · Skipped {sevenDaySkipped}
          </Text>
        ) : null}
      </View>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && !hasAnyMedication ? (
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
              {formatHHMMTo12Hour(nextDose.timeLabel)} · {formatRelativeTime(nextDose.scheduledAt, now)}
            </Text>
            <View style={styles.nextActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryAction, pressed && styles.buttonPressed]}
                onPress={() => void handleLogForDose(nextDose, 'taken')}
                disabled={submitting}
              >
                <Text style={styles.primaryActionText}>Mark Taken</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.buttonPressed]}
                onPress={() => void handleLogForDose(nextDose, 'skipped')}
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
            <Text style={styles.laterTitle}>Later today</Text>
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
    marginBottom: spacing.md,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  metaPillText: {
    fontSize: typography.caption,
    color: '#334155',
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
  adherenceCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  adherenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  adherenceTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
  },
  adherencePercent: {
    fontSize: typography.body,
    color: '#0f172a',
    fontWeight: '700',
  },
  adherenceMeta: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
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
  loader: {
    marginBottom: spacing.md,
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
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
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
  nextCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '600',
    color: '#0f172a',
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
  laterTitle: {
    fontSize: typography.subtitle,
    color: '#0f172a',
    fontWeight: '700',
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
});
