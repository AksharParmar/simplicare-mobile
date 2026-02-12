import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanLabel: () => void;
  onAddManual: () => void;
};

export function AddHubActionSheet({ visible, onClose, onScanLabel, onAddManual }: Props) {
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
        <Animated.View style={[styles.popup, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.title}>Add medication</Text>

          <Pressable style={styles.optionButton} onPress={onScanLabel}>
            <Text style={styles.optionText}>Scan label</Text>
          </Pressable>

          <Pressable style={styles.optionButton} onPress={onAddManual}>
            <Text style={styles.optionText}>Add manually</Text>
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 112,
    paddingHorizontal: spacing.lg,
  },
  popup: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.md,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  optionButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  optionText: {
    fontSize: typography.body,
    color: '#0f172a',
    fontWeight: '600',
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
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
