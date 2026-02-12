import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_PREFS_KEY = 'simplicare_auth_prefs_v1';

type AuthPrefs = {
  isGuest: boolean;
};

const DEFAULT_AUTH_PREFS: AuthPrefs = {
  isGuest: false,
};

export async function loadAuthPrefs(): Promise<AuthPrefs> {
  const raw = await AsyncStorage.getItem(AUTH_PREFS_KEY);
  if (!raw) {
    return DEFAULT_AUTH_PREFS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthPrefs>;
    return {
      isGuest: parsed.isGuest ?? false,
    };
  } catch {
    return DEFAULT_AUTH_PREFS;
  }
}

export async function setGuestMode(isGuest: boolean): Promise<void> {
  const next: AuthPrefs = { isGuest };
  await AsyncStorage.setItem(AUTH_PREFS_KEY, JSON.stringify(next));
}
