import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_PREFS,
  loadPreferences,
  Preferences,
  resetPreferences,
  updatePreferences as updatePreferencesInStore,
} from '../storage/preferencesStore';

type PreferencesContextValue = {
  prefs: Preferences;
  isLoadingPrefs: boolean;
  refreshPrefs: () => Promise<void>;
  updatePrefs: (partial: Partial<Preferences>) => Promise<void>;
  resetPrefs: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);

  const refreshPrefs = useCallback(async () => {
    const loaded = await loadPreferences();
    setPrefs(loaded);
  }, []);

  const updatePrefs = useCallback(async (partial: Partial<Preferences>) => {
    const updated = await updatePreferencesInStore(partial);
    setPrefs(updated);
  }, []);

  const resetPrefsState = useCallback(async () => {
    const reset = await resetPreferences();
    setPrefs(reset);
  }, []);

  useEffect(() => {
    async function bootstrapPrefs() {
      const loaded = await loadPreferences();
      setPrefs(loaded);
      setIsLoadingPrefs(false);
    }

    void bootstrapPrefs();
  }, []);

  const value = useMemo(
    () => ({
      prefs,
      isLoadingPrefs,
      refreshPrefs,
      updatePrefs,
      resetPrefs: resetPrefsState,
    }),
    [prefs, isLoadingPrefs, refreshPrefs, updatePrefs, resetPrefsState],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }

  return context;
}
