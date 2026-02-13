import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { typography } from '../theme/tokens';

type Props = {
  size: number;
  uri?: string;
  fallbackText?: string;
  onPress?: () => void;
  onRetry?: () => void;
  forceRefreshToken?: number;
};

export function AvatarImage({
  size,
  uri,
  fallbackText = 'G',
  onPress,
  onRetry,
  forceRefreshToken,
}: Props) {
  const hasRetriedRef = useRef(false);
  const [retryToken, setRetryToken] = useState<number | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const Wrapper = onPress ? Pressable : View;
  const finalUri = useMemo(() => {
    if (!uri) {
      return undefined;
    }

    if (retryToken) {
      const sep = uri.includes('?') ? '&' : '?';
      return `${uri}${sep}retry=${retryToken}`;
    }

    if (forceRefreshToken) {
      const sep = uri.includes('?') ? '&' : '?';
      return `${uri}${sep}v=${forceRefreshToken}`;
    }

    return uri;
  }, [uri, retryToken, forceRefreshToken]);

  if (__DEV__) {
    console.log('[AvatarImage] render', { uri, finalUri });
  }

  useEffect(() => {
    hasRetriedRef.current = false;
    setRetryToken(null);
    setShowFallback(false);
  }, [uri, forceRefreshToken]);

  function handleError(error: unknown) {
    if (__DEV__) {
      console.log('[AvatarImage] onError=', JSON.stringify(error));
    }

    if (hasRetriedRef.current) {
      setShowFallback(true);
      return;
    }

    hasRetriedRef.current = true;
    setRetryToken(Date.now());
    onRetry?.();
  }

  return (
    <Wrapper
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      onPress={onPress}
    >
      {!showFallback && finalUri ? (
        <Image
          key={uri ?? 'placeholder'}
          source={{ uri: finalUri }}
          style={styles.image}
          onError={(event) => handleError(event.nativeEvent)}
        />
      ) : (
        <Text style={styles.fallback}>{fallbackText.slice(0, 1).toUpperCase()}</Text>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '700',
  },
});
