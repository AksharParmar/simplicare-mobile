import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { typography } from '../theme/tokens';

type Props = {
  size: number;
  uri?: string | null;
  fallbackText?: string;
  onPress?: () => void;
  onRetry?: () => void;
};

export function AvatarImage({ size, uri, fallbackText = 'G', onPress, onRetry }: Props) {
  const hasRetriedRef = useRef(false);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const Wrapper = onPress ? Pressable : View;
  const finalUri = useMemo(() => {
    if (!uri) {
      return undefined;
    }
    const sep = uri.includes('?') ? '&' : '?';
    return `${uri}${sep}v=${cacheBust}`;
  }, [uri, cacheBust]);

  useEffect(() => {
    if (uri) {
      hasRetriedRef.current = false;
      setCacheBust(Date.now());
    }
  }, [uri]);

  if (__DEV__) {
    console.log('[AvatarImage] render', { uri, finalUri });
  }

  function handleError(error: unknown) {
    if (__DEV__) {
      console.log('[AvatarImage] onError=', JSON.stringify(error));
    }

    if (!onRetry || hasRetriedRef.current) {
      return;
    }

    hasRetriedRef.current = true;
    setCacheBust(Date.now());
    onRetry();
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
      {finalUri ? (
        <Image
          key={finalUri ?? 'no-avatar'}
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
