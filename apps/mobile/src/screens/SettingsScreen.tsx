import AsyncStorage from '@react-native-async-storage/async-storage';
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

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { state, resetState } = useAppState();
  const { prefs, updatePrefs } = usePreferences();

  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(prefs.displayName);
  const [devMessage, setDevMessage] = useState<string | null>(null);

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
        <Text style={styles.aboutText}>
          SimpliCare keeps medication management local-first and privacy friendly.
        </Text>
      </View>

      {__DEV__ ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Pressable style={styles.row} onPress={() => void handleTestNotification()}>
            <Text style={styles.rowLabel}>Test notification in 1 minute</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Text style={styles.devHelper}>Developer tool</Text>
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
              <Pressable style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, spacing.sm) }]} onPress={() => undefined}>
                <Text style={styles.modalTitle}>Display name</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Enter your name"
                  style={styles.input}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => void saveName()}
                />
                <Pressable style={styles.primaryButton} onPress={() => void saveName()}>
                  <Text style={styles.primaryButtonText}>Save</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setIsNameModalVisible(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.md,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowStatic: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: typography.body,
    color: '#0f172a',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: typography.caption,
    color: '#64748b',
    marginRight: spacing.xs,
  },
  chevron: {
    fontSize: 24,
    color: '#94a3b8',
    marginTop: -2,
  },
  destructiveLabel: {
    color: '#b91c1c',
  },
  snoozeWrap: {
    paddingVertical: spacing.xs,
  },
  segmentedWrap: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentedItem: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  segmentedItemActive: {
    backgroundColor: '#0f172a',
  },
  segmentedLabel: {
    fontSize: typography.caption,
    color: '#334155',
    fontWeight: '700',
  },
  segmentedLabelActive: {
    color: '#ffffff',
  },
  devHelper: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  devMessage: {
    fontSize: typography.caption,
    color: '#334155',
    marginTop: spacing.xs,
  },
  aboutText: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  modalAvoiding: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.md,
  },
  modalTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    marginBottom: spacing.md,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
