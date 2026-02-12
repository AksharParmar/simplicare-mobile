export type StorageScope = { kind: 'guest' } | { kind: 'user'; userId: string };

export type AuthScopeInput = {
  isGuest: boolean;
  userId?: string | null;
};

export const GUEST_SCOPE: StorageScope = { kind: 'guest' };

export function scopeKey(scope: StorageScope): string {
  if (scope.kind === 'guest') {
    return 'guest';
  }

  return `user_${scope.userId}`;
}

export function parseScopeKey(value: string): StorageScope {
  if (value === 'guest') {
    return GUEST_SCOPE;
  }

  if (value.startsWith('user_')) {
    return {
      kind: 'user',
      userId: value.replace(/^user_/, ''),
    };
  }

  return GUEST_SCOPE;
}

export function getActiveScope(input: AuthScopeInput): StorageScope {
  if (!input.isGuest && input.userId) {
    return {
      kind: 'user',
      userId: input.userId,
    };
  }

  return GUEST_SCOPE;
}
