import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasteOcrTextModal } from '../components/PasteOcrTextModal';
import { RootStackParamList } from '../navigation/types';
import {
  cancelAllMedicationNotifications,
  getScheduledNotificationCount,
  rescheduleAllMedicationNotifications,
  scheduleTestNotificationInOneMinute,
} from '../notifications/notificationScheduler';
import { useAppState } from '../state/AppStateContext';
import { usePreferences } from '../state/PreferencesContext';
import { STORE_KEY } from '../storage/localStore';
import { PREFS_KEY } from '../storage/preferencesStore';
import { resetTutorialFlag, TUTORIAL_SEEN_KEY } from '../storage/tutorialStore';
import { radius, spacing, typography } from '../theme/tokens';

const SNOOZE_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { state, resetState } = useAppState();
  const { prefs, updatePrefs } = usePreferences();

  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(prefs.displayName);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [isPasteModalVisible, setIsPasteModalVisible] = useState(false);
  const [devPastedText, setDevPastedText] = useState('');

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? '1.0.0', []);

  function openNameModal() {
    setNameInput(prefs.displayName);
    setIsNameModalVisible(true);
  }

  async function saveName() {
    await updatePrefs({ displayName: nameInput.trim() });
    setIsNameModalVisible(false);
  }

  async function handleToggleReminders(next: boolean) {
    await updatePrefs({ remindersEnabled: next });

    if (next) {
      await rescheduleAllMedicationNotifications(state);
      return;
    }

    await cancelAllMedicationNotifications();
  }

  async function handleSelectSnooze(minutes: 5 | 10 | 15) {
    await updatePrefs({ defaultSnoozeMinutes: minutes });
  }

  async function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      medications: state.medications,
      schedules: state.schedules,
      doseLogs: state.doseLogs,
      preferences: prefs,
    };

    await Share.share({
      title: 'SimpliCare data export',
      message: JSON.stringify(payload, null, 2),
    });
  }

  function confirmDeleteAllData() {
    Alert.alert(
      'Delete all local data?',
      'This removes medications, schedules, logs, preferences, and tutorial state from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await cancelAllMedicationNotifications();
              await AsyncStorage.multiRemove([
                STORE_KEY,
                PREFS_KEY,
                TUTORIAL_SEEN_KEY,
                'simplicare_has_seen_welcome_v1',
              ]);
              await resetState();
              await updatePrefs({
                displayName: '',
                remindersEnabled: true,
                defaultSnoozeMinutes: 10,
                saveScanTextLocally: false,
              });

              Alert.alert('Data cleared', 'Your app is reset to a clean local state.');
            })();
          },
        },
      ],
    );
  }

  async function handleShowTutorialAgain() {
    await resetTutorialFlag();
    Alert.alert('Tutorial reset', 'Quick start will appear next app launch.');
  }

  async function handleTestNotification() {
    await scheduleTestNotificationInOneMinute();
    const scheduledCount = await getScheduledNotificationCount();
    setDevMessage(`Test reminder scheduled. Total scheduled: ${scheduledCount}`);
  }

  function handleUseDevText(text: string) {
    const value = text.trim();
    setDevPastedText(value);
    if (!value) {
      return;
    }

    navigation.navigate('ConfirmScanMedication', {
      rawText: value,
      source: 'pasted',
    });
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Pressable style={styles.row} onPress={openNameModal}>
          <Text style={styles.rowLabel}>Display name</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{prefs.displayName.trim() || 'Not set'}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Reminders enabled</Text>
          <Switch
            value={prefs.remindersEnabled}
            onValueChange={(next) => {
              void handleToggleReminders(next);
            }}
            trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }}
            thumbColor={prefs.remindersEnabled ? '#2563eb' : '#ffffff'}
          />
        </View>

        <View style={styles.snoozeWrap}>
          <Text style={styles.rowLabel}>Default snooze</Text>
          <View style={styles.segmentedWrap}>
            {SNOOZE_OPTIONS.map((minutes) => {
              const active = prefs.defaultSnoozeMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  style={[styles.segmentedItem, active && styles.segmentedItemActive]}
                  onPress={() => {
                    void handleSelectSnooze(minutes);
                  }}
                >
                  <Text style={[styles.segmentedLabel, active && styles.segmentedLabelActive]}>
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Quiet hours</Text>
          <Text style={styles.rowValue}>Coming soon</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Save scan text locally</Text>
          <Switch
            value={prefs.saveScanTextLocally}
            onValueChange={(next) => {
              void updatePrefs({ saveScanTextLocally: next });
            }}
            trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }}
            thumbColor={prefs.saveScanTextLocally ? '#2563eb' : '#ffffff'}
          />
        </View>
        <Text style={styles.helperText}>When off, scan text is used only to fill the form and then discarded.</Text>

        <Pressable style={styles.row} onPress={() => void handleExportData()}>
          <Text style={styles.rowLabel}>Export my data</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={confirmDeleteAllData}>
          <Text style={[styles.rowLabel, styles.destructiveLabel]}>Delete all local data</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Help</Text>
        <Pressable style={styles.row} onPress={() => void handleShowTutorialAgain()}>
          <Text style={styles.rowLabel}>Show tutorial again</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{appVersion}</Text>
        </View>
        <Text style={styles.aboutText}>SimpliCare keeps medication management local-first and privacy friendly.</Text>
      </View>

      {__DEV__ ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Pressable style={styles.row} onPress={() => setIsPasteModalVisible(true)}>
            <Text style={styles.rowLabel}>Paste OCR text (Dev)</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => void handleTestNotification()}>
            <Text style={styles.rowLabel}>Test notification in 1 minute</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Text style={styles.devHelper}>Developer tools</Text>
          {devPastedText ? <Text style={styles.devMessage}>Loaded OCR text ({devPastedText.length} chars)</Text> : null}
          {devMessage ? <Text style={styles.devMessage}>{devMessage}</Text> : null}
        </View>
      ) : null}

      <Modal
        visible={isNameModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsNameModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setIsNameModalVisible(false)}>
              <Pressable
                style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}
                onPress={() => undefined}
              >
                <Text style={styles.modalTitle}>Display name</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Your name"
                  style={styles.modalInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalSecondaryButton} onPress={() => setIsNameModalVisible(false)}>
                    <Text style={styles.modalSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.modalPrimaryButton} onPress={() => void saveName()}>
                    <Text style={styles.modalPrimaryText}>Save</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <PasteOcrTextModal
        visible={isPasteModalVisible}
        initialText={devPastedText}
        title="Paste OCR text (Dev)"
        onUseText={handleUseDevText}
        onClose={() => setIsPasteModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: spacing.sm,
  },
  rowStatic: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: spacing.sm,
  },
  rowLabel: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    fontSize: typography.body,
    color: '#64748b',
  },
  chevron: {
    fontSize: 20,
    color: '#94a3b8',
    marginTop: -1,
  },
  snoozeWrap: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    overflow: 'hidden',
  },
  segmentedItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  segmentedItemActive: {
    backgroundColor: '#0f172a',
  },
  segmentedLabel: {
    color: '#475569',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  segmentedLabelActive: {
    color: '#ffffff',
  },
  helperText: {
    fontSize: typography.caption,
    color: '#64748b',
  },
  destructiveLabel: {
    color: '#b91c1c',
  },
  aboutText: {
    fontSize: typography.caption,
    color: '#64748b',
    lineHeight: 18,
  },
  devHelper: {
    fontSize: typography.caption,
    color: '#64748b',
  },
  devMessage: {
    fontSize: typography.caption,
    color: '#334155',
  },
  modalAvoiding: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    padding: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.subtitle,
    color: '#0f172a',
    fontWeight: '700',
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    color: '#0f172a',
    fontSize: typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
