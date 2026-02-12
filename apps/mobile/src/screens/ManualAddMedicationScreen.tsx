import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatHHMMTo12Hour } from '../utils/timeFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'ManualAddMedication'>;

function normalizeTime(value: string): string {
  return value.trim();
}

function isValidTime(value: string): boolean {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function sortTimes(times: string[]): string[] {
  return [...times].sort((a, b) => {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
}

export function ManualAddMedicationScreen({ navigation }: Props) {
  const { addMedication, addSchedule } = useAppState();

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeInput, setTimeInput] = useState('08:00');
  const [times, setTimes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0 && times.length > 0 && !saving, [name, times, saving]);

  function handleAddTime() {
    const normalized = normalizeTime(timeInput);
    if (!isValidTime(normalized)) {
      setError('Enter time as HH:MM (24-hour), for example 08:00 or 20:30.');
      return;
    }

    if (times.includes(normalized)) {
      setError('That time is already added.');
      return;
    }

    setTimes(sortTimes([...times, normalized]));
    setError(null);
  }

  function removeTime(time: string) {
    setTimes(times.filter((item) => item !== time));
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const createdMedication = await addMedication({
        name: name.trim(),
        strength: strength.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      const startDate = new Date().toISOString().slice(0, 10);

      await addSchedule({
        medicationId: createdMedication.id,
        times: sortTimes(times),
        timezone,
        startDate,
      });

      navigation.navigate('Tabs', {
        screen: 'Home',
        params: {
          flashMessage: `${createdMedication.name} added`,
          openedAt: Date.now(),
        },
      });
    } catch {
      setError('Could not save medication. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add medication</Text>
      <Text style={styles.subtitle}>Manual entry</Text>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Medication name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Required"
          style={styles.input}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Strength</Text>
        <TextInput
          value={strength}
          onChangeText={setStrength}
          placeholder="e.g., 10 mg, 500 mg, 20 mcg, 5 mL"
          style={styles.input}
          autoCapitalize="none"
        />
        <Text style={styles.helperText}>What&apos;s printed on the label (dose strength).</Text>
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Instructions</Text>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Any extra instructions? e.g., Take with food, Take at bedtime"
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Text style={styles.helperText}>Optional notes you want to remember.</Text>
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Dose times</Text>
        <View style={styles.timeRow}>
          <TextInput
            value={timeInput}
            onChangeText={setTimeInput}
            placeholder="HH:MM"
            style={[styles.input, styles.timeInput]}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          <Pressable style={styles.addTimeButton} onPress={handleAddTime}>
            <Text style={styles.addTimeText}>Add time</Text>
          </Pressable>
        </View>

        <View style={styles.chipWrap}>
          {times.map((time) => (
            <Pressable key={time} style={styles.chip} onPress={() => removeTime(time)}>
              <Text style={styles.chipText}>{formatHHMMTo12Hour(time)}  ×</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={() => void handleSave()} disabled={!canSave}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save medication'}</Text>
      </Pressable>
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
  fieldWrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: '#0f172a',
  },
  helperText: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  multiline: {
    minHeight: 92,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeInput: {
    flex: 1,
  },
  addTimeButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTimeText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 38,
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
  errorText: {
    fontSize: typography.caption,
    color: '#b91c1c',
    marginBottom: spacing.md,
  },
  saveButton: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
});
