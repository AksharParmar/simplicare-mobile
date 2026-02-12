import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

export type AuthProviderAdapter = {
  getSession: () => Promise<Session | null>;
  signInWithPassword: (email: string, password: string) => Promise<Session | null>;
  signUpWithPassword: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  onAuthStateChange: (listener: AuthStateListener) => { unsubscribe: () => void };
};
