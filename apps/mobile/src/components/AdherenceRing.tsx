import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { typography } from '../theme/tokens';

type Props = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  noData?: boolean;
};

export function AdherenceRing({ progress, size = 92, strokeWidth = 10, noData = false }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - clamped * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#dbe2ea"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#0f172a"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.labelWrap}>
        <Text style={styles.percent}>{noData ? '—' : `${Math.round(clamped * 100)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#0f172a',
  },
});
