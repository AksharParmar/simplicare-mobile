import { BlurView } from 'expo-blur';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  medicationName: string;
  scheduledTime: string;
  instructions?: string;
  loading: boolean;
  snoozeMinutes: 5 | 10 | 15;
  onClose: () => void;
  onMarkTaken: () => void;
  onSkip: () => void;
  onSnooze: () => void;
};

export function DoseActionSheet({
  visible,
  medicationName,
  scheduledTime,
  instructions,
  loading,
  snoozeMinutes,
  onClose,
  onMarkTaken,
  onSkip,
  onSnooze,
}: Props) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={42} tint="light" style={styles.sheet}>
          <Pressable onPress={() => undefined}>
            <Text style={styles.title}>{medicationName}</Text>
            <Text style={styles.time}>Scheduled for {scheduledTime}</Text>
            {instructions ? <Text style={styles.instructions}>{instructions}</Text> : null}

            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={onMarkTaken}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>{loading ? 'Saving...' : 'Mark Taken'}</Text>
            </Pressable>

            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onSkip} disabled={loading}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>

            <Pressable style={[styles.button, styles.tertiaryButton]} onPress={onSnooze} disabled={loading}>
              <Text style={styles.tertiaryButtonText}>Snooze {snoozeMinutes} min</Text>
            </Pressable>
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  sheet: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.8)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: typography.body,
    color: '#334155',
    marginBottom: spacing.sm,
  },
  instructions: {
    fontSize: typography.caption,
    color: '#64748b',
    marginBottom: spacing.md,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe2ea',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: typography.button,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tertiaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
