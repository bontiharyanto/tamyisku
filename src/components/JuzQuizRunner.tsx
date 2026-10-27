import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { playFeedback, playUrl } from '@/lib/audio';
import type { JuzQuestion } from '@/lib/juzQuiz';
import { useAppearance } from '@/lib/appearance';
import { arabicFont, categoryVisual, colors, latinFont } from '@/lib/theme';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, Card } from '@/components/ui';

const HEARTS = 5;
const LEVELS = ['', 'Level 1 · Huruf', 'Level 2 · Isim dan Fi\'il', 'Level 3 · Mufrodat'];

export function JuzQuizRunner({
  juzNumber,
  questions,
  onFinish,
}: {
  juzNumber: number;
  questions: JuzQuestion[];
  onFinish: (result: { score: number; correct: number; heartsLeft: number; timeSpent: number }) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [hearts, setHearts] = useState(HEARTS);
  const [correctCount, setCorrectCount] = useState(0);
  const [explain, setExplain] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const finished = useRef(false);
  const burst = useRef(new Animated.Value(0)).current;
  const { dark } = useAppearance();
  const question = questions[index];

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    const score = Math.round((correctCount / Math.max(questions.length, 1)) * 100);
    onFinish({
      score,
      correct: correctCount,
      heartsLeft: hearts,
      timeSpent: Math.round((Date.now() - started.current) / 1000),
    });
  }, [done, correctCount, hearts, questions.length, onFinish]);

  function choose(option: string) {
    if (!question || picked) return;
    const correct = option === question.correctAnswer;
    setPicked(option);
    playFeedback(correct);
    if (correct) {
      setCorrectCount((value) => value + 1);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      return;
    }
    setHearts((value) => Math.max(0, value - 1));
    setExplain(true);
  }

  function next() {
    const remaining = picked === question?.correctAnswer ? hearts : Math.max(0, hearts);
    if (index + 1 >= questions.length || remaining === 0) {
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
    setExplain(false);
  }

  if (!question) return <Text style={styles.empty}>Soal juz ini belum tersedia.</Text>;

  return (
    <View style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={styles.kicker}>Juz {juzNumber} · {index + 1}/{questions.length}</Text>
        <Text style={styles.hearts}>{'♥'.repeat(hearts)}{'♡'.repeat(HEARTS - hearts)}</Text>
      </View>
      <Text style={styles.level}>{LEVELS[question.skillLevel] ?? 'Kuis Tamyiz'}</Text>
      <Card>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <View style={styles.verse}>
          {question.verseWords.map((word, wordIndex) => {
            const visual = categoryVisual(word.category, null, dark);
            const marked = word.arabic === question.highlightedWord;
            return (
              <View key={`${word.arabic}-${wordIndex}`} style={[styles.token, { backgroundColor: visual.backgroundColor, borderColor: marked ? '#D32F2F' : visual.borderColor }]}>
                <Text style={[arabicFont, styles.tokenArabic, { color: visual.textColor }]}>{word.arabic}</Text>
              </View>
            );
          })}
        </View>
        <Button label="Dengarkan kata" tone="ghost" disabled={!question.audioUrl} onPress={() => question.audioUrl && playUrl(question.audioUrl)} />
        {picked && picked === question.correctAnswer ? (
          <Animated.Text style={[styles.confetti, { opacity: burst }]}>+10 XP</Animated.Text>
        ) : null}
      </Card>
      <View style={styles.options}>
        {question.options.map((option) => {
          const selected = picked === option;
          const correct = picked && option === question.correctAnswer;
          const wrong = selected && option !== question.correctAnswer;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              disabled={Boolean(picked)}
              onPress={() => choose(option)}
              style={[styles.option, correct && styles.correct, wrong && styles.wrong]}
            >
              <Text style={[styles.optionText, question.skillLevel !== 2 && styles.optionArabic]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked ? <Button label={index + 1 === questions.length || hearts === 0 ? 'Lihat hasil' : 'Lanjut'} onPress={next} /> : null}
      <BottomSheet visible={explain} onClose={() => setExplain(false)} dismissOnBackdrop={false}>
        <Text style={styles.explainTitle}>Jawaban belum tepat</Text>
        <Text style={styles.explainBody}>{question.explanation}</Text>
        <Button label="Mengerti" onPress={() => setExplain(false)} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kicker: { ...latinFont, color: colors.muted, fontWeight: '700' },
  hearts: { color: '#D32F2F', fontSize: 18, letterSpacing: 2 },
  level: { ...latinFont, color: colors.primary, fontWeight: '800' },
  prompt: { ...latinFont, fontWeight: '700' },
  verse: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  token: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  tokenArabic: { fontSize: 28, lineHeight: 44 },
  confetti: { ...latinFont, color: colors.success, fontWeight: '800', textAlign: 'center' },
  options: { gap: 8 },
  option: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 14 },
  correct: { backgroundColor: '#E8F5E9', borderColor: colors.success },
  wrong: { backgroundColor: '#FFEBEE', borderColor: colors.danger },
  optionText: { ...latinFont, fontWeight: '700', textAlign: 'center' },
  optionArabic: { ...arabicFont, fontSize: 26, lineHeight: 40, textAlign: 'center' },
  explainTitle: { ...latinFont, fontSize: 20, fontWeight: '800', color: colors.danger },
  explainBody: { ...latinFont, lineHeight: 22 },
  empty: { ...latinFont, color: colors.muted },
});
