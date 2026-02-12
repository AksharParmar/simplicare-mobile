import { NavigationProp } from '@react-navigation/native';
import { Button, StyleSheet, View } from 'react-native';

import { RootStackParamList, ScreenName } from '../navigation/types';
import { spacing } from '../theme/tokens';

type Props = {
  current: ScreenName;
  navigation: NavigationProp<RootStackParamList>;
};

const screenOrder: ScreenName[] = ['Today', 'AddMedication', 'Copilot', 'History', 'Settings'];

export function ScreenNavLinks({ current, navigation }: Props) {
  return (
    <View style={styles.container}>
      {screenOrder
        .filter((screen) => screen !== current)
        .map((screen) => (
          <View key={screen} style={styles.buttonWrap}>
            <Button title={`Go to ${screen}`} onPress={() => navigation.navigate(screen)} />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    rowGap: spacing.sm,
  },
  buttonWrap: {
    width: '100%',
  },
});
