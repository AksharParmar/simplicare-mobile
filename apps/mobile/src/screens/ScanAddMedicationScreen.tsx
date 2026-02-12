import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { recognizeTextFromImage } from '../scan/ocr';
import { usePreferences } from '../state/PreferencesContext';
import { clearLastScanText, saveLastScanText } from '../storage/scanStore';
import { radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanAddMedication'>;

export function ScanAddMedicationScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const { prefs } = usePreferences();

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleCapture() {
    if (!cameraRef.current) {
      return;
    }

    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setCapturedUri(photo.uri);
    }
  }

  async function handleUsePhoto() {
    if (!capturedUri) {
      return;
    }

    setProcessing(true);
    try {
      const ocrResult = await recognizeTextFromImage(capturedUri);

      if ('text' in ocrResult) {
        if (prefs.saveScanTextLocally) {
          await saveLastScanText(ocrResult.text);
        } else {
          await clearLastScanText();
        }

        navigation.navigate('ConfirmScannedMedication', {
          imageUri: capturedUri,
          rawText: ocrResult.text,
          ocrLines: ocrResult.lines,
        });
      } else {
        navigation.navigate('ConfirmScannedMedication', {
          imageUri: capturedUri,
          rawText: '',
          ocrError: ocrResult.error,
        });
      }
    } finally {
      setProcessing(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>We need camera permission to scan a medication label.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
          <Text style={styles.secondaryButtonText}>Continue with manual add</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan label</Text>
      <Text style={styles.body}>Fill the frame with the medication label.</Text>

      {capturedUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: capturedUri }} style={styles.previewImage} />
        </View>
      ) : (
        <View style={styles.previewWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        </View>
      )}

      <View style={styles.actionsWrap}>
        {capturedUri ? (
          <>
            <Pressable style={styles.primaryButton} onPress={() => void handleUsePhoto()} disabled={processing}>
              <Text style={styles.primaryButtonText}>{processing ? 'Reading text...' : 'Use Photo'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setCapturedUri(null)} disabled={processing}>
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.primaryButton} onPress={() => void handleCapture()}>
              <Text style={styles.primaryButtonText}>Capture</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('ManualAddMedication')}>
              <Text style={styles.secondaryButtonText}>Continue with manual add</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.body,
    color: '#475569',
    marginBottom: spacing.md,
  },
  previewWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionsWrap: {
    marginTop: spacing.md,
    rowGap: spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.button,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
