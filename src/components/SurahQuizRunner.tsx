import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { playFeedback, playUrl } from '@/lib/audio';
import { displayQuizText, surahLevelLabel, type SurahQuestion } from '@/lib/surahQuiz';
import { surahName } from '@/lib/surahs';
import { arabicFont, colors, latinFont } from '@/lib/theme';
import { useAppearance } from '@/lib/appearance';
import { useViewport } from '@/lib/viewport';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, Card } from '@/components/ui';

const HEARTS = 5;

function MixedQuizText({ value, style, align = 'start' }: { value: string; style: TextStyle; align?: 'start' | 'center' }) {
  const plain = displayQuizText(value).replace(/[\u2066\u2067\u2068\u2069]/g, '');
  const parts = plain.split(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/).filter((part) => part.length > 0);
  const arabicSize = (typeof style.fontSize === 'number' ? style.fontSize : 16) + 6;
  return (
    <View style={[styles.mixedRow, align === 'center' && styles.mixedCenter]}>
      {parts.map((part, index) => {
        const arabic = /[\u0600-\u06FF]/.test(part);
        return (
          <Text key={`${index}-${part}`} style={[arabic ? [styles.arabicInline, { fontSize: arabicSize, lineHeight: arabicSize + 14 }] : style, styles.mixedChunk]}>
            {part}
          </Text>
        );
      })}
    </View>
  );
}

const LIGHT_TOKEN: Record<string, { backgroundColor: string; borderColor: string; textColor: string; label: string }> = {
  Isim: { backgroundColor: '#E3F2FD', borderColor: '#1976D2', textColor: '#0D47A1', label: 'Isim' },
  "Fi'il": { backgroundColor: '#FFEBEE', borderColor: '#D32F2F', textColor: '#B71C1C', label: "Fi'il" },
  Huruf: { backgroundColor: '#E8F5E9', borderColor: '#388E3C', textColor: '#1B5E20', label: 'Huruf' },
  Campuran: { backgroundColor: '#F3EDE4', borderColor: '#6D4C41', textColor: '#4E342E', label: 'Huruf + Isim' },
  HurufFiil: { backgroundColor: '#FFF8E1', borderColor: '#6D4C00', textColor: '#6D4C00', label: "Huruf + Fi'il" },
  Teks: { backgroundColor: '#F7F4EE', borderColor: '#C9C1B5', textColor: '#1C1915', label: 'Kata' },
};

const DARK_TOKEN: Record<string, { backgroundColor: string; borderColor: string; textColor: string; label: string }> = {
  Isim: { backgroundColor: '#0D2137', borderColor: '#42A5F5', textColor: '#90CAF9', label: 'Isim' },
  "Fi'il": { backgroundColor: '#370D0D', borderColor: '#EF5350', textColor: '#EF9A9A', label: "Fi'il" },
  Huruf: { backgroundColor: '#0D3715', borderColor: '#66BB6A', textColor: '#A5D6A7', label: 'Huruf' },
  Campuran: { backgroundColor: '#2A2118', borderColor: '#A1887F', textColor: '#D7CCC8', label: 'Huruf + Isim' },
  HurufFiil: { backgroundColor: '#2A2108', borderColor: '#D4AF37', textColor: '#FFE082', label: "Huruf + Fi'il" },
  Teks: { backgroundColor: '#132A23', borderColor: '#1F4237', textColor: '#F4EFE6', label: 'Kata' },
};

export function SurahQuizRunner({
  surahNumber,
  questions,
  onFinish,
}: {
  surahNumber: number;
  questions: SurahQuestion[];
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
  const question = questions[index];
  const { compact, expanded } = useViewport();
  const { dark } = useAppearance();
  const tokens = dark ? DARK_TOKEN : LIGHT_TOKEN;
  const optionBasis = compact || expanded ? '100%' : '48%';

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

  function retry() {
    setPicked(null);
    setExplain(false);
  }

  function next() {
    const remaining = hearts;
    if (index + 1 >= questions.length || remaining === 0) {
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
    setExplain(false);
  }

  if (!question) return <Text style={styles.empty}>Soal surah ini belum tersedia.</Text>;

  const pickedIndex = question.options.indexOf(picked ?? '');
  const pickedRationale = pickedIndex >= 0 ? question.optionRationales[pickedIndex] : null;
  const audio = question.audioUrl ?? question.verseWords.find((word) => word.arabic === question.highlightedWord)?.audio_url ?? null;

  const wrongPick = Boolean(picked && picked !== question.correctAnswer);
  const hint = [
    'Baca dari kanan.',
    'Bingkai hijau adalah kata yang ditanya.',
    question.verseWords.some((word) => word.category === 'Campuran') ? 'Kartu cokelat berisi huruf dan isim.' : '',
    question.verseWords.some((word) => word.category === 'HurufFiil') ? 'Kartu kuning berisi huruf dan fi\'il.' : '',
  ].filter(Boolean).join(' ');

  return (
    <View style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={styles.kicker}>QS {surahName(surahNumber)} · {index + 1}/{questions.length}</Text>
        <Text style={styles.hearts}>{'♥'.repeat(hearts)}{'♡'.repeat(Math.max(0, HEARTS - hearts))}</Text>
      </View>
      <Text style={styles.level}>{surahLevelLabel(question.skillLevel)}{question.formulaKey ? ` · ${question.formulaKey}` : ''}</Text>
      <View style={[styles.stage, expanded && styles.stageRow]}>
        <View style={[styles.questionCol, !expanded && styles.full]}>
          <Card style={styles.questionCard}>
            <MixedQuizText value={question.prompt} style={compact ? styles.promptCompact : styles.prompt} />
            <View style={styles.verse}>
              {question.verseWords.map((word, wordIndex) => {
                const visual = tokens[word.category] ?? tokens.Teks;
                const marked = word.arabic === question.highlightedWord;
                return (
                  <View key={`${word.arabic}-${wordIndex}`} style={[styles.token, marked && styles.marked, { backgroundColor: visual.backgroundColor, borderColor: marked ? colors.primary : visual.borderColor }]}>
                    <Text style={[arabicFont, compact ? styles.tokenArabicCompact : styles.tokenArabic, { color: visual.textColor }]}>{word.arabic}</Text>
                    <Text style={[styles.tokenLabel, { color: visual.borderColor }]}>{visual.label}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>{hint}</Text>
            <Button label="Dengarkan kata" tone="ghost" disabled={!audio} onPress={() => audio && playUrl(audio)} />
            {picked && picked === question.correctAnswer ? <Animated.Text style={[styles.confetti, { opacity: burst }]}>+10 XP</Animated.Text> : null}
            {pickedRationale ? <MixedQuizText value={pickedRationale} style={styles.rationale} /> : null}
          </Card>
        </View>
        <View style={[styles.answerCol, !expanded && styles.full]}>
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
                  style={[styles.option, { flexBasis: optionBasis === '100%' ? '100%' : '46%' }, correct && styles.correct, wrong && styles.wrong]}
                >
                  <MixedQuizText value={option} style={styles.optionText} align="center" />
                </Pressable>
              );
            })}
          </View>
          {picked ? (
            <View style={[styles.actions, !compact && styles.actionsRow]}>
              {wrongPick ? (
                <View style={styles.action}>
                  <Button label="Ulangi soal ini" tone="ghost" onPress={retry} />
                </View>
              ) : null}
              <View style={styles.action}>
                <Button label={index + 1 === questions.length || hearts === 0 ? 'Lihat hasil' : 'Lanjut'} onPress={next} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
      <BottomSheet visible={explain} onClose={() => setExplain(false)} dismissOnBackdrop={false}>
        <Text style={styles.explainTitle}>Jawaban belum tepat</Text>
        <MixedQuizText value={question.explanation} style={styles.explainBody} />
        <Button label="Ulangi soal ini" onPress={retry} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, width: '100%' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kicker: { ...latinFont, color: colors.muted, fontWeight: '700', flex: 1 },
  hearts: { color: '#D32F2F', fontSize: 18, letterSpacing: 2 },
  level: { ...latinFont, color: colors.primary, fontWeight: '800' },
  stage: { gap: 12, width: '100%' },
  stageRow: { flexDirection: 'row', alignItems: 'flex-start' },
  full: { width: '100%' },
  questionCol: { flex: 1.15, minWidth: 0 },
  answerCol: { flex: 0.85, minWidth: 0, gap: 12 },
  questionCard: { flexDirection: 'column', alignItems: 'stretch', width: '100%' },
  prompt: { ...latinFont, fontWeight: '700', fontSize: 22, lineHeight: 32 },
  promptCompact: { ...latinFont, fontWeight: '700', fontSize: 18, lineHeight: 28 },
  mixedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', width: '100%' },
  mixedCenter: { justifyContent: 'center' },
  mixedChunk: { flexShrink: 1, maxWidth: '100%' },
  arabicInline: { ...arabicFont, writingDirection: 'rtl' },
  verse: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8, width: '100%' },
  token: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', maxWidth: '100%' },
  marked: { borderWidth: 3 },
  hint: { ...latinFont, color: colors.muted, fontSize: 13, lineHeight: 20, width: '100%' },
  tokenArabic: { fontSize: 34, lineHeight: 52 },
  tokenArabicCompact: { fontSize: 26, lineHeight: 40 },
  tokenLabel: { ...latinFont, fontSize: 11, fontWeight: '800' },
  rationale: { ...latinFont, lineHeight: 22, color: colors.text },
  confetti: { ...latinFont, color: colors.success, fontWeight: '800', textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  option: { flexGrow: 1, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  correct: { backgroundColor: '#E8F5E9', borderColor: '#388E3C' },
  wrong: { backgroundColor: '#FFEBEE', borderColor: '#D32F2F' },
  optionText: { ...latinFont, fontWeight: '700', textAlign: 'center' },
  actions: { gap: 8, width: '100%' },
  actionsRow: { flexDirection: 'row' },
  action: { flex: 1, minWidth: 160 },
  explainTitle: { ...latinFont, fontSize: 20, fontWeight: '800', color: colors.danger },
  explainBody: { ...latinFont, lineHeight: 22 },
  empty: { ...latinFont, color: colors.muted },
});
