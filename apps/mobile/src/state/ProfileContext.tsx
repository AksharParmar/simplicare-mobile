import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AvatarCropEditorModal } from '../components/AvatarCropEditorModal';
import {
  getAvatarUrl,
  getOrCreateProfile,
  logAvatarStorageDebug,
  removeAvatarFile,
  updateProfile,
  uploadAvatar,
} from '../profile/profileApi';
import type { Profile } from '../profile/profileTypes';
import { useAuth } from './AuthContext';

const GUEST_PROFILE_KEY = 'simplicare_guest_profile_v1';

type ProfileView = Profile & {
  avatarUrl: string | null;
};

type ProfileContextValue = {
  profile: ProfileView | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  setAvatarFromPicker: () => Promise<void>;
  removeAvatar: () => Promise<void>;
  clearError: () => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

type CropResolved = {
  uri: string;
  mimeType: string;
};

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isGuest, user } = useAuth();

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cropVisible, setCropVisible] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const cropResolverRef = useRef<((value: CropResolved | null) => void) | null>(null);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isGuest) {
        const raw = await AsyncStorage.getItem(GUEST_PROFILE_KEY);
        let guestName = 'Guest';
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { displayName?: string };
            guestName = parsed.displayName?.trim() || 'Guest';
          } catch {
            guestName = 'Guest';
          }
        }

        setProfile({
          id: 'guest',
          displayName: guestName,
          avatarPath: null,
          avatarUrl: null,
        });
        return;
      }

      if (!user) {
        setProfile(null);
        return;
      }

      const remoteProfile = await getOrCreateProfile(user.id);
      const avatarUrl = remoteProfile.avatarPath ? await getAvatarUrl(remoteProfile.avatarPath) : null;

      setProfile({
        ...remoteProfile,
        avatarUrl,
      });
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [isGuest, user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const setDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      setError(null);

      if (isGuest) {
        const displayName = trimmed || 'Guest';
        await AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify({ displayName }));
        setProfile((prev) => ({
          id: 'guest',
          displayName,
          avatarPath: null,
          avatarUrl: null,
          ...prev,
        }));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (!user) {
        setError('Sign in to update profile.');
        return;
      }

      await updateProfile(user.id, { displayName: trimmed || null });
      await refreshProfile();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [isGuest, user, refreshProfile],
  );

  function openCropModal(imageUri: string): Promise<CropResolved | null> {
    setCropImageUri(imageUri);
    setCropVisible(true);

    return new Promise((resolve) => {
      cropResolverRef.current = resolve;
    });
  }

  const setAvatarFromPicker = useCallback(async () => {
    setError(null);

    if (isGuest || !user) {
      setError('Sign in to save a profile photo.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to choose an avatar.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (picked.canceled || !picked.assets[0]?.uri) {
      return;
    }

    const cropResult = await openCropModal(picked.assets[0].uri);
    if (!cropResult) {
      return;
    }

    try {
      logAvatarStorageDebug({
        userId: user.id,
        path: `${user.id}/avatar.jpg`,
        assetUri: cropResult.uri,
        assetMimeType: cropResult.mimeType,
        contentType: 'image/jpeg',
      });

      const avatarPath = await uploadAvatar(cropResult.uri, cropResult.mimeType);
      await updateProfile(user.id, { avatarPath });
      await refreshProfile();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (uploadError) {
      const reason = uploadError instanceof Error ? uploadError.message : 'Failed to update profile photo.';
      setError(reason);
      Alert.alert('Upload failed', reason);
    }
  }, [isGuest, user, refreshProfile]);

  const removeAvatar = useCallback(async () => {
    setError(null);

    if (isGuest || !user) {
      setError('Sign in to manage a profile photo.');
      return;
    }

    if (!profile?.avatarPath) {
      return;
    }

    try {
      await removeAvatarFile(profile.avatarPath);
      await updateProfile(user.id, { avatarPath: null });
      await refreshProfile();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove profile photo.');
    }
  }, [isGuest, user, profile?.avatarPath, refreshProfile]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      refreshProfile,
      setDisplayName,
      setAvatarFromPicker,
      removeAvatar,
      clearError: () => setError(null),
    }),
    [profile, loading, error, refreshProfile, setDisplayName, setAvatarFromPicker, removeAvatar],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
      <AvatarCropEditorModal
        visible={cropVisible}
        imageUri={cropImageUri}
        onCancel={() => {
          setCropVisible(false);
          setCropImageUri(null);
          cropResolverRef.current?.(null);
          cropResolverRef.current = null;
        }}
        onSave={(result) => {
          setCropVisible(false);
          setCropImageUri(null);
          cropResolverRef.current?.(result);
          cropResolverRef.current = null;
        }}
      />
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }

  return context;
}
