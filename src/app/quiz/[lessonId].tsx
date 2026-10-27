import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { fetchGamification, fetchLessons, fetchNotifyPrefs, fetchProgress, fetchQuizzes, nextLessonHref, studiedToday, takeCelebration } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ensureNotificationPermission, syncStudyReminder } from '@/lib/notifications';
import { teaches, type Celebration, type QuizItem } from '@/lib/types';
import { colors, latinFont } from '@/lib/theme';
import { EncourageSheet, LevelCelebration } from '@/components/CelebrationModal';
import { LearningSurface } from '@/components/LearningSurface';
import { QuizSession } from '@/components/QuizSession';
import { SurahQuizRunner } from '@/components/SurahQuizRunner';
import { Button, Card, Screen, SkeletonList, notify } from '@/components/ui';
import { loadSurahQuizForLesson } from '@/lib/lessonQuiz';
import { completeLessonLevel, lessonNodeState, type LevelResult } from '@/lib/leveling';
import type { SurahQuestion } from '@/lib/surahQuiz';
import { surahName } from '@/lib/surahs';

export default function QuizScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { user, premium } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [surahQuestions, setSurahQuestions] = useState<SurahQuestion[]>([]);
  const [surahNumber, setSurahNumber] = useState(0);
  const [locked, setLocked] = useState(false);
  const [sequenceLocked, setSequenceLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [finishedScore, setFinishedScore] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [lessons, progress] = await Promise.all([fetchLessons(), fetchProgress()]);
        const lesson = lessons.find((item) => item.id === lessonId);
        if (lesson && lessonNodeState(lesson, lessons, progress, teaches(user?.role)) === 'locked') {
          if (!cancelled) setSequenceLocked(true);
          return;
        }
        if (lesson && lesson.orderIndex !== 1 && !premium) {
          if (!cancelled) setLocked(true);
          return;
        }
        const next = await fetchQuizzes(lessonId);
        if (cancelled) return;
        if (next.length > 0) {
          setQuestions(next);
          return;
        }
        const built = await loadSurahQuizForLesson(lessonId);
        if (!cancelled) {
          setSurahNumber(built.surahNumber);
          setSurahQuestions(built.questions);
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Gagal menyusun kuis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId, premium, user?.role]);

  const settle = useCallback(
    async (finalScore: number, spent: number) => {
      if (!lessonId) return;
      setSaving(true);
      setSaveError(null);
      setTimeSpent(spent);
      try {
        const result = await completeLessonLevel({ lessonId, score: finalScore });
        setLevelResult(result);
        setFinishedScore(finalScore);
        const party = await takeCelebration();
        if (party.streakIncreased || party.newBadges.length) setCelebration(party);
        notify(result.passed ? 'Skor berhasil disimpan!' : 'Nilai belum mencapai 80.');
        const allowed = await ensureNotificationPermission();
        if (allowed) {
          const [prefs, game, href] = await Promise.all([fetchNotifyPrefs(), fetchGamification(), nextLessonHref()]);
          await syncStudyReminder({ prefs, streak: game.streak, studiedToday: studiedToday(game.streak), href });
        }
      } catch (cause) {
        setSaveError(cause instanceof Error ? cause.message : 'Gagal menyimpan skor');
      } finally {
        setSaving(false);
      }
    },
    [lessonId],
  );

  const retry = useCallback(() => {
    setFinishedScore(null);
    setLevelResult(null);
    setSaveError(null);
    setCelebration(null);
    setAttempt((value) => value + 1);
  }, []);

  if (loading) {
    return (
      <Screen>
        <SkeletonList count={4} />
      </Screen>
    );
  }
  if (sequenceLocked) return <Redirect href="/(main)/belajar" />;
  if (locked) return <Redirect href="/paywall" />;

  return (
    <LearningSurface email={user?.email ?? ''}>
      <LevelCelebration
        result={levelResult?.passed ? levelResult : null}
        timeSpent={timeSpent}
        extraBadges={celebration?.newBadges ?? []}
        onNext={() => {
          if (levelResult?.nextLessonId) router.replace(`/lesson/${levelResult.nextLessonId}`);
        }}
        onHome={() => router.replace('/(main)/belajar')}
      />
      <EncourageSheet visible={Boolean(levelResult && !levelResult.passed)} onRetry={retry} />
      <Screen>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {questions.length === 0 && surahQuestions.length === 0 ? (
          <Card>
            <Text style={styles.body}>Soal modul ini belum ditinjau ayat per ayat. Kuis ditutup agar kelas kata yang keliru tidak diajarkan.</Text>
            <Button label="Kembali ke menu utama" onPress={() => router.replace('/(main)')} />
          </Card>
        ) : questions.length === 0 && surahQuestions.length > 0 ? (
          finishedScore !== null ? (
            <Card>
              <Text style={styles.score}>{finishedScore}</Text>
              <Text style={styles.body}>Nilai kuis {surahName(surahNumber)}. {saving ? 'Menyimpan...' : levelResult ? 'Skor berhasil disimpan.' : ''}</Text>
              {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
              <Button label="Coba lagi" tone="ghost" onPress={retry} />
              <Button label="Kembali ke menu utama" tone="ghost" onPress={() => router.replace('/(main)')} />
            </Card>
          ) : (
            <SurahQuizRunner
              key={attempt}
              surahNumber={surahNumber}
              questions={surahQuestions}
              onFinish={(result) => {
                setFinishedScore(result.score);
                void settle(result.score, result.timeSpent);
              }}
            />
          )
        ) : (
        <QuizSession
          key={attempt}
          questions={questions}
          saving={saving}
          saveError={saveError}
          onSave={(score) => void settle(score, 0)}
          onRetry={retry}
          onHome={() => router.replace('/(main)')}
        />
        )}
      </Screen>
    </LearningSurface>
  );
}

const styles = StyleSheet.create({
  score: { ...latinFont, fontSize: 48, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  body: { ...latinFont, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  error: { ...latinFont, color: colors.danger },
});
