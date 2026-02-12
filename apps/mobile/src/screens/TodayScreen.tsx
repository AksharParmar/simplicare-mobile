import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { spacing, typography } from '../theme/tokens';
import { getTodayDoseInstances } from '../utils/todayDoses';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

export function TodayScreen({ navigation }: Props) {
  const { state, isLoading, addDoseLog, refresh } = useAppState();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const doses = useMemo(() => getTodayDoseInstances(state, new Date()), [state]);

  async function handleLog(doseId: string, medicationId: string, scheduledAt: string, status: 'taken' | 'skipped') {
    setSubmittingId(`${doseId}_${status}`);
    try {
      await addDoseLog({
        medicationId,
        scheduledAt,
        status,
      });
      await refresh();
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.body}>Next doses today</Text>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      {!isLoading && doses.length === 0 ? (
        <Text style={styles.empty}>No doses scheduled for today.</Text>
      ) : null}

      {!isLoading
        ? doses.map((dose) => {
            const takenLoading = submittingId === `${dose.id}_taken`;
            const skippedLoading = submittingId === `${dose.id}_skipped`;

            return (
              <View key={dose.id} style={styles.card}>
                <Text style={styles.cardTitle}>{dose.medicationName}</Text>
                <Text style={styles.cardTime}>{dose.timeLabel}</Text>
                <Text style={styles.cardMeta}>{dose.isUpcoming ? 'Upcoming' : 'Past due'}</Text>
                <View style={styles.buttonRow}>
                  <View style={styles.buttonWrap}>
                    <Button
                      title={takenLoading ? 'Saving...' : 'Taken'}
                      onPress={() =>
                        handleLog(dose.id, dose.medicationId, dose.scheduledAt, 'taken')
                      }
                      disabled={takenLoading || skippedLoading}
                    />
                  </View>
                  <View style={styles.buttonWrap}>
                    <Button
                      title={skippedLoading ? 'Saving...' : 'Skipped'}
                      onPress={() =>
                        handleLog(dose.id, dose.medicationId, dose.scheduledAt, 'skipped')
                      }
                      disabled={takenLoading || skippedLoading}
                    />
                  </View>
                </View>
              </View>
            );
          })
        : null}

      <ScreenNavLinks current="Today" navigation={navigation} />
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
  body: {
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
  },
  cardTime: {
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: '#666666',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: spacing.sm,
  },
  buttonWrap: {
    flex: 1,
  },
});
