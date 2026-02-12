import type { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabaseProvider } from '../auth/providers/supabaseProvider';
import { loadAuthPrefs, setGuestMode } from '../storage/authPrefs';
import { getActiveScope, StorageScope } from '../storage/scope';

type AuthContextValue = {
  loading: boolean;
  isGuest: boolean;
  activeScope: StorageScope;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<{ signedIn: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  exitGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    const subscription = supabaseProvider.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession) {
        setIsGuest(false);
      }
    });

    async function bootstrap() {
      const prefs = await loadAuthPrefs();
      const guestMode = prefs.isGuest;

      if (!mounted) {
        return;
      }

      setIsGuest(guestMode);

      if (!guestMode) {
        try {
          const restoredSession = await supabaseProvider.getSession();
          if (!mounted) {
            return;
          }

          setSession(restoredSession);
          setUser(restoredSession?.user ?? null);
        } catch {
          if (!mounted) {
            return;
          }

          setSession(null);
          setUser(null);
        }
      } else {
        setSession(null);
        setUser(null);
      }

      if (mounted) {
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const nextSession = await supabaseProvider.signInWithPassword(email.trim(), password);
    await setGuestMode(false);
    setIsGuest(false);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }

  async function signup(email: string, password: string): Promise<{ signedIn: boolean }> {
    const nextSession = await supabaseProvider.signUpWithPassword(email.trim(), password);
    await setGuestMode(false);
    setIsGuest(false);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    return { signedIn: Boolean(nextSession) };
  }

  async function logout(): Promise<void> {
    await supabaseProvider.signOut();
    await setGuestMode(false);
    setIsGuest(false);
    setSession(null);
    setUser(null);
  }

  async function resetPassword(email: string): Promise<void> {
    await supabaseProvider.resetPasswordForEmail(email.trim());
  }

  async function continueAsGuest(): Promise<void> {
    try {
      await supabaseProvider.signOut();
    } catch {
      // Ignore sign-out errors when there is no existing session.
    }

    await setGuestMode(true);
    setIsGuest(true);
    setSession(null);
    setUser(null);
  }

  async function exitGuest(): Promise<void> {
    await setGuestMode(false);
    setIsGuest(false);
    setSession(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      loading,
      isGuest,
      activeScope: getActiveScope({ isGuest, userId: user?.id }),
      user,
      session,
      login,
      signup,
      logout,
      resetPassword,
      continueAsGuest,
      exitGuest,
    }),
    [loading, isGuest, user, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
