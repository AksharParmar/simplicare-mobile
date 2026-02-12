import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  Image,
  Modal,
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
import { radius, spacing, typography } from '../theme/tokens';
import { ConfidenceLevel, extractLabelFields } from '../utils/labelExtract';
import { formatHHMMTo12Hour } from '../utils/timeFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmScannedMedication'>;

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

const SAMPLE_LABEL_TEXT = `Metformin 500 mg\nTake one tablet twice daily with food\nRx use only`;
const DEV_BUILD_COMMANDS = `npm i -g eas-cli
eas login
cd apps/mobile
eas build:configure
eas build --profile development --platform ios
npx expo start --dev-client`;

export function ConfirmScannedMedicationScreen({ navigation, route }: Props) {
  const { addMedication, addSchedule } = useAppState();
  const { imageUri, rawText: initialRawText, ocrError, ocrLines } = route.params;

  const [rawText, setRawText] = useState(initialRawText);
  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeInput, setTimeInput] = useState('09:00');
  const [times, setTimes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetectedText, setShowDetectedText] = useState(false);
  const [showDevBuildModal, setShowDevBuildModal] = useState(false);
  const [confidence, setConfidence] = useState<{
    name: ConfidenceLevel;
    strength: ConfidenceLevel;
    instructions: ConfidenceLevel;
  }>({
    name: 'low',
    strength: 'low',
    instructions: 'low',
  });

  const canSave = useMemo(() => name.trim().length > 0 && times.length > 0 && !saving, [name, times, saving]);

  useEffect(() => {
    const parsed = extractLabelFields(rawText);
    setConfidence(parsed.confidence);

    setName((prev) => prev || parsed.nameCandidate || '');
    setStrength((prev) => prev || parsed.strengthCandidate || '');
    setInstructions((prev) => prev || parsed.instructionsCandidate || '');
    setTimes((prev) => (prev.length > 0 ? prev : parsed.timesSuggested));
    setTimeInput((prev) => (prev ? prev : parsed.timesSuggested[0] ?? '09:00'));
  }, [rawText]);

  function handleAddTime() {
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
      const medication = await addMedication({
        name: name.trim(),
        strength: strength.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      const startDate = new Date().toISOString().slice(0, 10);

      await addSchedule({
        medicationId: medication.id,
        times: sortTimes(times),
        timezone,
        startDate,
      });

      navigation.navigate('Tabs', {
        screen: 'Home',
        params: {
          flashMessage: `${medication.name} added from scan`,
          openedAt: Date.now(),
        },
      });
    } catch {
      setError('Could not save medication. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function copyDevCommands() {
    await Clipboard.setStringAsync(DEV_BUILD_COMMANDS);
    Alert.alert('Copied', 'Development build commands copied to clipboard.');
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Confirm scanned medication</Text>
      <Text style={styles.subtitle}>Review and edit before saving</Text>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} /> : null}

      {ocrError ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Scanning requires the SimpliCare development build (not Expo Go).</Text>
          <Text style={styles.warningBody}>You can still continue by filling fields below or switching to manual add.</Text>
          <View style={styles.warningActions}>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
              <Text style={styles.secondaryButtonText}>Continue with manual add</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setShowDevBuildModal(true)}>
              <Text style={styles.ghostButtonText}>Learn how to enable scanning</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Medication name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Required" style={styles.input} />
        {confidence.name === 'low' ? (
          <Text style={styles.lowConfidenceText}>From label (low confidence). Please verify.</Text>
        ) : null}
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Strength</Text>
        <TextInput
          value={strength}
          onChangeText={setStrength}
          placeholder="e.g., 10 mg, 500 mg, 20 mcg, 5 mL"
          style={styles.input}
        />
        <Text style={styles.helperText}>What&apos;s printed on the label (dose strength).</Text>
        {confidence.strength === 'low' ? (
          <Text style={styles.lowConfidenceText}>Strength uncertainty detected. Please verify.</Text>
        ) : null}
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
        {confidence.instructions === 'low' ? (
          <Text style={styles.lowConfidenceText}>Instructions are uncertain. Edit as needed.</Text>
        ) : null}
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Dose times</Text>
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

      <Pressable style={styles.detectedTextToggle} onPress={() => setShowDetectedText((prev) => !prev)}>
        <Text style={styles.detectedTextToggleLabel}>
          {showDetectedText ? 'Hide detected text' : 'Show detected text'}
        </Text>
      </Pressable>

      {showDetectedText ? (
        <View style={styles.detectedTextCard}>
          <Text style={styles.detectedTextContent}>
            {rawText || (ocrLines && ocrLines.length > 0 ? ocrLines.join('\n') : 'No text detected.')}
          </Text>
        </View>
      ) : null}

      {__DEV__ ? (
        <Pressable style={styles.ghostButton} onPress={() => setRawText(SAMPLE_LABEL_TEXT)}>
          <Text style={styles.ghostButtonText}>Use sample label text</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.primaryButton, !canSave && styles.buttonDisabled]} onPress={() => void handleSave()} disabled={!canSave}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save medication'}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
        <Text style={styles.secondaryButtonText}>Edit manually</Text>
      </Pressable>

      <Modal visible={showDevBuildModal} transparent animationType="fade" onRequestClose={() => setShowDevBuildModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDevBuildModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Enable scanning (dev build)</Text>
            <Text style={styles.modalBody}>Run these commands to build and run the dev client:</Text>
            <View style={styles.commandBox}>
              <Text style={styles.commandText}>{DEV_BUILD_COMMANDS}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void copyDevCommands()}>
              <Text style={styles.primaryButtonText}>Copy commands</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowDevBuildModal(false)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: {
    fontSize: typography.body,
    color: '#9a3412',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  warningBody: {
    fontSize: typography.caption,
    color: '#9a3412',
    marginBottom: spacing.sm,
  },
  warningActions: {
    rowGap: spacing.sm,
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
  lowConfidenceText: {
    fontSize: typography.caption,
    color: '#9a3412',
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
  detectedTextToggle: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  detectedTextToggleLabel: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
  detectedTextCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detectedTextContent: {
    fontSize: typography.caption,
    color: '#475569',
    lineHeight: 20,
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ghostButtonText: {
    fontSize: typography.caption,
    color: '#475569',
    fontWeight: '600',
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
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorText: {
    fontSize: typography.caption,
    color: '#b91c1c',
    marginBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
  },
  modalTitle: {
    fontSize: typography.subtitle,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  modalBody: {
    fontSize: typography.caption,
    color: '#475569',
    marginBottom: spacing.sm,
  },
  commandBox: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  commandText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 18,
  },
});
