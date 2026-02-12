import type { Session } from '@supabase/supabase-js';

import type { AuthProviderAdapter } from '../AuthProvider';
import { getSupabaseClient } from '../../config/supabase';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Authentication request failed.';
}

export const supabaseProvider: AuthProviderAdapter = {
  async getSession(): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  async signInWithPassword(email: string, password: string): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  async signUpWithPassword(email: string, password: string): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  },

  async signOut(): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(email);

    if (error) {
      throw new Error(error.message);
    }
  },

  onAuthStateChange(listener) {
    try {
      const client = getSupabaseClient();
      const { data } = client.auth.onAuthStateChange(listener);

      return {
        unsubscribe: () => data.subscription.unsubscribe(),
      };
    } catch (error) {
      const message = toErrorMessage(error);
      if (!message.includes('Missing Supabase config')) {
        throw error;
      }

      return {
        unsubscribe: () => undefined,
      };
    }
  },
};
