import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PasteOcrTextModal } from '../components/PasteOcrTextModal';
import { RootStackParamList } from '../navigation/types';
import { radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanAddMedication'>;

export function ScanAddMedicationScreen({ navigation }: Props) {
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [devRawText, setDevRawText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showOcrUnavailable, setShowOcrUnavailable] = useState(false);

  const canContinue = Boolean(imageUri) || (__DEV__ && devRawText.trim().length > 0);

  async function handleImportPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setImageUri(result.assets[0].uri);
    setShowOcrUnavailable(false);
  }

  function handleContinue() {
    const trimmedText = devRawText.trim();

    if (__DEV__ && trimmedText.length > 0) {
      navigation.navigate('ConfirmScanMedication', {
        rawText: trimmedText,
        source: 'pasted',
        imageUri,
      });
      return;
    }

    if (imageUri) {
      setShowOcrUnavailable(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Scan label</Text>
        <Text style={styles.subtitle}>
          Import a label photo now. OCR module can be plugged in later without changing this flow.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Import label photo</Text>
          <Text style={styles.cardBody}>Pick one image from your library. The image stays on-device and is not uploaded.</Text>

          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => void handleImportPhoto()}
          >
            <Text style={styles.primaryButtonText}>{imageUri ? 'Replace photo' : 'Import label photo'}</Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Developer helper</Text>
            <Text style={styles.cardBody}>Paste OCR text to simulate extraction and test the full confirm/save flow in simulator.</Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => setShowPasteModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Paste OCR text (Dev)</Text>
            </Pressable>
            {devRawText.trim() ? <Text style={styles.devSummary}>OCR text ready ({devRawText.trim().length} chars)</Text> : null}
          </View>
        ) : null}

        {showOcrUnavailable ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>OCR isn&apos;t enabled on iOS without a dev build.</Text>
            <Text style={styles.warningBody}>
              You can still test parsing by pasting text in development or continue with manual entry.
            </Text>
            {__DEV__ ? (
              <Pressable style={styles.secondaryButton} onPress={() => setShowPasteModal(true)}>
                <Text style={styles.secondaryButtonText}>Paste text (Dev)</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
              <Text style={styles.secondaryButtonText}>Add manually</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.continueButton, !canContinue && styles.disabledButton, pressed && styles.buttonPressed]}
          disabled={!canContinue}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </ScrollView>

      <PasteOcrTextModal
        visible={showPasteModal}
        initialText={devRawText}
        title="Paste OCR text (Dev)"
        onUseText={(text) => {
          setDevRawText(text);
          setShowOcrUnavailable(false);
        }}
        onClose={() => setShowPasteModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: '#f8fafc',
    gap: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: typography.body,
    color: '#475569',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardBody: {
    fontSize: typography.caption,
    color: '#64748b',
    lineHeight: 18,
  },
  previewWrap: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe2ea',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  primaryButton: {
    minHeight: 54,
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
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
  devSummary: {
    fontSize: typography.caption,
    color: '#475569',
  },
  warningCard: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningTitle: {
    fontSize: typography.body,
    color: '#9a3412',
    fontWeight: '700',
  },
  warningBody: {
    fontSize: typography.caption,
    color: '#9a3412',
  },
  continueButton: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
