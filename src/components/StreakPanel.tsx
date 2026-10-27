import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchGamification } from '@/lib/api';
import { useColors } from '@/lib/appearance';
import { fetchUserXp } from '@/lib/juzQuiz';
import { colors, latinFont } from '@/lib/theme';
import type { EarnedBadge, Streak } from '@/lib/types';
import { BadgeGrid } from '@/components/BadgeGrid';
import { Card, SkeletonList } from '@/components/ui';

export function StreakPanel({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const palette = useColors();
  const flame = useRef(new Animated.Value(1)).current;
  const [streak, setStreak] = useState<Streak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [game, points] = await Promise.all([fetchGamification(), fetchUserXp().catch(() => 0)]);
      setStreak(game.streak);
      setBadges(game.badges);
      setXp(points);
    } catch {
      setStreak({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(flame, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flame]);

  const unlocked = badges.filter((badge) => badge.unlockedAt);
  const toward = 500;
  const progress = Math.min(100, Math.round(((xp % toward) / toward) * 100));

  if (loading && variant === 'full') return <SkeletonList count={2} />;

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.row}>
          <Animated.Text style={[styles.flame, { transform: [{ scale: flame }] }]}>🔥</Animated.Text>
          <View style={styles.copy}>
            <Text style={[styles.days, { color: palette.text }]}>{streak.currentStreak} hari</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>Rekor {streak.longestStreak} hari</Text>
          </View>
          <View style={styles.xpPill}>
            <Text style={styles.xp}>{xp} XP</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <Text style={[styles.meta, { color: palette.muted }]}>{progress}% menuju {toward} XP berikutnya</Text>
      </Card>
      {variant === 'full' ? (
        <>
          <Text style={[styles.section, { color: palette.text }]}>Lencana terbuka · {unlocked.length}</Text>
          {badges.length === 0 ? <Text style={{ color: palette.muted }}>Lencana belum tersedia.</Text> : <BadgeGrid badges={badges} />}
          <Card>
            <Text style={styles.section}>Papan peringkat</Text>
            <Text style={styles.meta}>Peringkat kelas belum dibuka. Streak dan XP di kartu ini adalah progres akun Anda sendiri.</Text>
          </Card>
        </>
      ) : unlocked.length > 0 ? (
        <Text style={styles.meta}>{unlocked.length} lencana terbuka</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flame: { fontSize: 32 },
  copy: { flex: 1 },
  days: { ...latinFont, fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { ...latinFont, color: colors.muted, lineHeight: 20 },
  xpPill: { backgroundColor: '#F8EFDA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.gold },
  xp: { ...latinFont, color: '#6D4C00', fontWeight: '800' },
  track: { height: 8, borderRadius: 99, backgroundColor: '#EFE8D8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99, backgroundColor: colors.gold },
  section: { ...latinFont, fontSize: 18, fontWeight: '800', color: colors.text },
});
