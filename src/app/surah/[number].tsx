import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { teaches } from '@/lib/types';
import { fetchSurahQuestions, fetchSurahScores, fetchSurahsWithQuestions, saveSurahQuiz, surahUnlocked, type SurahQuestion, type SurahQuizSave } from '@/lib/surahQuiz';
import { surahName } from '@/lib/surahs';
import { colors, latinFont } from '@/lib/theme';
import { SurahQuizRunner } from '@/components/SurahQuizRunner';
import { Button, Card, Screen, SkeletonList, notify } from '@/components/ui';

export default function SurahQuizScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const surahNumber = Number(number);
  const router = useRouter();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<SurahQuestion[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SurahQuizSave | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = surahName(surahNumber);

  useEffect(() => {
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [scores, bank] = await Promise.all([fetchSurahScores(), fetchSurahsWithQuestions()]);
        if (!surahUnlocked(surahNumber, scores, bank, teaches(user?.role))) {
          if (!cancelled) setLocked(true);
          return;
        }
        const next = await fetchSurahQuestions(surahNumber);
        if (!cancelled) setQuestions(next);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat soal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [surahNumber, user?.role]);

  const onFinish = useCallback(
    async (attempt: { score: number; correct: number; heartsLeft: number; timeSpent: number }) => {
      setScore(attempt.score);
      try {
        const saved = await saveSurahQuiz({ surahNumber, score: attempt.score, timeSpent: attempt.timeSpent, correct: attempt.correct });
        setResult(saved);
        notify(saved.unlockedNext ? 'Nilai 80 tercapai. Surah berikutnya terbuka.' : 'Skor berhasil disimpan');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal menyimpan skor');
      }
    },
    [surahNumber],
  );

  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text style={styles.title}>Surah tidak dikenal</Text>
        <Button label="Daftar surah" onPress={() => router.replace('/surah')} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <SkeletonList count={4} />
      </Screen>
    );
  }

  if (locked) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text style={styles.title}>QS {name} terkunci</Text>
        <Text style={styles.body}>Capai nilai 80 pada surah bersoal sebelumnya untuk membuka kuis ini.</Text>
        <Button label="Kembali ke daftar surah" onPress={() => router.replace('/surah')} />
      </Screen>
    );
  }

  if (score !== null) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Card>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.body}>Nilai terbaik {result?.bestScore ?? score}. XP yang ditambah {result?.xpEarned ?? 0}.</Text>
          {result?.unlockedNext ? <Text style={styles.open}>Surah berikutnya sudah terbuka.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Ulangi kuis" tone="ghost" onPress={() => router.replace(`/surah/${surahNumber}`)} />
          <Button label="Daftar surah" onPress={() => router.replace('/surah')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Text style={styles.title}>QS {name}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {questions.length === 0 ? (
        <Card>
          <Text style={styles.body}>Bank soal surah ini belum diisi.</Text>
          <Button label="Daftar surah" onPress={() => router.replace('/surah')} />
        </Card>
      ) : (
        <SurahQuizRunner surahNumber={surahNumber} questions={questions} onFinish={(attempt) => void onFinish(attempt)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...latinFont, fontSize: 24, fontWeight: '800', color: colors.primary },
  body: { ...latinFont, color: colors.muted, lineHeight: 22 },
  score: { ...latinFont, fontSize: 48, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  open: { ...latinFont, color: colors.success, fontWeight: '800' },
  error: { ...latinFont, color: colors.danger },
});
