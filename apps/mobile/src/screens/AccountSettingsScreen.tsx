import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSupabaseClient } from '../config/supabase';
import { useAuth } from '../state/AuthContext';
import { usePreferences } from '../state/PreferencesContext';
import { useProfile } from '../state/ProfileContext';
import { radius, spacing, typography } from '../theme/tokens';

export function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isGuest, session, logout, exitGuest } = useAuth();
  const { profile, setDisplayName } = useProfile();
  const { updatePrefs } = usePreferences();

  const [displayName, setDisplayNameInput] = useState(profile?.displayName ?? '');
  const [emailInput, setEmailInput] = useState(session?.user?.email ?? '');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  useEffect(() => {
    setDisplayNameInput(profile?.displayName ?? '');
  }, [profile?.displayName]);

  useEffect(() => {
    setEmailInput(session?.user?.email ?? '');
  }, [session?.user?.email]);

  async function handleSaveDisplayName() {
    const value = displayName.trim();
    await setDisplayName(value);
    await updatePrefs({ displayName: value || (isGuest ? 'Guest' : '') });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        <Text style={styles.title}>Account</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayNameInput}
            placeholder={isGuest ? 'Guest' : 'Your name'}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => void handleSaveDisplayName()}
          />
          <Pressable style={styles.primaryButton} onPress={() => void handleSaveDisplayName()}>
            <Text style={styles.primaryButtonText}>Save display name</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Email</Text>
          {isGuest ? (
            <Text style={styles.helperText}>Sign in to manage account email.</Text>
          ) : (
            <>
              <Text style={styles.rowValue}>Current: {session?.user?.email ?? 'Unknown'}</Text>
              <TextInput
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable style={styles.primaryButton} onPress={() => void handleChangeEmail()}>
                <Text style={styles.primaryButtonText}>Change email</Text>
              </Pressable>
              {emailStatus ? <Text style={styles.helperText}>{emailStatus}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Password</Text>
          {isGuest ? (
            <Text style={styles.helperText}>Sign in to manage password.</Text>
          ) : (
            <>
              <TextInput
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="New password"
                secureTextEntry
                style={styles.input}
              />
              <Pressable style={styles.primaryButton} onPress={() => void handleChangePassword()}>
                <Text style={styles.primaryButtonText}>Change password</Text>
              </Pressable>
              {passwordStatus ? <Text style={styles.helperText}>{passwordStatus}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Auth</Text>
          {isGuest ? (
            <Pressable style={styles.primaryButton} onPress={() => void exitGuest()}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.destructiveButton} onPress={() => void logout()}>
              <Text style={styles.destructiveButtonText}>Log out</Text>
            </Pressable>
          )}
        </View>
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
  rowValue: {
    fontSize: typography.caption,
    color: '#64748b',
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
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  destructiveButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonText: {
    color: '#b91c1c',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  helperText: {
    fontSize: typography.caption,
    color: '#64748b',
  },
});
