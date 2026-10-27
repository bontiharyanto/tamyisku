import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteLesson, deleteQuiz, deleteWord, fetchAdminContent, upsertLesson, upsertQuiz, upsertWord } from '@/lib/api';
import type { Lesson, QuranWord, QuizItem } from '@/lib/types';
import { filterWords, pageCount, pageSlice, WORD_FILTERS, type WordFilter } from '@/lib/wordCatalog';
import { notify } from '@/components/ui';

export type AdminTab = 'lessons' | 'words' | 'quizzes';

export const emptyLesson = (): Lesson => ({ id: '', title: '', level: 1, category: '', description: '', orderIndex: 1 });
export const emptyWord = (lessonId: string): QuranWord => ({
  id: '',
  lessonId,
  surahNumber: 1,
  ayahNumber: 1,
  wordPosition: 1,
  arabicText: '',
  transliteration: '',
  translation: '',
  tamyizCategory: 'Isim',
  colorCode: '#0D47A1',
  audioUrl: '',
});
export const emptyQuiz = (lessonId: string): QuizItem => ({
  id: '',
  lessonId,
  question: 'Termasuk kategori apa kata ini?',
  correctAnswer: 'Isim',
  scorePoints: 10,
  arabicText: '',
  translation: '',
  explanation: '',
  audioUrl: '',
  orderIndex: 1,
});

export function useAdminContent(dataVersion: number) {
  const [tab, setTab] = useState<AdminTab>('lessons');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [words, setWords] = useState<QuranWord[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [lesson, setLesson] = useState<Lesson>(emptyLesson());
  const [word, setWord] = useState<QuranWord>(emptyWord(''));
  const [quiz, setQuiz] = useState<QuizItem>(emptyQuiz(''));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WordFilter>('Semua');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const content = await fetchAdminContent();
      setLessons(content.lessons);
      setWords(content.words);
      setQuizzes(content.quizzes);
      setWord((current) => (current.lessonId ? current : emptyWord(content.lessons[0]?.id ?? '')));
      setQuiz((current) => (current.lessonId ? current : emptyQuiz(content.lessons[0]?.id ?? '')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().catch((cause: unknown) => notify(cause instanceof Error ? cause.message : 'Gagal memuat', 'err'));
  }, [reload, dataVersion]);

  const filteredWords = useMemo(() => filterWords(words, query, filter), [words, query, filter]);
  const pages = pageCount(filteredWords.length);
  const visibleWords = pageSlice(filteredWords, Math.min(page, pages - 1));

  async function run(action: () => Promise<void>, message: string) {
    try {
      await action();
      await reload();
      notify(message);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan', 'err');
    }
  }

  return {
    tab,
    setTab,
    lessons,
    quizzes,
    lesson,
    setLesson,
    word,
    setWord,
    quiz,
    setQuiz,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(0);
    },
    filter,
    setFilter: (value: WordFilter) => {
      setFilter(value);
      setPage(0);
    },
    page,
    setPage,
    pages,
    loading,
    uploading,
    setUploading,
    visibleWords,
    reload,
    run,
    saveLesson: () => run(async () => { await upsertLesson(lesson); setLesson(emptyLesson()); }, 'Modul disimpan'),
    removeLesson: (id: string) => run(() => deleteLesson(id), 'Modul dihapus'),
    saveWord: () => run(async () => { await upsertWord({ ...word, audioUrl: word.audioUrl || null }); setWord(emptyWord(word.lessonId)); }, 'Kata disimpan'),
    removeWord: (id: string) => run(() => deleteWord(id), 'Kata dihapus'),
    saveQuiz: () => run(async () => { await upsertQuiz(quiz); setQuiz(emptyQuiz(quiz.lessonId)); }, 'Kuis disimpan'),
    removeQuiz: (id: string) => run(() => deleteQuiz(id), 'Kuis dihapus'),
    filters: WORD_FILTERS,
  };
}
