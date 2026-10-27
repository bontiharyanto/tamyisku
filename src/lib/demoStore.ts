import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { BADGE_CATALOG } from '@/lib/badges';
import { jakartaDate, shiftIsoDate } from '@/lib/dates';
import type { AppUser, Celebration, EarnedBadge, Lesson, ManagedUser, NotifyPrefs, ProgressRow, QuranWord, QuizItem, Streak, Subscription } from '@/lib/types';

const STORAGE_KEY = 'tamyiz.demo.v1';

type Payment = {
  userId: string;
  amount: number;
  status: string;
  method: string;
  createdAt: string;
};

type DemoStreak = Streak;

type State = {
  currentUserId: string | null;
  users: AppUser[];
  subscriptions: Record<string, Subscription>;
  lessons: Lesson[];
  words: QuranWord[];
  quizzes: QuizItem[];
  progress: ProgressRow[];
  payments: Payment[];
  streaks: Record<string, DemoStreak>;
  unlocked: Record<string, { badgeId: string; unlockedAt: string }[]>;
  pending: Record<string, { streak: boolean; badges: string[] }>;
  notify: Record<string, NotifyPrefs>;
};

const lesson1 = '11111111-1111-4111-8111-111111111111';
const lesson2 = '22222222-2222-4222-8222-222222222222';

function seed(): State {
  return {
    currentUserId: null,
    users: [
      {
        id: 'demo-admin',
        email: 'admin@tamyiz.test',
        fullName: 'Admin Tamyiz',
        role: 'admin',
      },
    ],
    subscriptions: {
      'demo-admin': { status: 'active', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 30 * 86400000).toISOString(), paymentMethod: 'manual' },
    },
    lessons: [
      {
        id: lesson1,
        title: 'Modul 1 — Basmalah',
        level: 1,
        category: 'Pengenalan',
        description: 'Uji coba gratis. Bedakan Huruf, Isim, dan kosa kata Tamyiz pada basmalah.',
        orderIndex: 1,
      },
      {
        id: lesson2,
        title: 'Modul 2 — Alhamdulillah',
        level: 2,
        category: 'Isim & Huruf',
        description: 'Modul premium. Latihan kata pada ayat kedua Al-Fatihah.',
        orderIndex: 2,
      },
    ],
    words: [
      word(lesson1, 1, 1, 1, 'بِسْمِ', 'bismi', 'Dengan nama', 'Huruf', '#388E3C'),
      word(lesson1, 1, 1, 2, 'ٱللَّهِ', 'allahi', 'Allah', 'Isim', '#1976D2'),
      word(lesson1, 1, 1, 3, 'ٱلرَّحْمَٰنِ', 'ar-rahmani', 'Yang Maha Pengasih', 'Tamyiz 1', '#FBC02D'),
      word(lesson1, 1, 1, 4, 'ٱلرَّحِيمِ', 'ar-rahimi', 'Yang Maha Penyayang', 'Tamyiz 1', '#FBC02D'),
      word(lesson2, 1, 2, 1, 'ٱلْحَمْدُ', 'al-hamdu', 'Segala puji', 'Isim', '#1976D2'),
      word(lesson2, 1, 2, 2, 'لِلَّهِ', 'lillahi', 'bagi Allah', 'Huruf', '#388E3C'),
      word(lesson2, 1, 2, 3, 'رَبِّ', 'rabbi', 'Tuhan', 'Tamyiz 2', '#FBC02D'),
      word(lesson2, 1, 2, 4, 'ٱلْعَٰلَمِينَ', 'al-alamin', 'semesta alam', 'Isim', '#1976D2'),
    ],
    quizzes: [
      quiz('q1', lesson1, 'بِسْمِ', 'Dengan nama', 'Huruf', 'Kata ini termasuk Huruf (kata tugas) dengan kode warna hijau.', 1),
      quiz('q2', lesson1, 'ٱللَّهِ', 'Allah', 'Isim', 'Kata ini termasuk Isim (kata benda) dengan kode warna biru.', 2),
      quiz('q3', lesson1, 'ٱلرَّحْمَٰنِ', 'Yang Maha Pengasih', 'Tamyiz 1', 'Kata ini termasuk Tamyiz 1 dengan kode warna kuning.', 3),
      quiz('q4', lesson1, 'خَلَقَ', 'Dia menciptakan', "Fi'il", "Kata ini termasuk Fi'il (kata kerja) dengan kode warna merah.", 4),
      quiz('q5', lesson2, 'ٱلْحَمْدُ', 'Segala puji', 'Isim', 'Kata ini termasuk Isim dengan kode warna biru.', 1),
      quiz('q6', lesson2, 'لِلَّهِ', 'bagi Allah', 'Huruf', 'Kata ini termasuk Huruf dengan kode warna hijau.', 2),
    ],
    progress: [],
    payments: [],
    streaks: {},
    unlocked: {},
    pending: {},
    notify: {},
  };
}

function ensureGame() {
  state.streaks ??= {};
  state.unlocked ??= {};
  state.pending ??= {};
  state.notify ??= {};
}

function word(
  lessonId: string,
  surah: number,
  ayah: number,
  position: number,
  arabic: string,
  transliteration: string,
  translation: string,
  category: string,
  color: string,
): QuranWord {
  return {
    id: `${lessonId}-${position}`,
    lessonId,
    surahNumber: surah,
    ayahNumber: ayah,
    wordPosition: position,
    arabicText: arabic,
    transliteration,
    translation,
    tamyizCategory: category,
    colorCode: color,
    audioUrl: null,
  };
}

function quiz(
  id: string,
  lessonId: string,
  arabic: string,
  translation: string,
  correct: string,
  explanation: string,
  orderIndex: number,
): QuizItem {
  return {
    id,
    lessonId,
    question: 'Termasuk kategori apa kata ini?',
    correctAnswer: correct,
    scorePoints: 10,
    arabicText: arabic,
    translation,
    explanation,
    audioUrl: null,
    orderIndex,
  };
}

let state = seed();
const listeners = new Set<() => void>();

function emit() {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export async function hydrateDemo() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as State;
    if (parsed.lessons?.length) {
      state = parsed;
      ensureGame();
    }
  } catch {
    state = seed();
  }
}

export function subscribeDemo(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function demoCurrentUser() {
  return state.users.find((user) => user.id === state.currentUserId) ?? null;
}

export function demoSubscription(userId: string): Subscription {
  return state.subscriptions[userId] ?? { status: 'inactive', startDate: null, endDate: null, paymentMethod: null };
}

function canAccess(lessonId: string) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson) return false;
  const user = demoCurrentUser();
  if (!user) return false;
  if (lesson.orderIndex === 1 || user.role === 'admin' || user.role === 'tutor') return true;
  const sub = demoSubscription(user.id);
  return sub.status === 'active' && !!sub.endDate && new Date(sub.endDate).getTime() > Date.now();
}

export function demoSignIn(email: string, fullName?: string) {
  const normalized = email.trim().toLowerCase();
  let user = state.users.find((item) => item.email === normalized);
  if (!user) {
    user = {
      id: Crypto.randomUUID(),
      email: normalized,
      fullName: fullName?.trim() || normalized.split('@')[0],
      role: normalized === 'admin@tamyiz.test' ? 'admin' : 'user',
    };
    state.users.push(user);
    state.subscriptions[user.id] = { status: 'inactive', startDate: null, endDate: null, paymentMethod: null };
  }
  state.currentUserId = user.id;
  emit();
  return user;
}

export function demoSignOut() {
  state.currentUserId = null;
  emit();
}

export function demoUpdateName(fullName: string) {
  const user = demoCurrentUser();
  if (!user) return;
  user.fullName = fullName.trim();
  emit();
}

export function demoLessons() {
  return [...state.lessons].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function demoWords(lessonId: string) {
  if (!canAccess(lessonId)) throw new Error('Langganan diperlukan untuk modul ini');
  return state.words
    .filter((item) => item.lessonId === lessonId)
    .sort((a, b) => a.wordPosition - b.wordPosition)
    .map((item) => ({ ...item }));
}

export function demoQuizzes(lessonId: string) {
  if (!canAccess(lessonId)) throw new Error('Langganan diperlukan untuk modul ini');
  return state.quizzes
    .filter((item) => item.lessonId === lessonId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => ({ ...item }));
}

export function demoProgress(): ProgressRow[] {
  const user = demoCurrentUser();
  if (!user) return [];
  return state.progress
    .filter((item) => item.id.startsWith(user.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function demoSaveProgress(lessonId: string, score: number) {
  const user = demoCurrentUser();
  if (!user) throw new Error('Masuk terlebih dahulu');
  if (!canAccess(lessonId)) throw new Error('Langganan diperlukan untuk modul ini');
  const lesson = state.lessons.find((item) => item.id === lessonId);
  const id = `${user.id}:${lessonId}`;
  const existing = state.progress.find((item) => item.id === id);
  const nextScore = Math.max(existing?.score ?? 0, Math.min(100, Math.max(0, score)));
  const row: ProgressRow = {
    id,
    lessonId,
    lessonTitle: lesson?.title ?? 'Modul',
    score: nextScore,
    isCompleted: nextScore >= 70,
    updatedAt: new Date().toISOString(),
  };
  state.progress = [row, ...state.progress.filter((item) => item.id !== id)];
  applyDemoRewards(user.id, nextScore);
  emit();
  return row;
}

function applyDemoRewards(userId: string, score: number) {
  ensureGame();
  const today = jakartaDate();
  const row = state.streaks[userId] ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  let current = row.currentStreak;
  let longest = row.longestStreak;
  let changed = false;
  if (row.lastActivityDate === today) {
    current = row.currentStreak;
  } else if (row.lastActivityDate && row.lastActivityDate === shiftIsoDate(today, -1)) {
    current += 1;
    longest = Math.max(longest, current);
    changed = true;
  } else {
    current = 1;
    longest = Math.max(longest, 1);
    changed = true;
  }
  state.streaks[userId] = { currentStreak: current, longestStreak: longest, lastActivityDate: today };
  const pending = state.pending[userId] ?? { streak: false, badges: [] };
  if (changed) pending.streak = true;
  const owned = new Set((state.unlocked[userId] ?? []).map((item) => item.badgeId));
  const done = state.progress.filter((item) => item.id.startsWith(`${userId}:`) && item.isCompleted).length;
  const unlock = (badgeId: string) => {
    if (owned.has(badgeId)) return;
    owned.add(badgeId);
    state.unlocked[userId] = [...(state.unlocked[userId] ?? []), { badgeId, unlockedAt: new Date().toISOString() }];
    pending.badges.push(badgeId);
  };
  if (current >= 3) unlock('streak_3_days');
  if (current >= 7) unlock('streak_7_days');
  if (done >= 5) unlock('modules_5');
  if (score >= 100) unlock('quiz_perfect');
  state.pending[userId] = pending;
}

export function demoOverview() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.toDateString();
  const active = Object.values(state.subscriptions).filter(
    (sub) => sub.status === 'active' && !!sub.endDate && new Date(sub.endDate).getTime() > Date.now(),
  ).length;
  return {
    activeSubscribers: active,
    monthlyRevenue: state.payments
      .filter((payment) => new Date(payment.createdAt).getMonth() === month && payment.status === 'settlement')
      .reduce((sum, payment) => sum + payment.amount, 0),
    dailyActiveLearners: new Set(
      state.progress.filter((item) => new Date(item.updatedAt).toDateString() === day).map((item) => item.id.split(':')[0]),
    ).size,
    completedModules: state.progress.filter((item) => item.isCompleted).length,
    totalUsers: state.users.length,
  };
}

export function demoUsers(search: string): ManagedUser[] {
  const query = search.trim().toLowerCase();
  return state.users
    .filter((user) => !query || user.email.includes(query) || user.fullName.toLowerCase().includes(query))
    .map((user) => ({
      ...user,
      createdAt: new Date().toISOString(),
      subscription: demoSubscription(user.id),
    }));
}

export function demoSetSubscription(userId: string, active: boolean) {
  const current = demoSubscription(userId);
  const start = new Date();
  state.subscriptions[userId] = active
    ? {
        status: 'active',
        startDate: start.toISOString(),
        endDate: new Date(start.getTime() + 30 * 86400000).toISOString(),
        paymentMethod: 'manual',
      }
    : { ...current, status: 'inactive' };
  if (active && current.status !== 'active') {
    state.payments.push({
      userId,
      amount: 10000,
      status: 'settlement',
      method: 'manual',
      createdAt: start.toISOString(),
    });
  }
  emit();
}

export function demoUpsertLesson(input: Omit<Lesson, 'id'> & { id?: string }) {
  if (input.id) {
    state.lessons = state.lessons.map((lesson) => (lesson.id === input.id ? { ...lesson, ...input, id: input.id } : lesson));
  } else {
    state.lessons.push({ ...input, id: Crypto.randomUUID() });
  }
  emit();
}

export function demoDeleteLesson(id: string) {
  state.lessons = state.lessons.filter((lesson) => lesson.id !== id);
  state.words = state.words.filter((word) => word.lessonId !== id);
  state.quizzes = state.quizzes.filter((quiz) => quiz.lessonId !== id);
  emit();
}

export function demoUpsertWord(input: Omit<QuranWord, 'id' | 'audioUrl'> & { id?: string; audioUrl?: string | null }) {
  if (input.id) {
    state.words = state.words.map((word) => (word.id === input.id ? { ...word, ...input, id: input.id } : word));
  } else {
    state.words.push({ ...input, id: Crypto.randomUUID(), audioUrl: input.audioUrl ?? null });
  }
  emit();
}

export function demoDeleteWord(id: string) {
  state.words = state.words.filter((word) => word.id !== id);
  emit();
}

export function demoAllWords() {
  return [...state.words];
}

export function demoAllQuizzes() {
  return [...state.quizzes];
}

export function demoUpsertQuiz(input: Omit<QuizItem, 'id'> & { id?: string }) {
  if (input.id) {
    state.quizzes = state.quizzes.map((quiz) => (quiz.id === input.id ? { ...quiz, ...input, id: input.id } : quiz));
  } else {
    state.quizzes.push({ ...input, id: Crypto.randomUUID() });
  }
  emit();
}

export function demoDeleteQuiz(id: string) {
  state.quizzes = state.quizzes.filter((quiz) => quiz.id !== id);
  emit();
}

export function demoActivateSelf(method: string) {
  const user = demoCurrentUser();
  if (!user) return;
  const start = new Date();
  state.subscriptions[user.id] = {
    status: 'active',
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 30 * 86400000).toISOString(),
    paymentMethod: method,
  };
  state.payments.push({
    userId: user.id,
    amount: 10000,
    status: 'settlement',
    method,
    createdAt: start.toISOString(),
  });
  emit();
}

export function demoGamification(): { streak: Streak; badges: EarnedBadge[] } {
  ensureGame();
  const user = demoCurrentUser();
  const streak = user
    ? state.streaks[user.id] ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null }
    : { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  const unlocked = new Map((user ? state.unlocked[user.id] ?? [] : []).map((item) => [item.badgeId, item.unlockedAt]));
  return {
    streak,
    badges: BADGE_CATALOG.map((badge) => ({
      ...badge,
      unlockedAt: unlocked.get(badge.id) ?? null,
    })),
  };
}

export function demoTakeCelebration(): Celebration {
  ensureGame();
  const user = demoCurrentUser();
  const empty: Celebration = { currentStreak: 0, longestStreak: 0, streakIncreased: false, newBadges: [] };
  if (!user) return empty;
  const streak = state.streaks[user.id] ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  const pending = state.pending[user.id] ?? { streak: false, badges: [] };
  const newBadges = pending.badges
    .map((id) => BADGE_CATALOG.find((badge) => badge.id === id))
    .filter((badge): badge is (typeof BADGE_CATALOG)[number] => !!badge)
    .map(({ id, title, description, icon }) => ({ id, title, description, icon }));
  state.pending[user.id] = { streak: false, badges: [] };
  emit();
  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    streakIncreased: pending.streak,
    newBadges,
  };
}

export function demoNotifyPrefs(): NotifyPrefs {
  ensureGame();
  const user = demoCurrentUser();
  if (!user) return { enabled: true, hour: 20, minute: 0 };
  return state.notify[user.id] ?? { enabled: true, hour: 20, minute: 0 };
}

export function demoSaveNotify(prefs: NotifyPrefs) {
  ensureGame();
  const user = demoCurrentUser();
  if (!user) return;
  state.notify[user.id] = prefs;
  emit();
}

export function demoDeleteAccount() {
  ensureGame();
  const user = demoCurrentUser();
  if (!user) return;
  state.users = state.users.filter((item) => item.id !== user.id);
  delete state.subscriptions[user.id];
  delete state.streaks[user.id];
  delete state.unlocked[user.id];
  delete state.pending[user.id];
  delete state.notify[user.id];
  state.progress = state.progress.filter((item) => !item.id.startsWith(`${user.id}:`));
  state.currentUserId = null;
  emit();
}
