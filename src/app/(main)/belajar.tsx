import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchLessons, fetchProgress } from '@/lib/api';
import { consumeOfflineFallback } from '@/lib/contentCache';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/appearance';
import { lessonNodeState } from '@/lib/leveling';
import { latinFont } from '@/lib/theme';
import { teaches, type Lesson, type ProgressRow } from '@/lib/types';
import { useViewport } from '@/lib/viewport';
import { LearningRoadmap } from '@/components/LearningRoadmap';
import { Badge, Card, EmptyState, Screen, SkeletonList } from '@/components/ui';

export default function BelajarScreen() {
  const { premium, dataVersion, user } = useAuth();
  const palette = useColors();
  const router = useRouter();
  const { columns } = useViewport();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const cardBasis = columns === 1 ? '100%' : columns === 2 ? '48%' : '31%';

  const load = useCallback(async () => {
    try {
      const [nextLessons, nextProgress] = await Promise.all([fetchLessons(), fetchProgress()]);
      setLessons(nextLessons);
      setProgress(nextProgress);
      setOffline(consumeOfflineFallback());
      setError(null);
    } catch (cause) {
      setOffline(consumeOfflineFallback());
      setError(cause instanceof Error ? cause.message : 'Gagal memuat modul');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, dataVersion]),
  );

  return (
    <Screen>
      <Text style={[styles.title, { color: palette.text }]}>Belajar</Text>
      <Text style={[styles.lead, { color: palette.muted }]}>Nilai 80 membuka modul berikutnya. Modul yang belum lulus tidak bisa dibuka lewat tautan.</Text>
      <LearningRoadmap lessons={lessons} progress={progress} admin={teaches(user?.role)} nearby />
      {offline ? <Text style={[styles.note, { color: palette.primary }]}>Menampilkan modul tersimpan. Sambungan sedang terputus.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && lessons.length === 0 ? <SkeletonList /> : null}
      {!loading && lessons.length === 0 ? <EmptyState title="Modul belum ada" body="Daftar pelajaran akan muncul setelah data kosa kata siap." /> : null}
      <View style={styles.grid}>
        {lessons.map((lesson) => {
          const state = lessonNodeState(lesson, lessons, progress, teaches(user?.role));
          const row = progress.find((item) => item.lessonId === lesson.id);
          return (
            <Pressable
              key={lesson.id}
              accessibilityRole="button"
              disabled={state === 'locked'}
              onPress={() => (lesson.orderIndex !== 1 && !premium ? router.push('/paywall') : router.push(`/lesson/${lesson.id}`))}
              style={({ pressed }) => [styles.lessonPress, { flexBasis: cardBasis }, pressed && styles.pressed]}
            >
              <Card>
                <View style={styles.row}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  {state === 'locked' ? <Badge label="Terkunci" tone="muted" /> : state === 'completed' ? <Badge label="Selesai" tone="green" /> : <Badge label="Dibuka" tone="green" />}
                </View>
                <Text style={styles.meta}>Level {lesson.level} · {lesson.category}</Text>
                <Text style={styles.desc}>{lesson.description}</Text>
                {row ? <Text style={styles.score}>Skor terbaik {row.score}/100</Text> : null}
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
  note: { ...latinFont, fontWeight: '700' },
  error: { ...latinFont, color: '#B71C1C' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  lessonPress: { flexGrow: 1, minWidth: 240 },
  pressed: { opacity: 0.92 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  lessonTitle: { ...latinFont, flex: 1, fontSize: 18, fontWeight: '800' },
  meta: { ...latinFont, color: '#6D4C00', fontWeight: '700' },
  desc: { ...latinFont, color: '#5C564C' },
  score: { ...latinFont, color: '#0F5132', fontWeight: '700' },
});
