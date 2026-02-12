import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { getSupabaseEnv } from './env';

const SUPABASE_STORAGE_PREFIX = 'sb-auth-';

const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(`${SUPABASE_STORAGE_PREFIX}${key}`);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(`${SUPABASE_STORAGE_PREFIX}${key}`, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(`${SUPABASE_STORAGE_PREFIX}${key}`);
  },
};

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
