import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchLessons, fetchProgress, takeCelebration } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppearance } from '@/lib/appearance';
import { lessonNodeState } from '@/lib/leveling';
import { categoryVisual, latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { teaches, type Celebration, type Lesson, type ProgressRow } from '@/lib/types';
import { CelebrationModal } from '@/components/CelebrationModal';
import { LearningRoadmap } from '@/components/LearningRoadmap';
import { StreakPanel } from '@/components/StreakPanel';
import { Card, Screen, SkeletonList } from '@/components/ui';

export default function LearnHome() {
  const { user, dataVersion } = useAuth();
  const { palette, dark } = useAppearance();
  const { expanded } = useViewport();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [nextLessons, nextProgress] = await Promise.all([fetchLessons(), fetchProgress()]);
      setLessons(nextLessons);
      setProgress(nextProgress);
      try {
        const party = await takeCelebration();
        if (party.streakIncreased || party.newBadges.length) setCelebration(party);
      } catch {
        // Streak tetap tampil dari panel progres.
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, dataVersion]),
  );

  const nextLesson = lessons.find((lesson) => lessonNodeState(lesson, lessons, progress, teaches(user?.role)) === 'active');

  return (
    <Screen>
      <CelebrationModal celebration={celebration} onClose={() => setCelebration(null)} />
      <Text style={[styles.hello, { color: palette.text }]}>Assalamu'alaikum, {user?.fullName || 'Santri'}</Text>
      <Text style={[styles.lead, { color: palette.muted }]}>Modul 1 terbuka untuk semua.</Text>
      {expanded ? null : <StreakPanel />}
      <View style={styles.swatches}>
        {(['Isim', "Fi'il", 'Huruf', 'Tamyiz 1'] as const).map((category) => {
          const visual = categoryVisual(category, null, dark);
          return (
            <View key={category} style={[styles.swatch, { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor }]}>
              <Text style={[styles.swatchText, { color: visual.textColor }]}>{visual.label}</Text>
            </View>
          );
        })}
      </View>
      {loading && lessons.length === 0 ? <SkeletonList count={2} /> : null}
      <Text style={[styles.lead, { color: palette.text }]}>Peta belajar</Text>
      <LearningRoadmap lessons={lessons} progress={progress} admin={teaches(user?.role)} nearby />
      {nextLesson ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/lesson/${nextLesson.id}`)}>
          <Card>
            <Text style={styles.kicker}>Lanjutkan</Text>
            <Text style={styles.title}>{nextLesson.title}</Text>
            <Text style={styles.desc}>{nextLesson.description}</Text>
          </Card>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/(main)/kuis')}>
        <Card>
          <Text style={styles.title}>Kuis per Surah</Text>
          <Text style={styles.desc}>Huruf, Isim, Fi'il, mufrodat, dan rumus pada ayat surah itu. Nilai 80 membuka surah berikutnya.</Text>
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { ...latinFont, fontSize: 28, fontWeight: '800', lineHeight: 36 },
  lead: { ...latinFont, lineHeight: 22 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  swatchText: { ...latinFont, fontWeight: '800', fontSize: 13 },
  kicker: { ...latinFont, color: '#6D4C00', fontWeight: '800' },
  title: { ...latinFont, fontSize: 18, fontWeight: '800' },
  desc: { ...latinFont, color: '#5C564C' },
});
