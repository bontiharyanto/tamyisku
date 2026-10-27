import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { playFeedback, playUrl } from '@/lib/audio';
import type { QuizItem } from '@/lib/types';
import { PASSING_SCORE, QUIZ_CHOICES, answersMatch, arabicFont, categoryVisual, colors, latinFont } from '@/lib/theme';
import { useAppearance } from '@/lib/appearance';
import { useViewport } from '@/lib/viewport';
import { Button, Card, notify } from '@/components/ui';

export function QuizSession({
  questions,
  saving,
  saveError,
  onSave,
  onRetry,
  onHome,
}: {
  questions: QuizItem[];
  saving: boolean;
  saveError: string | null;
  onSave: (score: number) => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [earned, setEarned] = useState(0);
  const [done, setDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const { compact } = useViewport();
  const { dark, palette } = useAppearance();
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const question = questions[index];
  const max = questions.reduce((sum, item) => sum + item.scorePoints, 0) || 1;
  const normalized = Math.round((earned / max) * 100);

  useEffect(() => {
    if (done) saveRef.current(normalized);
  }, [done, normalized]);

  function choose(choice: string) {
    if (!question || picked) return;
    const correct = answersMatch(choice, question.correctAnswer);
    setPicked(choice);
    playFeedback(correct);
    notify(correct ? 'Jawaban Benar!' : 'Jawaban belum tepat', correct ? 'ok' : 'err');
    if (correct) {
      setCorrectCount((value) => value + 1);
      setEarned((value) => value + question.scorePoints);
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setDone(true);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setIndex((value) => value + 1);
      setPicked(null);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }

  if (!question && !done) {
    return <Text style={styles.empty}>Kuis untuk modul ini belum tersedia.</Text>;
  }

  if (done) {
    const message = normalized >= 90 ? 'Luar biasa!' : normalized >= PASSING_SCORE ? 'Bagus, tingkatkan lagi!' : 'Coba lagi, kamu semakin dekat.';
    return (
      <Card>
        <Text style={[styles.resultScore, { color: palette.primary }]}>{normalized} / 100</Text>
        <Text style={[styles.resultMeta, { color: palette.muted }]}>{correctCount} benar dari {questions.length} soal</Text>
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        <Button label={saving ? 'Menyimpan...' : saveError ? 'Coba lagi simpan' : 'Skor tersimpan'} loading={saving} disabled={!saveError} onPress={() => onSave(normalized)} />
        <Button label="Coba lagi" tone="ghost" onPress={onRetry} />
        <Button label="Kembali ke menu utama" tone="ghost" onPress={onHome} />
      </Card>
    );
  }

  const visual = categoryVisual(question.correctAnswer, null, dark);
  return (
    <View style={styles.wrap}>
        <Text style={[styles.progressLabel, { color: palette.muted }]}>Pertanyaan {index + 1} dari {questions.length}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(index / questions.length) * 100}%` }]} />
      </View>
      <Animated.View style={{ opacity: fade }}>
        <Card>
          <Text style={[styles.question, { color: palette.muted }]}>{question.question}</Text>
          <Text selectable={false} style={[arabicFont, styles.arabic]}>{question.arabicText}</Text>
          <Text selectable={false} style={[styles.translation, { color: palette.text }]}>{question.translation}</Text>
          <Button label="Dengarkan" tone="ghost" disabled={!question.audioUrl} onPress={() => question.audioUrl && playUrl(question.audioUrl)} />
        </Card>
        <View style={styles.choices}>
          {QUIZ_CHOICES.map((choice) => {
            const selected = picked === choice.id;
            const correctChoice = picked ? answersMatch(choice.id, question.correctAnswer) : false;
            const wrong = selected && !correctChoice;
            return (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                disabled={Boolean(picked)}
                onPress={() => choose(choice.id)}
                style={({ pressed }) => [
                  styles.choice,
                  { flexBasis: compact ? '100%' : '47%', backgroundColor: palette.card, borderColor: palette.line },
                  correctChoice && picked && styles.correct,
                  wrong && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.choiceLabel, { color: palette.text }]}>{choice.label}</Text>
                <Text style={[styles.choiceHint, { color: palette.muted }]}>{choice.hint}</Text>
              </Pressable>
            );
          })}
        </View>
        {picked ? (
          <Card>
            <Text style={[styles.explain, { color: visual.borderColor }]}>{question.explanation}</Text>
            <Button label={index + 1 === questions.length ? 'Lihat hasil' : 'Lanjut ke soal berikutnya'} onPress={next} />
          </Card>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  progressLabel: { ...latinFont, color: colors.muted, fontWeight: '700' },
  track: { height: 8, backgroundColor: colors.line, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  question: { ...latinFont, color: colors.muted, textAlign: 'center' },
  arabic: { textAlign: 'center' },
  translation: { ...latinFont, textAlign: 'center', fontSize: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  choice: {
    flexGrow: 1,
    minHeight: 64,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  correct: { backgroundColor: '#E8F5E9', borderColor: colors.success },
  wrong: { backgroundColor: '#FFEBEE', borderColor: colors.danger },
  choiceLabel: { ...latinFont, fontSize: 18, fontWeight: '800' },
  choiceHint: { ...latinFont, color: colors.muted, marginTop: 4 },
  explain: { ...latinFont, fontWeight: '600' },
  resultScore: { ...latinFont, fontSize: 42, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  resultMeta: { ...latinFont, textAlign: 'center', color: colors.muted },
  message: { ...latinFont, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  error: { ...latinFont, color: colors.danger, textAlign: 'center' },
  empty: { ...latinFont, color: colors.muted },
});
