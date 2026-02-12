import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppStateContext';
import { usePreferences } from '../state/PreferencesContext';
import { radius, spacing, typography } from '../theme/tokens';
import { extractLabelCandidates } from '../utils/labelExtract';
import { formatHHMMTo12Hour } from '../utils/timeFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmScanMedication'>;

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

export function ConfirmScanMedicationScreen({ navigation, route }: Props) {
  const { rawText, imageUri, source } = route.params;
  const extracted = useMemo(() => extractLabelCandidates(rawText), [rawText]);

  const { addMedication, addSchedule } = useAppState();
  const { prefs } = usePreferences();

  const [name, setName] = useState(extracted.nameCandidate ?? '');
  const [strength, setStrength] = useState(extracted.strengthCandidate ?? '');
  const [instructions, setInstructions] = useState(extracted.instructionsCandidate ?? '');
  const [timeInput, setTimeInput] = useState('08:00');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [showRawText, setShowRawText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0 && times.length > 0 && !saving, [name, times, saving]);

  function handleAddTime() {
    const normalized = timeInput.trim();
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
    if (times.length === 1) {
      setError('At least one dose time is required.');
      return;
    }

    setTimes(times.filter((item) => item !== time));
    setError(null);
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      const startDate = new Date().toISOString().slice(0, 10);

      const medication = await addMedication({
        name: name.trim(),
        strength: strength.trim() || undefined,
        instructions: instructions.trim() || undefined,
        scanText: prefs.saveScanTextLocally ? extracted.cleanedText : undefined,
        scanSource: prefs.saveScanTextLocally ? source : undefined,
        scanCapturedAt: prefs.saveScanTextLocally ? new Date().toISOString() : undefined,
      });

      await addSchedule({
        medicationId: medication.id,
        times: sortTimes(times),
        timezone,
        startDate,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.navigate('Tabs', {
        screen: 'Home',
        params: {
          flashMessage: `Added ${medication.name}`,
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Confirm scan</Text>
        <Text style={styles.subtitle}>Review extracted fields before saving.</Text>

        {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} /> : null}

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Medication name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Required" style={styles.input} autoCapitalize="words" />
          <Text style={styles.confidenceText}>From label ({extracted.confidence.name.toUpperCase()} confidence)</Text>
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
          <Text style={styles.confidenceText}>From label ({extracted.confidence.strength.toUpperCase()} confidence)</Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Instructions</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Optional notes to keep"
            style={[styles.input, styles.multiline]}
            multiline
          />
          <Text style={styles.confidenceText}>From label ({extracted.confidence.instructions.toUpperCase()} confidence)</Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Dose times</Text>
          <Text style={styles.helperText}>Default starts at 8:00 AM. Confirm or adjust before saving.</Text>
          <View style={styles.timeRow}>
            <TextInput
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="HH:MM"
              style={[styles.input, styles.timeInput]}
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

        <Pressable style={styles.rawTextToggle} onPress={() => setShowRawText((prev) => !prev)}>
          <Text style={styles.rawTextToggleLabel}>{showRawText ? 'Hide raw text' : 'View raw text'}</Text>
        </Pressable>

        {showRawText ? (
          <View style={styles.rawTextCard}>
            <Text style={styles.rawTextValue}>{extracted.cleanedText || 'No OCR text provided.'}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={[styles.primaryButton, !canSave && styles.buttonDisabled]} disabled={!canSave} onPress={() => void handleSave()}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save medication'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
          <Text style={styles.secondaryButtonText}>Edit manually</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.subtitle,
    color: '#334155',
    marginBottom: spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
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
  confidenceText: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: typography.caption,
    color: '#64748b',
    marginBottom: spacing.xs,
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
  rawTextToggle: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rawTextToggleLabel: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
  rawTextCard: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rawTextValue: {
    fontSize: typography.caption,
    color: '#475569',
    lineHeight: 20,
  },
  errorText: {
    fontSize: typography.caption,
    color: '#b91c1c',
    marginBottom: spacing.md,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
