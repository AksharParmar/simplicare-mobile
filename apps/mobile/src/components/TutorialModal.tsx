import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddMedication: () => void;
};

export function TutorialModal({ visible, onClose, onAddMedication }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Quick start</Text>

          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Use the center + button to add medication quickly.</Text>
            <Text style={styles.bullet}>• Open My Medications to edit schedules and view history.</Text>
            <Text style={styles.bullet}>• Log Taken/Skipped on Home to keep reminders accurate.</Text>
          </View>

          <Pressable style={[styles.button, styles.primaryButton]} onPress={onClose}>
            <Text style={styles.primaryButtonText}>Got it</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.secondaryButton]} onPress={onAddMedication}>
            <Text style={styles.secondaryButtonText}>Add medication now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 16, 20, 0.42)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: spacing.lg,
    shadowColor: '#1f2937',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.md,
    color: '#111827',
  },
  bulletList: {
    marginBottom: spacing.lg,
    rowGap: spacing.sm,
  },
  bullet: {
    fontSize: typography.body,
    color: '#111827',
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
