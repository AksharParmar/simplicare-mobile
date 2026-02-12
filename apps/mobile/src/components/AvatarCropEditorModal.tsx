import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, typography } from '../theme/tokens';

type CropResult = {
  uri: string;
  mimeType: string;
};

type Props = {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onSave: (result: CropResult) => void;
};

type TouchPoint = {
  x: number;
  y: number;
};

const MAX_SCALE = 4;
const MIN_SCALE = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function AvatarCropEditorModal({ visible, imageUri, onCancel, onSave }: Props) {
  const editorSize = Math.min(Dimensions.get('window').width - spacing.lg * 2, 320);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const [activeTouches, setActiveTouches] = useState<TouchPoint[]>([]);
  const [panStart, setPanStart] = useState<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [pinchStart, setPinchStart] = useState<{
    distance: number;
    midpointX: number;
    midpointY: number;
    scale: number;
    tx: number;
    ty: number;
  } | null>(null);

  useEffect(() => {
    if (!imageUri || !visible) {
      return;
    }

    Image.getSize(
      imageUri,
      (width, height) => {
        setImageSize({ width, height });
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      },
      () => {
        setImageSize(null);
      },
    );
  }, [imageUri, visible]);

  function handleTouchStart(touches: TouchPoint[]) {
    setActiveTouches(touches);

    if (touches.length === 1) {
      setPanStart({
        x: touches[0].x,
        y: touches[0].y,
        tx: translateX,
        ty: translateY,
      });
      setPinchStart(null);
      return;
    }

    if (touches.length >= 2) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      setPinchStart({
        distance: Math.sqrt(dx * dx + dy * dy),
        midpointX: (touches[0].x + touches[1].x) / 2,
        midpointY: (touches[0].y + touches[1].y) / 2,
        scale,
        tx: translateX,
        ty: translateY,
      });
      setPanStart(null);
    }
  }

  function handleTouchMove(touches: TouchPoint[]) {
    setActiveTouches(touches);

    if (touches.length === 1 && panStart) {
      const nextTx = panStart.tx + (touches[0].x - panStart.x);
      const nextTy = panStart.ty + (touches[0].y - panStart.y);
      setTranslateX(nextTx);
      setTranslateY(nextTy);
      return;
    }

    if (touches.length >= 2 && pinchStart) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const nextDistance = Math.sqrt(dx * dx + dy * dy);
      const ratio = nextDistance / pinchStart.distance;
      const nextScale = clamp(pinchStart.scale * ratio, MIN_SCALE, MAX_SCALE);

      const nextMidX = (touches[0].x + touches[1].x) / 2;
      const nextMidY = (touches[0].y + touches[1].y) / 2;

      setScale(nextScale);
      setTranslateX(pinchStart.tx + (nextMidX - pinchStart.midpointX));
      setTranslateY(pinchStart.ty + (nextMidY - pinchStart.midpointY));
    }
  }

  function handleTouchEnd() {
    if (activeTouches.length <= 1) {
      setPanStart(null);
      setPinchStart(null);
    }
  }

  async function handleSave() {
    if (!imageUri || !imageSize || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const baseScale = Math.max(editorSize / imageSize.width, editorSize / imageSize.height);
      const totalScale = baseScale * scale;

      const renderedWidth = imageSize.width * totalScale;
      const renderedHeight = imageSize.height * totalScale;

      const imageLeft = editorSize / 2 - renderedWidth / 2 + translateX;
      const imageTop = editorSize / 2 - renderedHeight / 2 + translateY;

      const cropWidthInSrc = editorSize / totalScale;
      const cropHeightInSrc = editorSize / totalScale;

      const originX = clamp((0 - imageLeft) / totalScale, 0, Math.max(0, imageSize.width - cropWidthInSrc));
      const originY = clamp((0 - imageTop) / totalScale, 0, Math.max(0, imageSize.height - cropHeightInSrc));

      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: Math.min(cropWidthInSrc, imageSize.width),
              height: Math.min(cropHeightInSrc, imageSize.height),
            },
          },
          { resize: { width: 512, height: 512 } },
        ],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      onSave({ uri: manipResult.uri, mimeType: 'image/jpeg' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Adjust photo</Text>
          <Text style={styles.subtitle}>Pinch to zoom and drag to position.</Text>

          <View
            style={[styles.editorFrame, { width: editorSize, height: editorSize }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              const touches = event.nativeEvent.touches.map((touch) => ({ x: touch.locationX, y: touch.locationY }));
              handleTouchStart(touches);
            }}
            onResponderMove={(event) => {
              const touches = event.nativeEvent.touches.map((touch) => ({ x: touch.locationX, y: touch.locationY }));
              handleTouchMove(touches);
            }}
            onResponderRelease={handleTouchEnd}
            onResponderTerminate={handleTouchEnd}
          >
            {imageUri && imageSize ? (
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: imageSize.width * Math.max(editorSize / imageSize.width, editorSize / imageSize.height),
                  height: imageSize.height * Math.max(editorSize / imageSize.width, editorSize / imageSize.height),
                  transform: [{ translateX }, { translateY }, { scale }],
                }}
              />
            ) : (
              <ActivityIndicator color="#0f172a" />
            )}
            <View style={styles.cropMask} pointerEvents="none">
              <View style={styles.cropCircle} />
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={isSaving || !imageUri}>
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: typography.caption,
    color: '#64748b',
  },
  editorFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropMask: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  cropCircle: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
