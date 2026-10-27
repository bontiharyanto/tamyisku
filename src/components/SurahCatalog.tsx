import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { teaches } from '@/lib/types';
import { useColors } from '@/lib/appearance';
import { fetchSurahScores, fetchSurahsWithQuestions, surahUnlocked, type SurahScore } from '@/lib/surahQuiz';
import { SURAH_NAMES, surahName } from '@/lib/surahs';
import { colors, latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { Card, EmptyState, Field, Screen, SkeletonList, notify } from '@/components/ui';
import type { Edge } from 'react-native-safe-area-context';

export function SurahCatalog({ edges = ['bottom'] }: { edges?: Edge[] }) {
  const router = useRouter();
  const { user } = useAuth();
  const palette = useColors();
  const { columns } = useViewport();
  const [scores, setScores] = useState<SurahScore[]>([]);
  const [bank, setBank] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const basis = columns === 1 ? '100%' : columns === 2 ? '48%' : '31%';
  const ready = useMemo(() => new Set(bank), [bank]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextScores, nextBank] = await Promise.all([fetchSurahScores(), fetchSurahsWithQuestions()]);
      setScores(nextScores);
      setBank(nextBank);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memuat kuis surah', 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const needle = query.trim().toLowerCase();
  const visible = SURAH_NAMES.map((name, index) => ({ number: index + 1, name })).filter((item) => {
    if (!needle) return true;
    return item.name.toLowerCase().includes(needle) || String(item.number) === needle;
  });

  return (
    <Screen edges={edges}>
      <Text style={[styles.title, { color: palette.text }]}>Kuis per Surah</Text>
      <Text style={[styles.lead, { color: palette.muted }]}>Soal mengikuti ayat surah itu sendiri. Nilai 80 membuka surah berikutnya yang sudah punya bank soal.</Text>
      <Card>
        <Field label="Cari surah" value={query} onChangeText={setQuery} placeholder="Al-Fatihah, Yasin, 114" />
      </Card>
      {loading ? <SkeletonList count={4} /> : null}
      {!loading && visible.length === 0 ? <EmptyState title="Surah tidak ketemu" body="Coba nama surah atau nomor 1 sampai 114." /> : null}
      <View style={styles.grid}>
        {visible.map((item) => {
          const open = surahUnlocked(item.number, scores, bank, teaches(user?.role));
          const best = scores.find((score) => score.surahNumber === item.number);
          const hasQuiz = ready.has(item.number);
          return (
            <Pressable
              key={item.number}
              accessibilityRole="button"
              disabled={!open}
              onPress={() => router.push(`/surah/${item.number}`)}
              style={[styles.cell, { flexBasis: basis }]}
            >
              <Card>
                <Text style={styles.name}>{item.number}. {surahName(item.number)}</Text>
                <Text style={styles.meta}>
                  {open
                    ? hasQuiz
                      ? best
                        ? `Nilai terbaik ${best.bestScore}`
                        : 'Soal siap'
                      : 'Soal menyusul'
                    : 'Terkunci · butuh 80 pada surah bersoal sebelumnya'}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...latinFont, fontSize: 28, fontWeight: '800' },
  lead: { ...latinFont, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, minWidth: 180 },
  name: { ...latinFont, fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { ...latinFont, color: colors.muted },
});
