import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIAL_SEEN_KEY = 'simplicare_has_seen_tutorial_v1';

export async function hasSeenTutorial(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(TUTORIAL_SEEN_KEY);
  return raw === 'true';
}

export async function setHasSeenTutorial(value: boolean): Promise<void> {
  await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, value ? 'true' : 'false');
}

export async function resetTutorialFlag(): Promise<void> {
  await AsyncStorage.removeItem(TUTORIAL_SEEN_KEY);
}
