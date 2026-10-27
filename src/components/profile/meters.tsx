import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '@/lib/appearance';
import { latinFont } from '@/lib/theme';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function WeekChart({ counts }: { counts: number[] }) {
  const palette = useColors();
  const peak = Math.max(1, ...counts);
  return (
    <View style={styles.chart}>
      {DAYS.map((day, index) => {
        const value = counts[index] ?? 0;
        const height = Math.max(4, Math.round((value / peak) * 72));
        return (
          <View key={day} style={styles.col}>
            <Text style={[styles.count, { color: palette.muted }]}>{value}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, { height, backgroundColor: value ? '#66BB6A' : palette.line }]} />
            </View>
            <Text style={[styles.day, { color: palette.text }]}>{day}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function XpGauge({ level, into, band }: { level: number; into: number; band: number }) {
  const palette = useColors();
  const size = 132;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = band > 0 ? into / band : 0;
  const percent = Math.round(ratio * 1000) / 10;
  const offset = circumference * (1 - ratio);
  return (
    <View style={styles.gauge}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={palette.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#66BB6A"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.gaugeLabel}>
        <Text style={[styles.level, { color: palette.primary }]}>Level {level}</Text>
        <Text style={[styles.percent, { color: palette.text }]}>{percent}%</Text>
      </View>
      <Text style={[styles.xp, { color: palette.muted }]}>{into.toLocaleString('id-ID')} / {band.toLocaleString('id-ID')} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, minHeight: 120 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: { height: 72, justifyContent: 'flex-end' },
  bar: { width: 14, borderRadius: 7 },
  count: { ...latinFont, fontSize: 11, color: '#5C564C' },
  day: { ...latinFont, fontSize: 11, fontWeight: '700', color: '#1C1915' },
  gauge: { alignItems: 'center', gap: 8 },
  gaugeLabel: { position: 'absolute', top: 42, alignItems: 'center' },
  level: { ...latinFont, fontWeight: '800', color: '#0F5132' },
  percent: { ...latinFont, fontSize: 18, fontWeight: '800', color: '#1C1915' },
  xp: { ...latinFont, color: '#5C564C' },
});
