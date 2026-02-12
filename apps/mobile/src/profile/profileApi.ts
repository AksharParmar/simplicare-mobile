import { getSupabaseClient } from '../config/supabase';
import type { Profile } from './profileTypes';

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
};

const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
  };
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, avatar_path')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return toProfile(data as ProfileRow);
  }

  const { data: inserted, error: insertError } = await client
    .from('profiles')
    .insert({ id: userId })
    .select('id, display_name, avatar_path')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return toProfile(inserted as ProfileRow);
}

export async function updateProfile(
  userId: string,
  patch: { displayName?: string | null; avatarPath?: string | null },
): Promise<Profile> {
  const client = getSupabaseClient();

  const payload: Record<string, unknown> = {};
  if (patch.displayName !== undefined) {
    payload.display_name = patch.displayName;
  }
  if (patch.avatarPath !== undefined) {
    payload.avatar_path = patch.avatarPath;
  }

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, display_name, avatar_path')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toProfile(data as ProfileRow);
}

export async function uploadAvatar(
  userId: string,
  fileUri: string,
  mimeType?: string,
): Promise<string> {
  const client = getSupabaseClient();

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const extension = mimeType?.includes('png') ? 'png' : 'jpg';
  const contentType = mimeType ?? (extension === 'png' ? 'image/png' : 'image/jpeg');
  const avatarPath = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error } = await client.storage.from('avatars').upload(avatarPath, blob, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return avatarPath;
}

export async function getAvatarSignedUrl(avatarPath: string): Promise<string> {
  const cached = avatarUrlCache.get(avatarPath);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const client = getSupabaseClient();
  const { data, error } = await client.storage.from('avatars').createSignedUrl(avatarPath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not create signed URL');
  }

  avatarUrlCache.set(avatarPath, {
    url: data.signedUrl,
    expiresAt: now + 5 * 60 * 1000,
  });

  return data.signedUrl;
}
