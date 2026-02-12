import Constants from 'expo-constants';

type OCRSuccess = { text: string };
type OCRError = { error: string };

export async function recognizeTextFromImage(uri: string): Promise<OCRSuccess | OCRError> {
  if (!uri) {
    return { error: 'No image selected.' };
  }

  if (Constants.executionEnvironment === 'storeClient') {
    return { error: 'OCR not available in Expo Go. Build a dev client.' };
  }

  try {
    const module = require('@react-native-ml-kit/text-recognition');
    const textRecognition = module.default ?? module;

    if (!textRecognition || typeof textRecognition.recognize !== 'function') {
      return { error: 'OCR not available in Expo Go. Build a dev client.' };
    }

    const result = await textRecognition.recognize(uri);
    const text = typeof result?.text === 'string' ? result.text : '';

    if (!text.trim()) {
      return { error: 'No readable text found in this photo.' };
    }

    return { text };
  } catch {
    return { error: 'OCR not available in Expo Go. Build a dev client.' };
  }
}
