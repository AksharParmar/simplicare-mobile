import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  isGuest: boolean;
  onClose: () => void;
  onEditPhoto: () => void;
  onAccountSettings: () => void;
};

export function ProfileMenuPopup({
  visible,
  isGuest,
  onClose,
  onEditPhoto,
  onAccountSettings,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.popupWrap, { opacity, transform: [{ scale }] }]}>
          <BlurView intensity={45} tint="light" style={styles.popup}>
            <Text style={styles.title}>Profile</Text>

            <Pressable
              style={[styles.optionButton, isGuest && styles.disabledButton]}
              onPress={onEditPhoto}
              disabled={isGuest}
            >
              <Text style={[styles.optionText, isGuest && styles.disabledText]}>Edit profile photo</Text>
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
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: spacing.lg,
  },
  popupWrap: {
    width: 250,
    borderRadius: 18,
    overflow: 'hidden',
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
    minHeight: 48,
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
    minHeight: 44,
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
