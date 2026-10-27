import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { teaches } from '@/lib/types';
import { fetchJuzScores, fetchUserXp, juzUnlocked, type JuzScore } from '@/lib/juzQuiz';
import { useViewport } from '@/lib/viewport';
import { colors, latinFont } from '@/lib/theme';
import { Card, Screen, SkeletonList, notify } from '@/components/ui';

const JUZ_NUMBERS = Array.from({ length: 30 }, (_, index) => index + 1);

export default function JuzListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { columns } = useViewport();
  const [scores, setScores] = useState<JuzScore[]>([]);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const basis = columns === 1 ? '100%' : columns === 2 ? '48%' : '31%';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextScores, nextXp] = await Promise.all([fetchJuzScores(), fetchUserXp()]);
      setScores(nextScores);
      setXp(nextXp);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memuat kuis juz', 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <Text style={styles.title}>Kuis 30 Juz</Text>
      <Text style={styles.lead}>Sepuluh sampai lima belas soal tiap juz. Nilai 80 membuka juz berikutnya. XP kamu {xp}.</Text>
      {loading ? <SkeletonList count={4} /> : null}
      <View style={styles.grid}>
        {JUZ_NUMBERS.map((juz) => {
          const open = juzUnlocked(juz, scores, teaches(user?.role));
          const best = scores.find((item) => item.juzNumber === juz);
          return (
            <Pressable
              key={juz}
              accessibilityRole="button"
              disabled={!open}
              onPress={() => router.push(`/juz/${juz}`)}
              style={[styles.cell, { flexBasis: basis }]}
            >
              <Card>
                <Text style={styles.juz}>Juz {juz}</Text>
                <Text style={styles.meta}>{open ? (best ? `Nilai terbaik ${best.bestScore}` : 'Belum dikerjakan') : 'Terkunci · butuh 80 di juz sebelumnya'}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...latinFont, fontSize: 28, fontWeight: '800', color: colors.primary },
  lead: { ...latinFont, color: colors.muted, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, minWidth: 180 },
  juz: { ...latinFont, fontSize: 18, fontWeight: '800' },
  meta: { ...latinFont, color: colors.muted },
});
