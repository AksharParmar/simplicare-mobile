import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../state/PreferencesContext';
import { resetTutorialFlag } from '../storage/tutorialStore';
import { radius, spacing, typography } from '../theme/tokens';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { prefs, updatePrefs } = usePreferences();

  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(prefs.displayName);

  const appVersion = useMemo(() => Constants.expoConfig?.version ?? '1.0.0', []);

  function openNameModal() {
    setNameInput(prefs.displayName);
    setIsNameModalVisible(true);
  }

  async function saveName() {
    await updatePrefs({ displayName: nameInput.trim() });
    setIsNameModalVisible(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
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
          <Text style={styles.rowLabel}>Notification schedule</Text>
          <Text style={styles.rowValue}>Enabled</Text>
        </View>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Snooze duration</Text>
          <Text style={styles.rowValue}>10 minutes</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <Pressable style={styles.row} onPress={() => void resetTutorialFlag()}>
          <Text style={styles.rowLabel}>Reset tutorial</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Export data</Text>
          <Text style={styles.rowValue}>Coming soon</Text>
        </View>
        <View style={styles.rowStatic}>
          <Text style={styles.rowLabel}>Delete local data</Text>
          <Text style={styles.rowValue}>Coming soon</Text>
        </View>
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

      <Modal
        visible={isNameModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsNameModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsNameModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Display name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter your name"
              style={styles.input}
              autoCapitalize="words"
            />
            <Pressable style={styles.primaryButton} onPress={() => void saveName()}>
              <Text style={styles.primaryButtonText}>Save</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setIsNameModalVisible(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
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
    minHeight: 44,
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
  aboutText: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
    lineHeight: 20,
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
