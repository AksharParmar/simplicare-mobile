import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SCAN_TEXT_KEY = 'simplicare_last_scan_text_v1';

export async function saveLastScanText(text: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SCAN_TEXT_KEY, text);
}

export async function clearLastScanText(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SCAN_TEXT_KEY);
}
