import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenNavLinks } from '../components/ScreenNavLinks';
import { RootStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMedication'>;

export function AddMedicationScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Medication</Text>
      <Text style={styles.body}>Manual entry and scan-to-add placeholder screen.</Text>
      <ScreenNavLinks current="AddMedication" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.body,
  },
});
