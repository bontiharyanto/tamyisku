import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { teaches } from '@/lib/types';
import { fetchJuzQuestions, fetchJuzScores, juzUnlocked, saveJuzQuiz, type JuzQuestion, type JuzQuizSave } from '@/lib/juzQuiz';
import { colors, latinFont } from '@/lib/theme';
import { Button, Card, Screen, SkeletonList, notify } from '@/components/ui';

export default function JuzQuizScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const juzNumber = Number(number);
  const router = useRouter();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<JuzQuestion[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<JuzQuizSave | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const scores = await fetchJuzScores();
        if (!juzUnlocked(juzNumber, scores, teaches(user?.role))) {
          if (!cancelled) setLocked(true);
          return;
        }
        const next = await fetchJuzQuestions(juzNumber);
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
  }, [juzNumber, user?.role]);

  const onFinish = useCallback(
    async (attempt: { score: number; correct: number; heartsLeft: number; timeSpent: number }) => {
      setScore(attempt.score);
      try {
        const saved = await saveJuzQuiz({ juzNumber, ...attempt });
        setResult(saved);
        notify(saved.unlockedNext ? `Juz ${saved.nextJuz} terbuka` : 'Skor berhasil disimpan');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal menyimpan skor');
      }
    },
    [juzNumber],
  );

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
        <Text style={styles.title}>Juz {juzNumber} terkunci</Text>
        <Text style={styles.body}>Capai nilai 80 pada juz sebelumnya untuk membuka kuis ini.</Text>
        <Button label="Kembali ke daftar juz" onPress={() => router.replace('/juz')} />
      </Screen>
    );
  }

  if (score !== null) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Card>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.body}>Nilai terbaik {result?.bestScore ?? score}. XP yang ditambah {result?.xpEarned ?? 0}.</Text>
          {result?.unlockedNext ? <Text style={styles.open}>Juz {result.nextJuz} sudah terbuka.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Ulangi kuis" tone="ghost" onPress={() => router.replace(`/juz/${juzNumber}`)} />
          <Button label="Daftar juz" onPress={() => router.replace('/juz')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Text style={styles.title}>Kuis Juz {juzNumber}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <Text style={styles.body}>Bank soal 30 juz masih hasil tebakan label impor, belum ditinjau ayat per ayat. Kuis itu ditutup agar kelas kata yang keliru tidak diajarkan.</Text>
        <Button label="Kembali ke daftar juz" onPress={() => router.replace('/juz')} />
      </Card>
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
