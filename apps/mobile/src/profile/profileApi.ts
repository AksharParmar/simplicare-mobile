import { getSupabaseEnv } from '../config/env';
import { getSupabaseClient } from '../config/supabase';
import type { Profile } from './profileTypes';

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
};

const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();
const AVATARS_BUCKET = 'avatars';

type AvatarDebugContext = {
  userId: string | null;
  path?: string;
  assetUri?: string;
  assetMimeType?: string;
  contentType?: string;
};

type AvatarStorageProbeResult = {
  ok: boolean;
  message?: string;
};

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
  fileUri: string,
  mimeType?: string,
): Promise<string> {
  const client = getSupabaseClient();
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user?.id) {
    throw new Error('You must be signed in to upload an avatar.');
  }

  const uid = session.user.id;

  const response = await fetch(fileUri);
  const blob = await response.blob();
  const contentType = 'image/jpeg';
  const avatarPath = `${uid}/avatar.jpg`.trim();

  let { error } = await client.storage.from(AVATARS_BUCKET).upload(avatarPath, blob, {
    contentType,
    upsert: true,
  });

  if (error && /already exists|duplicate|conflict/i.test(error.message)) {
    await client.storage.from(AVATARS_BUCKET).remove([avatarPath]);
    const retry = await client.storage.from(AVATARS_BUCKET).upload(avatarPath, blob, {
      contentType,
      upsert: true,
    });
    error = retry.error;
  }

  if (error) {
    if (__DEV__) {
      const supabaseUrl = getSupabaseEnv().supabaseUrl;
      let projectHost = supabaseUrl;
      try {
        projectHost = new URL(supabaseUrl).host;
      } catch {
        projectHost = supabaseUrl;
      }

      console.log('[Profile] Avatar upload failed', {
        projectHost,
        bucket: AVATARS_BUCKET,
        uid,
        externalCallerUserId: null,
        path: avatarPath,
        contentType,
        suppliedMimeType: mimeType,
        name: error.name,
        status: 'status' in error ? (error as { status?: number }).status : undefined,
        statusCode: 'statusCode' in error ? (error as { statusCode?: string }).statusCode : undefined,
        message: error.message,
        raw: error,
      });
    }
    if (/bucket.*not found/i.test(error.message)) {
      throw new Error("Supabase bucket 'avatars' not found. Create it in Dashboard -> Storage.");
    }
    const status = 'status' in error ? (error as { status?: number }).status : undefined;
    const statusCode = 'statusCode' in error ? (error as { statusCode?: string }).statusCode : undefined;
    if (
      status === 401 ||
      status === 403 ||
      statusCode === '401' ||
      statusCode === '403' ||
      /\b401\b|\b403\b/.test(error.message)
    ) {
      throw new Error(
        "Storage blocked (401/403). Confirm you are signed in and storage policy allows bucket 'avatars' with path '<uid>/...'.",
      );
    }
    throw new Error(error.message);
  }

  avatarUrlCache.delete(avatarPath);
  return avatarPath;
}

export async function removeAvatarFile(avatarPath: string): Promise<void> {
  const client = getSupabaseClient();
  const cleanPath = avatarPath.trim();
  await client.storage.from(AVATARS_BUCKET).remove([cleanPath]);
  avatarUrlCache.delete(cleanPath);
}

export async function getAvatarUrl(
  avatarPath: string,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  const cleanPath = avatarPath.trim();

  if (options?.forceRefresh) {
    avatarUrlCache.delete(cleanPath);
  }

  const cached = avatarUrlCache.get(cleanPath);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const client = getSupabaseClient();
  if (__DEV__) {
    console.log('[Avatar] createSignedUrl path=', JSON.stringify(cleanPath));
  }

  const signed = await client.storage.from(AVATARS_BUCKET).createSignedUrl(cleanPath, 3600);
  if (!signed.error && signed.data?.signedUrl) {
    const signedWithVersion = `${signed.data.signedUrl}${signed.data.signedUrl.includes('?') ? '&' : '?'}v=${now}`;
    if (__DEV__) {
      console.log('[Avatar] signedUrl=', JSON.stringify(signed.data.signedUrl));
    }
    avatarUrlCache.set(cleanPath, {
      url: signedWithVersion,
      expiresAt: now + 5 * 60 * 1000,
    });
    return signedWithVersion;
  }

  const publicUrl = client.storage.from(AVATARS_BUCKET).getPublicUrl(cleanPath).data.publicUrl;
  if (!publicUrl) {
    throw new Error(signed.error?.message ?? 'Could not create avatar URL');
  }

  const cacheBusted = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${now}`;
  avatarUrlCache.set(cleanPath, {
    url: cacheBusted,
    expiresAt: now + 60 * 1000,
  });
  return cacheBusted;
}

export async function runAvatarStorageDebugProbe(userId: string): Promise<AvatarStorageProbeResult> {
  const client = getSupabaseClient();
  const path = `${userId}/avatar.jpg`.trim();
  const { data, error } = await client.storage.from(AVATARS_BUCKET).createSignedUrl(path, 60);
  if (error) {
    return {
      ok: false,
      message: `createSignedUrl failed: ${error.message}`,
    };
  }

  const signedUrl = data?.signedUrl;
  if (!signedUrl) {
    return {
      ok: false,
      message: 'Storage probe failed to generate a signed URL.',
    };
  }

  try {
    const res = await fetch(signedUrl);
    const bodyText = await res.text();
    const contentType = res.headers.get('content-type') ?? '(none)';
    if (!res.ok || /\"error\"/i.test(bodyText)) {
      const download = await client.storage.from(AVATARS_BUCKET).download(path);
      if (download.error) {
        return {
          ok: false,
          message: `Signed URL fetch failed (status=${res.status}, content-type=${contentType}, body=${bodyText.slice(0, 200)}). download() also failed: ${download.error.message}`,
        };
      }

      return {
        ok: false,
        message: `Signed URL fetch failed (status=${res.status}, content-type=${contentType}, body=${bodyText.slice(0, 200)}). download() succeeded; path is readable via SDK.`,
      };
    }
  } catch (fetchError) {
    const download = await client.storage.from(AVATARS_BUCKET).download(path);
    const fetchMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
    if (download.error) {
      return {
        ok: false,
        message: `Signed URL fetch error: ${fetchMessage}. download() failed: ${download.error.message}`,
      };
    }

    return {
      ok: false,
      message: `Signed URL fetch error: ${fetchMessage}. download() succeeded.`,
    };
  }

  return {
    ok: true,
  };
}

export function logAvatarStorageDebug(context: AvatarDebugContext): void {
  if (!__DEV__) {
    return;
  }

  const supabaseUrl = getSupabaseEnv().supabaseUrl;
  let projectHost = supabaseUrl;
  try {
    projectHost = new URL(supabaseUrl).host;
  } catch {
    projectHost = supabaseUrl;
  }

  console.log('[Profile] Avatar storage debug', {
    projectHost,
    userId: context.userId ?? 'guest',
    bucket: AVATARS_BUCKET,
    path: context.path ?? '(not set)',
    contentType: context.contentType ?? '(unknown)',
    assetMimeType: context.assetMimeType ?? '(unknown)',
    assetUri: context.assetUri ?? '(unknown)',
  });
}
