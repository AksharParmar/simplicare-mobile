import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasteOcrTextModal } from '../components/PasteOcrTextModal';
import { AvatarImage } from '../components/AvatarImage';
import { RootStackParamList } from '../navigation/types';
import {
  cancelMedicationNotificationsForScope,
  cancelAllMedicationNotifications,
  getScheduledNotificationCount,
  rescheduleAllMedicationNotifications,
  scheduleTestNotificationInOneMinute,
} from '../notifications/notificationScheduler';
import { logAvatarStorageDebug, runAvatarStorageDebugProbe } from '../profile/profileApi';
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
  const { isGuest, session } = useAuth();
  const { prefs, updatePrefs } = usePreferences();
  const {
    profile,
    setAvatarFromPicker,
    removeAvatar,
    refreshAvatarUrl,
    loading: profileLoading,
    error: profileError,
  } =
    useProfile();

  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [isPasteModalVisible, setIsPasteModalVisible] = useState(false);
  const [devPastedText, setDevPastedText] = useState('');

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? '1.0.0', []);
  const displayName = profile?.displayName?.trim() || (isGuest ? 'Guest' : 'Not set');
  const subtitle = isGuest ? 'Guest mode' : session?.user?.email ?? 'Signed in';

  async function handleChangeAvatar() {
    await setAvatarFromPicker();
  }

  async function handleRemoveAvatar() {
    await removeAvatar();
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

  async function handleStorageDebugCheck() {
    const currentUserId = session?.user?.id ?? null;
    const path = currentUserId ? `${currentUserId}/avatar.jpg` : undefined;
    logAvatarStorageDebug({
      userId: currentUserId,
      path,
      contentType: 'image/jpeg',
    });

    if (!currentUserId) {
      setDevMessage('Storage Debug requires a signed-in user.');
      return;
    }

    const result = await runAvatarStorageDebugProbe(currentUserId);
    if (result.ok) {
      setDevMessage(`Avatar storage probe OK for path ${path}`);
      return;
    }

    setDevMessage(
      result.message ??
        "Storage policy blocked. Confirm Storage->avatars policies allow INSERT/UPDATE/SELECT for authenticated.",
    );
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
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Settings</Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileRow}>
          <AvatarImage
            size={56}
            uri={profile?.avatarUrl ?? null}
            fallbackText={displayName}
            onRetry={() => {
              void refreshAvatarUrl();
            }}
          />
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileSubtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.profileActionsRow}>
          <Pressable style={({ pressed }) => [styles.pillButton, pressed && styles.buttonPressed]} onPress={() => void handleChangeAvatar()}>
            <Text style={styles.pillButtonText}>{profile?.avatarPath ? 'Edit photo' : 'Add photo'}</Text>
          </Pressable>
          {profile?.avatarPath ? (
            <Pressable
              style={({ pressed }) => [styles.pillButtonDanger, pressed && styles.buttonPressed]}
              onPress={() => void handleRemoveAvatar()}
            >
              <Text style={styles.pillButtonDangerText}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        {profileLoading ? <Text style={styles.helperText}>Loading profile...</Text> : null}
        {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable style={styles.row} onPress={() => navigation.navigate('AccountSettings')}>
          <Text style={styles.rowLabel}>Account settings</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
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
        <Text style={styles.sectionTitle}>Notifications</Text>
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
          <Pressable style={styles.row} onPress={() => void handleStorageDebugCheck()}>
            <Text style={styles.rowLabel}>Avatar Storage Debug</Text>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileSubtitle: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  pillButtonDanger: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonDangerText: {
    color: '#b91c1c',
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
