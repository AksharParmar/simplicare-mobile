import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_SEEN_KEY = 'simplicare_has_seen_welcome_v1';

export async function hasSeenWelcomeModal(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
  return raw === 'true';
}

export async function setHasSeenWelcomeModal(value: boolean): Promise<void> {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, value ? 'true' : 'false');
}

export async function resetWelcomeModalFlag(): Promise<void> {
  await AsyncStorage.removeItem(WELCOME_SEEN_KEY);
}
