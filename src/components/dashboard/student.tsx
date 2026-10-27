import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatStudyTime, greetingFor, loadStudentDashboard, type StudentDashboardData } from '@/lib/dashboardData';
import { useColors } from '@/lib/appearance';
import { useAuth } from '@/lib/auth';
import { teaches } from '@/lib/types';
import { latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { FlameCount, StatCard } from '@/components/dashboard/shell';
import { Button, EmptyState, Screen, SkeletonList } from '@/components/ui';

export function StudentDashboard() {
  const { user } = useAuth();
  const palette = useColors();
  const surface = { backgroundColor: palette.card, borderColor: palette.line };
  const router = useRouter();
  const { compact } = useViewport();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void loadStudentDashboard(teaches(user?.role))
        .then((next) => {
          if (active) {
            setData(next);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : 'Gagal memuat dasbor');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.role]),
  );

  const initials = (user?.fullName || user?.email || 'S')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const percent = data ? Math.round((data.intoBand / data.band) * 100) : 0;

  return (
    <Screen edges={['bottom']}>
      {loading ? <SkeletonList count={4} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <>
          <View style={styles.banner}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.grow}>
              <Text style={[styles.hello, { color: palette.primary }]}>{greetingFor(user?.fullName || 'Santri')}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>Level {data.level}: {data.levelTitle}</Text>
            </View>
            <FlameCount value={data.streak} />
          </View>
          <Text style={[styles.meta, { color: palette.muted }]}>{data.xp.toLocaleString('id-ID')} XP · {data.intoBand.toLocaleString('id-ID')} / {data.band.toLocaleString('id-ID')} menuju level berikutnya</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
          <View style={[styles.card, surface]}>
            <Text style={[styles.section, { color: palette.text }]}>{data.activeLesson ? data.activeLesson.title : 'Peta belajar'}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>{data.activeLesson ? `${data.activePercent}% dari skor kuis modul ini` : 'Belum ada modul terbuka.'}</Text>
            <Button
              label="Lanjutkan belajar"
              onPress={() => router.push(data.activeLesson ? `/lesson/${data.activeLesson.id}` : '/(main)/belajar')}
            />
          </View>
          <View style={[styles.grid, compact ? styles.stack : null]}>
            <StatCard label="Kata pada modul lulus" value={data.wordsInPassedModules.toLocaleString('id-ID')} hint="Jumlah kata di modul dengan skor minimal 80" />
            <StatCard label={data.scoreLabel} value={data.averageScore === null ? '—' : `${data.averageScore}%`} />
            <StatCard label="Waktu kuis surah minggu ini" value={formatStudyTime(data.weekSeconds)} hint="Kuis modul belum menyimpan durasi" />
          </View>
          <Text style={[styles.section, { color: palette.text }]}>Kuis surah terbaru</Text>
          {data.recent.length === 0 ? <EmptyState title="Belum ada kuis surah" body="Skor muncul di sini setelah satu surah diselesaikan." /> : null}
          {data.recent.map((row) => (
            <View key={row.id} style={[styles.card, surface]}>
              <Text style={[styles.item, { color: palette.text }]}>QS {row.title}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{row.score}/100 · {formatStudyTime(row.timeSpent)}</Text>
            </View>
          ))}
          <Text style={[styles.section, { color: palette.text }]}>Perlu diulang</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>Kuis menyimpan skor modul, bukan kata yang terlewat. Daftar ini adalah modul dengan skor di bawah 80.</Text>
          {data.review.length === 0 ? <EmptyState title="Tidak ada modul tertinggal" body="Semua skor tersimpan sudah mencapai 80, atau kuis belum dikerjakan." /> : null}
          {data.review.map((row) => (
            <View key={row.id} style={[styles.card, surface]}>
              <Text style={[styles.item, { color: palette.text }]}>{row.lessonTitle}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{row.score}/100</Text>
              <Button label="Ulangi" tone="ghost" onPress={() => router.push(`/quiz/${row.lessonId}`)} />
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0F5132', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FDFBF7', fontWeight: '800' },
  hello: { ...latinFont, fontSize: 22, fontWeight: '800', color: '#0F5132' },
  section: { ...latinFont, fontSize: 18, fontWeight: '800', color: '#1C1915', marginTop: 8 },
  item: { ...latinFont, fontWeight: '800', color: '#1C1915' },
  meta: { ...latinFont, color: '#5C564C' },
  error: { color: '#B71C1C' },
  track: { height: 10, borderRadius: 99, backgroundColor: '#E6E0D6', overflow: 'hidden' },
  fill: { height: 10, backgroundColor: '#D4AF37' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E6E0D6', padding: 14, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stack: { flexDirection: 'column' },
});
