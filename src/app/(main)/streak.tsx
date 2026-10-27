import { useColors } from '@/lib/appearance';
import { latinFont } from '@/lib/theme';
import { StreakPanel } from '@/components/StreakPanel';
import { Screen } from '@/components/ui';
import { StyleSheet, Text } from 'react-native';

export default function StreakScreen() {
  const palette = useColors();
  return (
    <Screen>
      <Text style={[styles.title, { color: palette.text }]}>Streak dan lencana</Text>
      <Text style={[styles.lead, { color: palette.muted }]}>Nyala hari belajar, XP, dan lencana yang sudah terbuka.</Text>
      <StreakPanel variant="full" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...latinFont, fontSize: 28, fontWeight: '800' },
  lead: { ...latinFont, lineHeight: 22 },
});
