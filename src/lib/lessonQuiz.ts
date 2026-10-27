import { fetchSurahQuestions, type SurahQuestion } from '@/lib/surahQuiz';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type RawWord = {
  surah_number: number;
};

async function sampleWords(lessonId: string) {
  const { data, error } = await supabase
    .from('quran_words')
    .select('surah_number')
    .eq('lesson_id', lessonId)
    .order('ayah_number')
    .order('word_position')
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as RawWord | undefined;
  return row?.surah_number ?? 0;
}

export async function loadSurahQuizForLesson(lessonId: string) {
  if (!isSupabaseConfigured) return { surahNumber: 1, questions: [] as SurahQuestion[] };
  const surahNumber = await sampleWords(lessonId);
  if (surahNumber >= 1 && surahNumber <= 114) {
    const stored = await fetchSurahQuestions(surahNumber);
    return { surahNumber, questions: stored };
  }
  return { surahNumber, questions: [] as SurahQuestion[] };
}
