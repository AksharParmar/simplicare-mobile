import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '../theme/tokens';

type Props = {
  visible: boolean;
  initialText?: string;
  title?: string;
  onUseText: (text: string) => void;
  onClose: () => void;
};

export function PasteOcrTextModal({
  visible,
  initialText = '',
  title = 'Paste OCR text',
  onUseText,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) {
      setText(initialText);
    }
  }, [initialText, visible]);

  function handleUseText() {
    onUseText(text);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.modalAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <Pressable style={styles.backdrop} onPress={onClose}>
            <Pressable
              style={[styles.card, { marginBottom: Math.max(insets.bottom, spacing.sm) }]}
              onPress={() => undefined}
            >
              <Text style={styles.title}>{title}</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Paste OCR text"
                style={styles.input}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
              />
              <Pressable style={styles.primaryButton} onPress={handleUseText}>
                <Text style={styles.primaryButtonText}>Use this text</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalAvoiding: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    minHeight: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#0f172a',
    fontSize: typography.body,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
