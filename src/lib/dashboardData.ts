import { fetchLessons, fetchProgress } from '@/lib/api';
import { jakartaClock, jakartaDate, shiftIsoDate } from '@/lib/dates';
import { lessonNodeState } from '@/lib/leveling';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { surahName } from '@/lib/surahs';
import type { Lesson, ProgressRow } from '@/lib/types';

const XP_BAND = 500;

const LEVEL_TITLES = ['Pembuka Mushaf', 'Pembaca Huruf', 'Pengenal Isim', 'Pejuang Tamyiz', 'Penjaga Ayat', 'Pengulang Setia'];

export type SurahAttempt = {
  id: string;
  surahNumber: number;
  title: string;
  score: number;
  timeSpent: number;
  completedAt: string;
};

export type StudentDashboardData = {
  xp: number;
  level: number;
  levelTitle: string;
  intoBand: number;
  band: number;
  streak: number;
  longestStreak: number;
  activeLesson: Lesson | null;
  activePercent: number;
  wordsInPassedModules: number;
  averageScore: number | null;
  scoreLabel: string;
  weekSeconds: number;
  recent: SurahAttempt[];
  review: ProgressRow[];
};

export type ReviewWord = {
  id: string;
  arabicText: string;
  translation: string;
  category: string;
  surahNumber: number;
  ayahNumber: number;
  position: number;
  lessonId: string;
  need: 'audio' | 'warna';
};

export type StaffSnapshot = {
  modules: number;
  missingAudio: number;
  missingColor: number;
  activeStudents: number;
  averageScore: number;
  review: ReviewWord[];
};

export function levelFromXp(xp: number) {
  const safe = Math.max(0, xp);
  return {
    level: Math.floor(safe / XP_BAND) + 1,
    levelTitle: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor(safe / XP_BAND))] ?? LEVEL_TITLES[0],
    intoBand: safe % XP_BAND,
    band: XP_BAND,
  };
}

export function greetingFor(name: string) {
  const hour = jakartaClock().hour;
  const day = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam';
  return `${day}, ${name || 'Santri'}`;
}

function weekStartIso() {
  const today = jakartaDate();
  const weekday = new Date(`${today}T12:00:00+07:00`).getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return shiftIsoDate(today, -offset);
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function loadStudentDashboard(staff: boolean): Promise<StudentDashboardData> {
  const [lessons, progress, xp, streakRow, attempts] = await Promise.all([
    fetchLessons(),
    fetchProgress(),
    loadXp(),
    loadStreak(),
    loadSurahAttempts(),
  ]);
  const active = lessons.find((lesson) => lessonNodeState(lesson, lessons, progress, staff) === 'active') ?? null;
  const activeRow = active ? progress.find((row) => row.lessonId === active.id) : undefined;
  const passedIds = progress.filter((row) => row.isCompleted).map((row) => row.lessonId);
  const wordsInPassedModules = await countWords(passedIds);
  const lessonScores = progress.map((row) => row.score);
  const surahBest = bestBySurah(attempts).map((row) => row.score);
  const source = lessonScores.length ? lessonScores : surahBest;
  const weekStart = weekStartIso();
  const weekSeconds = attempts
    .filter((row) => row.completedAt.slice(0, 10) >= weekStart)
    .reduce((sum, row) => sum + row.timeSpent, 0);
  const level = levelFromXp(xp);
  return {
    xp,
    ...level,
    streak: streakRow.current,
    longestStreak: streakRow.longest,
    activeLesson: active,
    activePercent: activeRow?.score ?? 0,
    wordsInPassedModules,
    averageScore: average(source),
    scoreLabel: lessonScores.length ? 'Rata-rata skor kuis modul' : 'Rata-rata skor kuis surah',
    weekSeconds,
    recent: attempts.slice(0, 5),
    review: [...progress].filter((row) => row.score < 80).sort((left, right) => left.score - right.score).slice(0, 3),
  };
}

async function loadXp() {
  if (!isSupabaseConfigured) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { data, error } = await supabase.from('users').select('xp').eq('id', auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as { xp?: number } | null)?.xp ?? 0);
}

async function loadStreak() {
  if (!isSupabaseConfigured) return { current: 0, longest: 0 };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { current: 0, longest: 0 };
  const { data, error } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { current_streak?: number; longest_streak?: number } | null;
  return { current: Number(row?.current_streak ?? 0), longest: Number(row?.longest_streak ?? 0) };
}

async function loadSurahAttempts(): Promise<SurahAttempt[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('user_surah_progress')
    .select('id, surah_number, score, time_spent, completed_at')
    .order('completed_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as { id: string; surah_number: number; score: number; time_spent: number; completed_at: string };
    return {
      id: record.id,
      surahNumber: record.surah_number,
      title: surahName(record.surah_number),
      score: record.score,
      timeSpent: record.time_spent,
      completedAt: record.completed_at,
    };
  });
}

function bestBySurah(attempts: SurahAttempt[]) {
  const best = new Map<number, SurahAttempt>();
  for (const attempt of attempts) {
    const current = best.get(attempt.surahNumber);
    if (!current || attempt.score > current.score) best.set(attempt.surahNumber, attempt);
  }
  return [...best.values()];
}

async function countWords(lessonIds: string[]) {
  if (!isSupabaseConfigured || lessonIds.length === 0) return 0;
  const { count, error } = await supabase.from('quran_words').select('id', { count: 'exact', head: true }).in('lesson_id', lessonIds);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadStaffSnapshot(): Promise<StaffSnapshot> {
  if (!isSupabaseConfigured) {
    return { modules: 0, missingAudio: 0, missingColor: 0, activeStudents: 0, averageScore: 0, review: [] };
  }
  const { data, error } = await supabase.rpc('staff_class_snapshot');
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  const review = Array.isArray(row.review) ? row.review : [];
  return {
    modules: Number(row.modules ?? 0),
    missingAudio: Number(row.missing_audio ?? 0),
    missingColor: Number(row.missing_color ?? 0),
    activeStudents: Number(row.active_students ?? 0),
    averageScore: Number(row.average_score ?? 0),
    review: review.map((item) => {
      const word = item as Record<string, unknown>;
      return {
        id: String(word.id),
        arabicText: String(word.arabic_text ?? ''),
        translation: String(word.translation ?? ''),
        category: String(word.tamyiz_category ?? ''),
        surahNumber: Number(word.surah_number ?? 0),
        ayahNumber: Number(word.ayah_number ?? 0),
        position: Number(word.word_position ?? 0),
        lessonId: String(word.lesson_id ?? ''),
        need: word.need === 'warna' ? 'warna' : 'audio',
      };
    }),
  };
}

export function formatStudyTime(seconds: number) {
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam ${minutes % 60} mnt`;
}
