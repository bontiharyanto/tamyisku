import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { withRetry } from '@/lib/retry';

export type VerseToken = {
  arabic: string;
  category: string;
  translation: string;
  audio_url: string | null;
};

export type JuzQuestion = {
  id: string;
  juzNumber: number;
  surahNumber: number;
  ayahNumber: number;
  skillLevel: number;
  prompt: string;
  highlightedWord: string;
  verseWords: VerseToken[];
  options: string[];
  correctAnswer: string;
  explanation: string;
  audioUrl: string | null;
};

export type JuzScore = {
  juzNumber: number;
  bestScore: number;
};

export type JuzQuizSave = {
  bestScore: number;
  xpEarned: number;
  unlockedNext: boolean;
  nextJuz: number | null;
};

const PASSING_JUZ_SCORE = 80;

export function juzUnlocked(juzNumber: number, scores: JuzScore[], admin: boolean) {
  if (admin || juzNumber === 1) return true;
  const previous = scores.find((item) => item.juzNumber === juzNumber - 1);
  return (previous?.bestScore ?? 0) >= PASSING_JUZ_SCORE;
}

function asTokens(value: unknown): VerseToken[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      arabic: String(row.arabic ?? ''),
      category: String(row.category ?? 'Isim'),
      translation: String(row.translation ?? ''),
      audio_url: row.audio_url ? String(row.audio_url) : null,
    };
  });
}

export async function fetchJuzQuestions(juzNumber: number) {
  if (!isSupabaseConfigured) return [] as JuzQuestion[];
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('juz_number', juzNumber)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const options = Array.isArray(record.options) ? record.options.map((item) => String(item)) : [];
    return {
      id: String(record.id),
      juzNumber: Number(record.juz_number),
      surahNumber: Number(record.surah_number),
      ayahNumber: Number(record.ayah_number),
      skillLevel: Number(record.skill_level),
      prompt: String(record.prompt),
      highlightedWord: String(record.highlighted_word),
      verseWords: asTokens(record.verse_words),
      options,
      correctAnswer: String(record.correct_answer),
      explanation: String(record.explanation),
      audioUrl: record.audio_url ? String(record.audio_url) : null,
    };
  });
}

export async function fetchJuzScores() {
  if (!isSupabaseConfigured) return [] as JuzScore[];
  const { data, error } = await supabase.from('user_juz_scores').select('juz_number, best_score');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    juzNumber: Number((row as { juz_number: number }).juz_number),
    bestScore: Number((row as { best_score: number }).best_score),
  }));
}

export async function fetchUserXp() {
  if (!isSupabaseConfigured) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { data, error } = await supabase.from('users').select('xp').eq('id', auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as { xp?: number } | null)?.xp ?? 0);
}

export async function saveJuzQuiz(input: {
  juzNumber: number;
  score: number;
  timeSpent: number;
  heartsLeft: number;
  correct: number;
}) {
  if (!isSupabaseConfigured) {
    return { bestScore: input.score, xpEarned: input.correct * 10, unlockedNext: input.score >= PASSING_JUZ_SCORE, nextJuz: input.juzNumber < 30 ? input.juzNumber + 1 : null };
  }
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('save_juz_quiz', {
      p_juz: input.juzNumber,
      p_score: input.score,
      p_time_spent: input.timeSpent,
      p_hearts_left: input.heartsLeft,
      p_correct: input.correct,
    });
    if (error) throw new Error(error.message);
    const payload = data as { best_score?: number; xp_earned?: number; unlocked_next?: boolean; next_juz?: number | null };
    return {
      bestScore: Number(payload.best_score ?? input.score),
      xpEarned: Number(payload.xp_earned ?? 0),
      unlockedNext: Boolean(payload.unlocked_next),
      nextJuz: payload.next_juz ?? null,
    } satisfies JuzQuizSave;
  });
}
