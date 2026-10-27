import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { fetchLessons, fetchProgress, fetchWords } from '@/lib/api';
import { consumeOfflineFallback } from '@/lib/contentCache';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/appearance';
import { lessonNodeState } from '@/lib/leveling';
import { teaches, type Lesson, type ProgressRow, type QuranWord } from '@/lib/types';
import { latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { LearningSurface } from '@/components/LearningSurface';
import { PlaylistButton, WordGrid } from '@/components/WordGrid';
import { Button, Screen, SkeletonList } from '@/components/ui';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, premium } = useAuth();
  const palette = useColors();
  const { compact } = useViewport();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [catalog, setCatalog] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [words, setWords] = useState<QuranWord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [lessons, rows] = await Promise.all([fetchLessons(), fetchProgress()]);
        const current = lessons.find((item) => item.id === id) ?? null;
        if (!current) throw new Error('Modul tidak ditemukan');
        if (cancelled) return;
        setCatalog(lessons);
        setProgress(rows);
        setLesson(current);
        if (lessonNodeState(current, lessons, rows, teaches(user?.role)) === 'locked') {
          setLoading(false);
          return;
        }
        if (current.orderIndex !== 1 && !premium) {
          setWords([]);
          setLoading(false);
          return;
        }
        const nextWords = await fetchWords(current.id);
        if (!cancelled) setWords(nextWords);
        if (!cancelled) setOffline(consumeOfflineFallback());
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat pelajaran');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, premium, user?.role]);

  const ayahs = useMemo(() => {
    const map = new Map<string, { surah: number; ayah: number }>();
    words.forEach((word) => map.set(`${word.surahNumber}:${word.ayahNumber}`, { surah: word.surahNumber, ayah: word.ayahNumber }));
    return [...map.values()];
  }, [words]);
  const [ayahKey, setAyahKey] = useState<string | null>(null);
  const split = !compact && ayahs.length > 1;

  if (lesson && lessonNodeState(lesson, catalog, progress, teaches(user?.role)) === 'locked') return <Redirect href="/(main)/belajar" />;
  if (lesson && lesson.orderIndex !== 1 && !premium) return <Redirect href="/paywall" />;

  return (
    <LearningSurface email={user?.email ?? ''}>
      <Screen footer={compact ? <PlaylistButton words={words} /> : undefined}>
        <View style={split ? styles.split : undefined}>
          <View style={split ? styles.pane : styles.stack}>
            <Text style={[styles.title, { color: palette.text }]}>{lesson?.title ?? 'Pelajaran'}</Text>
            <Text style={[styles.desc, { color: palette.muted }]}>{lesson?.description}</Text>
            {offline ? <Text style={[styles.offline, { color: palette.primary }]}>Menampilkan kosa kata tersimpan. Audio baru dimuat saat sambungan kembali.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Mulai kuis" onPress={() => router.push(`/quiz/${id}`)} />
            {split ? (
              <ScrollView style={styles.ayahScroll} nestedScrollEnabled>
                <View style={styles.ayahList}>
                  <Pressable accessibilityRole="button" onPress={() => setAyahKey(null)} style={[styles.ayahChip, !ayahKey && styles.ayahChipOn]}>
                    <Text style={styles.ayahText}>Semua ayat</Text>
                  </Pressable>
                  {ayahs.map((ayah) => {
                    const key = `${ayah.surah}:${ayah.ayah}`;
                    const on = ayahKey === key;
                    return (
                      <Pressable key={key} accessibilityRole="button" onPress={() => setAyahKey(key)} style={[styles.ayahChip, on && styles.ayahChipOn]}>
                        <Text style={styles.ayahText}>{ayah.surah}:{ayah.ayah}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
          </View>
          <View style={split ? styles.canvas : undefined}>
            {loading ? <SkeletonList count={4} /> : <WordGrid words={words} ayahKey={ayahKey} showPlaylist={!compact} />}
          </View>
        </View>
      </Screen>
    </LearningSurface>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  pane: { width: 240, gap: 10 },
  stack: { gap: 10 },
  canvas: { flex: 1, minWidth: 0 },
  title: { ...latinFont, fontSize: 24, fontWeight: '800' },
  desc: { ...latinFont },
  offline: { ...latinFont, fontWeight: '700' },
  error: { ...latinFont, color: '#B71C1C' },
  ayahList: { gap: 8 },
  ayahScroll: { maxHeight: 480 },
  ayahChip: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E6E0D6', backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 12 },
  ayahChipOn: { borderColor: '#0F5132', backgroundColor: '#E7F6EF' },
  ayahText: { ...latinFont, fontWeight: '800', color: '#0F5132' },
});
