import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { typography } from '../theme/tokens';

type Props = {
  size: number;
  uri?: string;
  fallbackText?: string;
};

export function AvatarImage({ size, uri, fallbackText = 'G' }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoading(Boolean(uri));
  }, [uri]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {uri && !hasError ? (
        <ExpoImage
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="disk"
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
          onError={(event) => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      ) : (
        <Text style={styles.fallback}>{fallbackText.slice(0, 1).toUpperCase()}</Text>
      )}
      {isLoading ? <View style={styles.loadingOverlay} /> : null}
    </View>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '700',
  },
});
