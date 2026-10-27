import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { uploadLessonAudio } from '@/lib/api';
import { loadStaffSnapshot, type ReviewWord, type StaffSnapshot } from '@/lib/dashboardData';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/lib/appearance';
import { arabicFont, categoryVisual, latinFont } from '@/lib/theme';
import { surahName } from '@/lib/surahs';
import { useViewport } from '@/lib/viewport';
import { InlineWordRecorder } from '@/components/InlineWordRecorder';
import { StatCard } from '@/components/dashboard/shell';
import { Button, EmptyState, Screen, SkeletonList, notify } from '@/components/ui';

export function TutorDashboard() {
  const router = useRouter();
  const { compact } = useViewport();
  const { dark, palette } = useAppearance();
  const [data, setData] = useState<StaffSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadStaffSnapshot());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat dasbor pengajar');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function attachAudio(word: ReviewWord, blob: Blob, extension: 'mp3' | 'm4a') {
    setBusyId(word.id);
    try {
      const path = await uploadLessonAudio(blob, `kata-${word.id}.${extension}`);
      const { error: updateError } = await supabase.from('quran_words').update({ audio_url: path }).eq('id', word.id);
      if (updateError) throw new Error(updateError.message);
      notify('Audio tersimpan');
      await load();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan audio', 'err');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {loading ? <SkeletonList count={4} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <>
          <View style={[styles.grid, compact ? styles.stack : null]}>
            <StatCard label="Modul" value={String(data.modules)} />
            <StatCard label="Kata tanpa audio" value={String(data.missingAudio)} hint="Belum ada antrean persetujuan terpisah" />
            <StatCard label="Santri aktif 7 hari" value={String(data.activeStudents)} hint="Akun yang menyimpan progres, bukan kelas yang ditugaskan" />
            <StatCard label="Rata-rata skor modul" value={`${data.averageScore}%`} />
          </View>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line }]}>
            <Text style={styles.section}>Kelola materi</Text>
            <Text style={styles.meta}>Pengurai PDF belum tersedia. Kata, kategori warna, dan audio diubah di CMS.</Text>
            <Button label="Buka CMS kata" onPress={() => router.push('/tutor/lessons')} />
          </View>
          <Text style={styles.section}>Perlu dilengkapi</Text>
          {data.review.length === 0 ? <EmptyState title="Audio dan warna lengkap" body="Tidak ada kata yang kehilangan audio atau kode warna." /> : null}
          {data.review.map((word) => {
            const visual = categoryVisual(word.category, null, dark);
            return (
              <View key={word.id} style={[styles.card, { borderColor: visual.borderColor, backgroundColor: visual.backgroundColor }]}>
                <Text style={arabicFont}>{word.arabicText}</Text>
                <Text style={styles.item}>{word.translation}</Text>
                <Text style={styles.meta}>QS {surahName(word.surahNumber)} · ayat {word.ayahNumber} · {word.need === 'audio' ? 'belum ada audio' : 'belum ada warna'}</Text>
                <View style={styles.actions}>
                  <Button label="Edit" tone="ghost" onPress={() => router.push('/tutor/lessons')} />
                  {word.need === 'audio' ? (
                    <InlineWordRecorder disabled={busyId !== null} onRecorded={(blob, extension) => attachAudio(word, blob, extension)} />
                  ) : null}
                </View>
              </View>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stack: { flexDirection: 'column' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E6E0D6', padding: 14, gap: 8 },
  section: { ...latinFont, fontSize: 18, fontWeight: '800', color: '#1C1915' },
  item: { ...latinFont, fontWeight: '800', color: '#1C1915' },
  meta: { ...latinFont, color: '#5C564C' },
  error: { color: '#B71C1C' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
