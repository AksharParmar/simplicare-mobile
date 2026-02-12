import Constants from 'expo-constants';

type AppExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

function getExpoExtra(): AppExtra {
  return (Constants.expoConfig?.extra ?? {}) as AppExtra;
}

export function getSupabaseEnv(): { supabaseUrl: string; supabasePublishableKey: string } {
  const extra = getExpoExtra();
  const supabaseUrl = extra.supabaseUrl?.trim() ?? '';
  const supabasePublishableKey = extra.supabasePublishableKey?.trim() ?? '';

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env');
  }

  return { supabaseUrl, supabasePublishableKey };
}
