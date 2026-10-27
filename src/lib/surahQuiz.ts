import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { withRetry } from '@/lib/retry';

export type VerseToken = {
  arabic: string;
  category: string;
  translation: string;
  audio_url: string | null;
};

export type SurahQuestion = {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  skillLevel: number;
  formulaKey: string | null;
  prompt: string;
  highlightedWord: string;
  verseWords: VerseToken[];
  options: string[];
  optionRationales: string[];
  correctAnswer: string;
  explanation: string;
  audioUrl: string | null;
};

export type SurahScore = {
  surahNumber: number;
  bestScore: number;
};

export type SurahQuizSave = {
  bestScore: number;
  xpEarned: number;
  unlockedNext: boolean;
  nextSurah: number | null;
};

export const PASSING_SURAH_SCORE = 80;

const LEVELS = ['', 'Level 1 · Huruf', 'Level 2 · Isim dan Fi\'il', 'Level 3 · Mufrodat', 'Level 4 · Lagu Tamyiz'];

export function surahLevelLabel(level: number) {
  return LEVELS[level] ?? 'Kuis Tamyiz';
}

const ARABIC_RUN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

export function displayQuizText(value: string) {
  const plain = value
    .replace(/\$\\text\{([^}]*)\}\$/g, '$1')
    .replace(/#1976D2/gi, 'biru')
    .replace(/#D32F2F/gi, 'merah')
    .replace(/#388E3C/gi, 'hijau')
    .replace(/#FF8F00/gi, 'kuning');
  return plain.replace(ARABIC_RUN, (word) => `\u2068${word}\u2069`);
}

export function surahUnlocked(surahNumber: number, scores: SurahScore[], surahsWithQuestions: number[], admin: boolean) {
  if (admin || surahNumber === 1) return true;
  const bank = new Set(surahsWithQuestions);
  for (let previous = surahNumber - 1; previous >= 1; previous -= 1) {
    if (!bank.has(previous)) continue;
    const score = scores.find((item) => item.surahNumber === previous);
    return (score?.bestScore ?? 0) >= PASSING_SURAH_SCORE;
  }
  return true;
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

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export async function fetchSurahQuestions(surahNumber: number) {
  if (!isSupabaseConfigured) return [] as SurahQuestion[];
  const { data, error } = await supabase.from('surah_quizzes').select('*').eq('surah_number', surahNumber).order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      surahNumber: Number(record.surah_number),
      ayahNumber: Number(record.ayah_number),
      skillLevel: Number(record.skill_level),
      formulaKey: record.formula_key ? String(record.formula_key) : null,
      prompt: String(record.prompt),
      highlightedWord: String(record.highlighted_word),
      verseWords: asTokens(record.verse_words),
      options: asStrings(record.options),
      optionRationales: asStrings(record.option_rationales),
      correctAnswer: String(record.correct_answer),
      explanation: String(record.explanation),
      audioUrl: record.audio_url ? String(record.audio_url) : null,
    };
  });
}

export async function fetchSurahScores() {
  if (!isSupabaseConfigured) return [] as SurahScore[];
  const { data, error } = await supabase.from('user_surah_progress').select('surah_number, score');
  if (error) throw new Error(error.message);
  const best = new Map<number, number>();
  for (const row of data ?? []) {
    const surahNumber = Number((row as { surah_number: number }).surah_number);
    const score = Number((row as { score: number }).score);
    best.set(surahNumber, Math.max(best.get(surahNumber) ?? 0, score));
  }
  return [...best.entries()].map(([surahNumber, bestScore]) => ({ surahNumber, bestScore }));
}

export async function fetchSurahsWithQuestions() {
  if (!isSupabaseConfigured) return [] as number[];
  const numbers = new Set<number>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('surah_quizzes')
      .select('surah_number')
      .order('surah_number')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) numbers.add(Number((row as { surah_number: number }).surah_number));
    if (!data || data.length < pageSize) break;
  }
  return [...numbers];
}

export async function saveSurahQuiz(input: { surahNumber: number; score: number; timeSpent: number; correct: number }) {
  if (!isSupabaseConfigured) {
    return {
      bestScore: input.score,
      xpEarned: input.correct * 10,
      unlockedNext: input.score >= PASSING_SURAH_SCORE && input.surahNumber < 114,
      nextSurah: input.surahNumber < 114 ? input.surahNumber + 1 : null,
    } satisfies SurahQuizSave;
  }
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('save_surah_quiz', {
      p_surah: input.surahNumber,
      p_score: input.score,
      p_time_spent: input.timeSpent,
      p_correct: input.correct,
    });
    if (error) throw new Error(error.message);
    const payload = data as { best_score?: number; xp_earned?: number; unlocked_next?: boolean; next_surah?: number | null };
    return {
      bestScore: Number(payload.best_score ?? input.score),
      xpEarned: Number(payload.xp_earned ?? 0),
      unlockedNext: Boolean(payload.unlocked_next),
      nextSurah: payload.next_surah ?? null,
    } satisfies SurahQuizSave;
  });
}
