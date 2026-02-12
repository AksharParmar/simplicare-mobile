import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Copilot'>;

export function CopilotScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Copilot</Text>
      <Text style={styles.body}>Source-grounded assistant placeholder.</Text>
      <ScreenNavLinks current="Copilot" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
  },
});
