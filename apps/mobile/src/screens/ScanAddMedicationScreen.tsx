import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';
import { radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanAddMedication'>;

export function ScanAddMedicationScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan label (coming next)</Text>
      <Text style={styles.body}>Camera and OCR are planned for the next ticket.</Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('ManualAddMedication')}>
        <Text style={styles.buttonText}>Use manual add instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.body,
    color: '#475569',
    marginBottom: spacing.md,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
});
