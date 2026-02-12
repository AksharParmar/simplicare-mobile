import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'simplicare_prefs_v1';

export type Preferences = {
  displayName: string;
};

const DEFAULT_PREFS: Preferences = {
  displayName: '',
};

export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) {
    return DEFAULT_PREFS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      displayName: parsed.displayName ?? '',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function updatePreferences(partial: Partial<Preferences>): Promise<Preferences> {
  const current = await loadPreferences();
  const next = {
    ...current,
    ...partial,
  };
  await savePreferences(next);
  return next;
}
