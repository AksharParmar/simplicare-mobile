import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREFS_KEY = 'simplicare_prefs_v1';

export type Preferences = {
  displayName: string;
  remindersEnabled: boolean;
  defaultSnoozeMinutes: 5 | 10 | 15;
};

export const DEFAULT_PREFS: Preferences = {
  displayName: '',
  remindersEnabled: true,
  defaultSnoozeMinutes: 10,
};

export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) {
    return DEFAULT_PREFS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const snooze = parsed.defaultSnoozeMinutes;
    const safeSnooze = snooze === 5 || snooze === 10 || snooze === 15 ? snooze : 10;

    return {
      displayName: parsed.displayName ?? '',
      remindersEnabled: parsed.remindersEnabled ?? true,
      defaultSnoozeMinutes: safeSnooze,
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
  const next: Preferences = {
    ...current,
    ...partial,
    defaultSnoozeMinutes:
      partial.defaultSnoozeMinutes === 5 ||
      partial.defaultSnoozeMinutes === 10 ||
      partial.defaultSnoozeMinutes === 15
        ? partial.defaultSnoozeMinutes
        : current.defaultSnoozeMinutes,
  };
  await savePreferences(next);
  return next;
}

export async function resetPreferences(): Promise<Preferences> {
  await savePreferences(DEFAULT_PREFS);
  return DEFAULT_PREFS;
}
