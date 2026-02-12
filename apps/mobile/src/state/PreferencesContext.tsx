import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  loadPreferences,
  Preferences,
  updatePreferences as updatePreferencesInStore,
} from '../storage/preferencesStore';

type PreferencesContextValue = {
  prefs: Preferences;
  isLoadingPrefs: boolean;
  refreshPrefs: () => Promise<void>;
  updatePrefs: (partial: Partial<Preferences>) => Promise<void>;
};

const DEFAULT_PREFS: Preferences = {
  displayName: '',
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
    }),
    [prefs, isLoadingPrefs, refreshPrefs, updatePrefs],
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
