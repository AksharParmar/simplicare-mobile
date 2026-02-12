import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasteOcrTextModal } from '../components/PasteOcrTextModal';
import { getSupabaseClient } from '../config/supabase';
import { RootStackParamList } from '../navigation/types';
import {
  cancelMedicationNotificationsForScope,
  cancelAllMedicationNotifications,
  getScheduledNotificationCount,
  rescheduleAllMedicationNotifications,
  scheduleTestNotificationInOneMinute,
} from '../notifications/notificationScheduler';
import { useAppState } from '../state/AppStateContext';
import { useAuth } from '../state/AuthContext';
import { usePreferences } from '../state/PreferencesContext';
import { useProfile } from '../state/ProfileContext';
import { clearAllScopedData } from '../storage/localStore';
import { PREFS_KEY } from '../storage/preferencesStore';
import { resetTutorialFlag, TUTORIAL_SEEN_KEY } from '../storage/tutorialStore';
import { radius, spacing, typography } from '../theme/tokens';

const SNOOZE_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { state, resetState, currentScope, syncStatus, syncError, retrySync, lastSyncedAt } =
    useAppState();
  const { isGuest, session, logout, exitGuest } = useAuth();
  const { prefs, updatePrefs } = usePreferences();
  const {
    profile,
    setDisplayName,
    setAvatarFromPicker,
    loading: profileLoading,
    error: profileError,
    clearError,
  } = useProfile();

  const [profileNameInput, setProfileNameInput] = useState('');
  const [emailInput, setEmailInput] = useState(session?.user?.email ?? '');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [isPasteModalVisible, setIsPasteModalVisible] = useState(false);
  const [devPastedText, setDevPastedText] = useState('');

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? '1.0.0', []);

  useEffect(() => {
    setProfileNameInput(profile?.displayName ?? '');
  }, [profile?.displayName]);

  useEffect(() => {
    setEmailInput(session?.user?.email ?? '');
  }, [session?.user?.email]);

  async function handleSaveProfileName() {
    const value = profileNameInput.trim();
    await setDisplayName(value);
    await updatePrefs({ displayName: value || (isGuest ? 'Guest' : '') });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleChangeAvatar() {
    clearError();
    await setAvatarFromPicker();
  }

  async function handleToggleReminders(next: boolean) {
    await updatePrefs({ remindersEnabled: next });

    if (next) {
      await rescheduleAllMedicationNotifications(currentScope, state);
      return;
    }

    await cancelMedicationNotificationsForScope(currentScope);
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
      profile,
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
              await clearAllScopedData();
              await AsyncStorage.multiRemove([
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

  async function handleGuestSignIn() {
    await exitGuest();
  }

  async function handleLogout() {
    await logout();
  }

  async function handleChangeEmail() {
    if (isGuest) {
      return;
    }

    const nextEmail = emailInput.trim();
    if (!nextEmail) {
      setEmailStatus('Email is required.');
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({ email: nextEmail });
    if (error) {
      setEmailStatus(error.message);
      return;
    }

    setEmailStatus('Email update requested. Please confirm from your inbox if required.');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleChangePassword() {
    if (isGuest) {
      return;
    }

    if (passwordInput.length < 8) {
      setPasswordStatus('Password must be at least 8 characters.');
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({ password: passwordInput });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }

    setPasswordStatus('Password updated successfully.');
    setPasswordInput('');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          {isGuest ? (
            <>
              <View style={styles.rowStatic}>
                <Text style={styles.rowLabel}>Status</Text>
                <Text style={styles.rowValue}>Guest mode</Text>
              </View>
              <Pressable style={styles.row} onPress={() => void handleGuestSignIn()}>
                <Text style={styles.rowLabel}>Sign in</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.rowStatic}>
                <Text style={styles.rowLabel}>Signed in as</Text>
                <Text style={styles.rowValue}>{session?.user?.email ?? 'Unknown account'}</Text>
              </View>
              <Pressable style={styles.row} onPress={() => void handleLogout()}>
                <Text style={[styles.rowLabel, styles.destructiveLabel]}>Log out</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </>
          )}

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Display name</Text>
            <TextInput
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              placeholder={profile?.displayName ?? (isGuest ? 'Guest' : 'Your name')}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void handleSaveProfileName()}
            />
            <Pressable style={styles.inlineButton} onPress={() => void handleSaveProfileName()}>
              <Text style={styles.inlineButtonText}>Save name</Text>
            </Pressable>
          </View>

          <View style={styles.rowStatic}>
            <Text style={styles.rowLabel}>Avatar photo</Text>
            <Pressable
              style={({ pressed }) => [styles.pillButton, pressed && styles.buttonPressed]}
              onPress={() => void handleChangeAvatar()}
            >
              <Text style={styles.pillButtonText}>Change photo</Text>
            </Pressable>
          </View>
          {profileLoading ? <Text style={styles.helperText}>Loading profile...</Text> : null}
          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          {!isGuest ? (
            <>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Change email</Text>
                <TextInput
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable style={styles.inlineButton} onPress={() => void handleChangeEmail()}>
                  <Text style={styles.inlineButtonText}>Update email</Text>
                </Pressable>
                {emailStatus ? <Text style={styles.helperText}>{emailStatus}</Text> : null}
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Change password</Text>
                <TextInput
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="New password"
                  secureTextEntry
                  style={styles.input}
                />
                <Pressable style={styles.inlineButton} onPress={() => void handleChangePassword()}>
                  <Text style={styles.inlineButtonText}>Update password</Text>
                </Pressable>
                {passwordStatus ? <Text style={styles.helperText}>{passwordStatus}</Text> : null}
              </View>
            </>
          ) : null}
        </View>

        {!isGuest ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Cloud Sync</Text>
            <View style={styles.rowStatic}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text style={styles.rowValue}>
                {syncStatus === 'syncing'
                  ? 'Syncing...'
                  : syncStatus === 'error'
                    ? 'Sync error'
                    : lastSyncedAt
                      ? 'Synced just now'
                      : 'Not synced yet'}
              </Text>
            </View>
            {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
            <Pressable style={styles.row} onPress={() => void retrySync()}>
              <Text style={styles.rowLabel}>Retry sync</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        ) : null}

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
          <Text style={styles.helperText}>
            When off, scan text is used only to fill the form and then discarded.
          </Text>

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
            <Pressable style={styles.row} onPress={() => setIsPasteModalVisible(true)}>
              <Text style={styles.rowLabel}>Paste OCR text (Dev)</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => void handleTestNotification()}>
              <Text style={styles.rowLabel}>Test notification in 1 minute</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Text style={styles.devHelper}>Developer tools</Text>
            {devPastedText ? (
              <Text style={styles.devMessage}>Loaded OCR text ({devPastedText.length} chars)</Text>
            ) : null}
            {devMessage ? <Text style={styles.devMessage}>{devMessage}</Text> : null}
          </View>
        ) : null}

        <PasteOcrTextModal
          visible={isPasteModalVisible}
          initialText={devPastedText}
          title="Paste OCR text (Dev)"
          onUseText={handleUseDevText}
          onClose={() => setIsPasteModalVisible(false)}
        />
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
  rowValue: {
    fontSize: typography.body,
    color: '#64748b',
  },
  chevron: {
    fontSize: 20,
    color: '#94a3b8',
    marginTop: -1,
  },
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.caption,
    color: '#64748b',
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    color: '#0f172a',
    fontSize: typography.body,
  },
  inlineButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButtonText: {
    color: '#ffffff',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  pillButton: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonText: {
    color: '#334155',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  errorText: {
    fontSize: typography.caption,
    color: '#b91c1c',
  },
  helperText: {
    fontSize: typography.caption,
    color: '#64748b',
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
  buttonPressed: {
    opacity: 0.85,
  },
});
