import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMedication'>;

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

export function EditMedicationScreen({ route, navigation }: Props) {
  const { medicationId } = route.params;
  const { state, updateMedication, updateSchedule, addSchedule } = useAppState();

  const medication = state.medications.find((item) => item.id === medicationId);
  const primarySchedule = state.schedules.find((schedule) => schedule.medicationId === medicationId);

  const [name, setName] = useState(medication?.name ?? '');
  const [strength, setStrength] = useState(medication?.strength ?? '');
  const [instructions, setInstructions] = useState(medication?.instructions ?? '');
  const [times, setTimes] = useState<string[]>(sortTimes(primarySchedule?.times ?? []));
  const [timeInput, setTimeInput] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => name.trim().length > 0 && times.length > 0 && !saving, [name, times, saving]);

  if (!medication) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Medication not found.</Text>
      </View>
    );
  }

  function addTime() {
    if (!isValidTime(timeInput)) {
      setError('Enter time as HH:MM (24-hour), for example 08:00 or 20:30.');
      return;
    }

    if (times.includes(timeInput)) {
      setError('That time is already added.');
      return;
    }

    setTimes(sortTimes([...times, timeInput]));
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
      await updateMedication(medicationId, {
        name: name.trim(),
        strength: strength.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      if (primarySchedule) {
        await updateSchedule(primarySchedule.id, { times: sortTimes(times) });
      } else {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
        const startDate = new Date().toISOString().slice(0, 10);

        await addSchedule({
          medicationId,
          times: sortTimes(times),
          timezone,
          startDate,
        });
      }

      navigation.navigate('MedicationDetail', { medicationId });
    } catch {
      setError('Could not save updates. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit medication</Text>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Medication name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Strength</Text>
        <TextInput value={strength} onChangeText={setStrength} style={styles.input} />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Instructions</Text>
        <TextInput value={instructions} onChangeText={setInstructions} style={[styles.input, styles.multiline]} multiline />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Dose times</Text>
        <View style={styles.timeRow}>
          <TextInput value={timeInput} onChangeText={setTimeInput} style={[styles.input, styles.timeInput]} keyboardType="numbers-and-punctuation" />
          <Pressable style={styles.addTimeButton} onPress={addTime}>
            <Text style={styles.addTimeText}>Add time</Text>
          </Pressable>
        </View>

        <View style={styles.chipWrap}>
          {times.map((time) => (
            <Pressable key={time} style={styles.chip} onPress={() => removeTime(time)}>
              <Text style={styles.chipText}>{time}  ×</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={() => void handleSave()} disabled={!canSave}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
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
