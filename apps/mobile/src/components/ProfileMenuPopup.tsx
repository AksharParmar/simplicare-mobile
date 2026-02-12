import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  isGuest: boolean;
  hasAvatar: boolean;
  anchor?: { x: number; y: number; width: number; height: number } | null;
  onClose: () => void;
  onEditPhoto: () => void;
  onRemovePhoto: () => void;
  onAccountSettings: () => void;
};

export function ProfileMenuPopup({
  visible,
  isGuest,
  hasAvatar,
  anchor,
  onClose,
  onEditPhoto,
  onRemovePhoto,
  onAccountSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const screen = Dimensions.get('window');
  const menuWidth = Math.min(238, Math.max(220, screen.width - spacing.lg * 2));
  const defaultRight = spacing.lg;
  const fallbackTop = insets.top + 62;
  const preferredTop = (anchor?.y ?? fallbackTop) + (anchor?.height ?? 0) + spacing.sm;
  const maxTop = screen.height - insets.bottom - 280;
  const top = Math.min(preferredTop, Math.max(insets.top + spacing.sm, maxTop));
  const leftFromAnchor = anchor ? anchor.x + anchor.width - menuWidth : screen.width - defaultRight - menuWidth;
  const left = Math.max(spacing.md, Math.min(leftFromAnchor, screen.width - menuWidth - spacing.md));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 190,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.92);
    }
  }, [visible, opacity, scale]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.popupWrap,
            {
              width: menuWidth,
              top,
              left,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <BlurView intensity={45} tint="light" style={styles.popup}>
            <Text style={styles.title}>Profile</Text>

            <Pressable
              style={[styles.optionButton, isGuest && styles.disabledButton]}
              onPress={onEditPhoto}
              disabled={isGuest}
            >
              <Text style={[styles.optionText, isGuest && styles.disabledText]}>Change photo</Text>
            </Pressable>

            <Pressable
              style={[styles.optionButton, (isGuest || !hasAvatar) && styles.disabledButton]}
              onPress={onRemovePhoto}
              disabled={isGuest || !hasAvatar}
            >
              <Text style={[styles.optionText, (isGuest || !hasAvatar) && styles.disabledText]}>
                Remove photo
              </Text>
            </Pressable>

            {isGuest ? <Text style={styles.helper}>Sign in to save a photo</Text> : null}

            <Pressable style={styles.optionButton} onPress={onAccountSettings}>
              <Text style={styles.optionText}>Account settings</Text>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  popupWrap: {
    position: 'absolute',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  popup: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  optionButton: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.9)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  optionText: {
    fontSize: typography.body,
    color: '#0f172a',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.55,
  },
  disabledText: {
    color: '#64748b',
  },
  helper: {
    fontSize: typography.caption,
    color: '#64748b',
    marginBottom: spacing.sm,
  },
  cancelButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(241, 245, 249, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  cancelText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: '#334155',
  },
});
