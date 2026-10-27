import {
  demoActivateSelf,
  demoAllQuizzes,
  demoAllWords,
  demoDeleteAccount,
  demoDeleteLesson,
  demoDeleteQuiz,
  demoDeleteWord,
  demoLessons,
  demoGamification,
  demoNotifyPrefs,
  demoOverview,
  demoProgress,
  demoQuizzes,
  demoSaveNotify,
  demoSaveProgress,
  demoSetSubscription,
  demoTakeCelebration,
  demoSubscription,
  demoUpdateName,
  demoUpsertLesson,
  demoUpsertQuiz,
  demoUpsertWord,
  demoUsers,
  demoWords,
} from '@/lib/demoStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { BADGE_CATALOG } from '@/lib/badges';
import { cachedRead } from '@/lib/contentCache';
import { jakartaDate } from '@/lib/dates';
import { withRetry } from '@/lib/retry';
import type { Celebration, EarnedBadge, Lesson, ManagedUser, NotifyPrefs, Overview, ProgressRow, QuranWord, QuizItem, Streak, Subscription } from '@/lib/types';
import { MONTHLY_PRICE_IDR } from '@/lib/theme';

function mapLesson(row: Record<string, unknown>): Lesson {
  return {
    id: String(row.id),
    title: String(row.title),
    level: Number(row.level),
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    orderIndex: Number(row.order_index),
  };
}

function mapWord(row: Record<string, unknown>, audioUrl: string | null): QuranWord {
  return {
    id: String(row.id),
    lessonId: String(row.lesson_id),
    surahNumber: Number(row.surah_number),
    ayahNumber: Number(row.ayah_number),
    wordPosition: Number(row.word_position),
    arabicText: String(row.arabic_text),
    transliteration: (row.transliteration as string | null) ?? null,
    translation: String(row.translation),
    tamyizCategory: String(row.tamyiz_category),
    colorCode: (row.color_code as string | null) ?? null,
    audioUrl,
  };
}

function mapQuiz(row: Record<string, unknown>, audioUrl: string | null): QuizItem {
  return {
    id: String(row.id),
    lessonId: String(row.lesson_id),
    question: String(row.question),
    correctAnswer: String(row.correct_answer),
    scorePoints: Number(row.score_points ?? 10),
    arabicText: String(row.arabic_text ?? ''),
    translation: String(row.translation ?? ''),
    explanation: String(row.explanation ?? ''),
    audioUrl,
    orderIndex: Number(row.order_index ?? 0),
  };
}

export function mapSubscription(row: Record<string, unknown> | null): Subscription {
  if (!row) return { status: 'inactive', startDate: null, endDate: null, paymentMethod: null };
  const status = row.status;
  return {
    status: status === 'active' || status === 'expired' ? status : 'inactive',
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    paymentMethod: (row.payment_method as string | null) ?? null,
  };
}

export async function signStoredAudio(path: string | null) {
  if (!path || path.startsWith('http')) return path;
  const storedInQuran = path.startsWith('quran_audios/');
  const bucket = storedInQuran ? 'quran_audios' : 'lesson-audio';
  const objectPath = storedInQuran ? path.slice('quran_audios/'.length) : path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 300);
  if (error) return null;
  return data.signedUrl;
}

async function signedAudio(path: string | null) {
  return signStoredAudio(path);
}

export async function fetchLessons() {
  if (!isSupabaseConfigured) return demoLessons();
  return cachedRead(
    (store) => store.lessons,
    (store, value) => {
      store.lessons = value;
    },
    async () => {
      const { data, error } = await supabase.from('lessons').select('*').order('order_index');
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapLesson(row as Record<string, unknown>));
    },
  );
}

export async function fetchWords(lessonId: string) {
  if (!isSupabaseConfigured) return demoWords(lessonId);
  return cachedRead(
    (store) => store.words[lessonId],
    (store, value) => {
      store.words[lessonId] = value;
    },
    async () => {
      const { data, error } = await supabase
        .from('quran_words')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('word_position');
      if (error) throw new Error(error.message);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const record = row as Record<string, unknown>;
          return mapWord(record, await signedAudio((record.audio_url as string | null) ?? null));
        }),
      );
    },
  );
}

export async function fetchQuizzes(lessonId: string) {
  if (!isSupabaseConfigured) return demoQuizzes(lessonId);
  return cachedRead(
    (store) => store.quizzes[lessonId],
    (store, value) => {
      store.quizzes[lessonId] = value;
    },
    async () => {
      const { data, error } = await supabase.from('quizzes').select('*').eq('lesson_id', lessonId).order('order_index');
      if (error) throw new Error(error.message);
      return Promise.all(
        (data ?? []).map(async (row) => {
          const record = row as Record<string, unknown>;
          return mapQuiz(record, await signedAudio((record.audio_url as string | null) ?? null));
        }),
      );
    },
  );
}

export async function fetchProgress(): Promise<ProgressRow[]> {
  if (!isSupabaseConfigured) return demoProgress();
  return cachedRead(
    (store) => store.progress,
    (store, value) => {
      store.progress = value;
    },
    async () => {
  const { data, error } = await supabase
    .from('user_progress')
    .select('id, lesson_id, score, is_completed, updated_at, lessons(title)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const lesson = record.lessons as { title?: string } | { title?: string }[] | null;
    const title = Array.isArray(lesson) ? lesson[0]?.title : lesson?.title;
    return {
      id: String(record.id),
      lessonId: String(record.lesson_id),
      lessonTitle: title ?? 'Modul',
      score: Number(record.score),
      isCompleted: Boolean(record.is_completed),
      updatedAt: String(record.updated_at),
    };
  });
    },
  );
}

export async function saveQuizProgress({
  lessonId,
  finalScore,
}: {
  lessonId: string;
  finalScore: number;
  passingScore?: number;
}) {
  if (!isSupabaseConfigured) return demoSaveProgress(lessonId, finalScore);
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('save_quiz_progress', {
      p_lesson_id: lessonId,
      p_score: finalScore,
    });
    if (error) throw new Error(error.message);
    return data;
  });
}

export async function updateFullName(userId: string, fullName: string) {
  if (!isSupabaseConfigured) {
    demoUpdateName(fullName);
    return;
  }
  const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function createCheckoutSession() {
  if (!isSupabaseConfigured) {
    demoActivateSelf('demo');
    return { paymentUrl: null as string | null, simulated: true };
  }
  const { data, error } = await withRetry(() => supabase.functions.invoke('create-payment', { body: {} }));
  if (error) throw new Error(error.message);
  const payload = data as { payment_url?: string; error?: string };
  if (payload.error) throw new Error(payload.error);
  if (!payload.payment_url) throw new Error('URL pembayaran tidak diterima');
  return { paymentUrl: payload.payment_url, simulated: false };
}

export async function fetchOverview(): Promise<Overview> {
  if (!isSupabaseConfigured) return demoOverview();
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw new Error(error.message);
  const row = data as Record<string, number>;
  return {
    activeSubscribers: Number(row.active_subscribers ?? 0),
    monthlyRevenue: Number(row.monthly_revenue ?? 0),
    dailyActiveLearners: Number(row.daily_active_learners ?? 0),
    completedModules: Number(row.completed_modules ?? 0),
    totalUsers: Number(row.total_users ?? 0),
  };
}

const emptyStreak = (): Streak => ({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });

export async function fetchGamification(): Promise<{ streak: Streak; badges: EarnedBadge[] }> {
  if (!isSupabaseConfigured) return demoGamification();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error(authError?.message ?? 'Masuk terlebih dahulu');
  const [streakResult, badgeResult, earnedResult] = await Promise.all([
    supabase.from('user_streaks').select('current_streak, longest_streak, last_activity_date').eq('user_id', auth.user.id).maybeSingle(),
    supabase.from('badges').select('id, title, description, icon, requirement'),
    supabase.from('user_badges').select('badge_id, unlocked_at').eq('user_id', auth.user.id),
  ]);
  if (streakResult.error) throw new Error(streakResult.error.message);
  if (badgeResult.error) throw new Error(badgeResult.error.message);
  if (earnedResult.error) throw new Error(earnedResult.error.message);
  const streakRow = streakResult.data as Record<string, unknown> | null;
  const earned = new Map(
    ((earnedResult.data ?? []) as { badge_id: string; unlocked_at: string }[]).map((row) => [row.badge_id, row.unlocked_at]),
  );
  const catalog = (badgeResult.data ?? []) as { id: string; title: string; description: string; icon: string; requirement: string }[];
  const source = catalog.length ? catalog : BADGE_CATALOG;
  return {
    streak: streakRow
      ? {
          currentStreak: Number(streakRow.current_streak ?? 0),
          longestStreak: Number(streakRow.longest_streak ?? 0),
          lastActivityDate: (streakRow.last_activity_date as string | null) ?? null,
        }
      : emptyStreak(),
    badges: source.map((badge) => ({
      id: badge.id,
      title: badge.title,
      description: badge.description,
      icon: badge.icon,
      requirement: badge.requirement,
      unlockedAt: earned.get(badge.id) ?? null,
    })),
  };
}

export async function takeCelebration(): Promise<Celebration> {
  if (!isSupabaseConfigured) return demoTakeCelebration();
  const { data, error } = await supabase.rpc('take_learning_celebration');
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  const badges = Array.isArray(row.new_badges) ? row.new_badges : [];
  return {
    currentStreak: Number(row.current_streak ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
    streakIncreased: Boolean(row.streak_increased),
    newBadges: badges.map((badge) => {
      const item = badge as Record<string, unknown>;
      return {
        id: String(item.id),
        title: String(item.title),
        description: String(item.description),
        icon: String(item.icon),
      };
    }),
  };
}

export function studiedToday(streak: Streak) {
  return streak.lastActivityDate === jakartaDate();
}

export async function fetchNotifyPrefs(): Promise<NotifyPrefs> {
  if (!isSupabaseConfigured) return demoNotifyPrefs();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error(authError?.message ?? 'Masuk terlebih dahulu');
  const { data, error } = await supabase.from('users').select('notify_enabled, notify_hour, notify_minute').eq('id', auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown> | null;
  return {
    enabled: row?.notify_enabled !== false,
    hour: Number(row?.notify_hour ?? 20),
    minute: Number(row?.notify_minute ?? 0),
  };
}

export async function saveNotifyPrefs(prefs: NotifyPrefs) {
  if (!isSupabaseConfigured) {
    demoSaveNotify(prefs);
    return;
  }
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error(userError?.message ?? 'Masuk terlebih dahulu');
  const { error } = await supabase
    .from('users')
    .update({ notify_enabled: prefs.enabled, notify_hour: prefs.hour, notify_minute: prefs.minute })
    .eq('id', data.user.id);
  if (error) throw new Error(error.message);
}

export async function savePushToken(token: string) {
  if (!isSupabaseConfigured || !token) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('users').update({ expo_push_token: token }).eq('id', data.user.id);
}

export async function deleteOwnAccount(input: { confirmation: string; password: string }) {
  const confirmed = input.confirmation === 'HAPUS' || input.password.length >= 6;
  if (!confirmed) throw new Error('Ketik HAPUS atau masukkan kata sandi');
  if (!isSupabaseConfigured) {
    demoDeleteAccount();
    return;
  }
  const { data, error } = await supabase.functions.invoke('delete-user-account', {
    body: { confirmation: input.confirmation, password: input.password },
  });
  if (error) throw new Error(await readFunctionError(error));
  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
}

async function readFunctionError(error: Error) {
  const response = (error as Error & { context?: { json?: () => Promise<{ error?: string }> } }).context;
  if (response?.json) {
    try {
      const body = await response.json();
      if (body.error) return body.error;
    } catch {
      return error.message;
    }
  }
  return error.message;
}

export async function uploadLessonAudio(file: Blob, filename: string) {
  if (!isSupabaseConfigured) throw new Error('Unggah audio membutuhkan Supabase');
  const safe = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const path = `free/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('lesson-audio').upload(path, file, {
    upsert: false,
    contentType: file.type || 'audio/mpeg',
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function nextLessonHref() {
  const [lessons, progress] = await Promise.all([fetchLessons(), fetchProgress()]);
  const open = lessons.find((lesson) => !progress.some((row) => row.lessonId === lesson.id && row.isCompleted));
  return open ? `/lesson/${open.id}` : '/(main)';
}

export async function fetchManagedUsers(search: string): Promise<ManagedUser[]> {
  if (!isSupabaseConfigured) return demoUsers(search);
  const safe = search.trim().replace(/[%_,]/g, '');
  let query = supabase.from('users').select('id, email, full_name, role, created_at, subscriptions(*)').order('created_at', { ascending: false });
  if (safe) query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const subscription = record.subscriptions as Record<string, unknown> | Record<string, unknown>[] | null;
    const subRow = Array.isArray(subscription) ? subscription[0] : subscription;
    return {
      id: String(record.id),
      email: String(record.email),
      fullName: String(record.full_name ?? ''),
      role: record.role === 'admin' ? 'admin' : record.role === 'tutor' ? 'tutor' : 'user',
      createdAt: String(record.created_at),
      subscription: mapSubscription(subRow ?? null),
    };
  });
}

export async function setUserRole(userId: string, role: 'user' | 'tutor' | 'admin') {
  if (!isSupabaseConfigured) throw new Error('Peran hanya diubah saat Supabase terhubung.');
  const stored = role === 'user' ? 'student' : role;
  const { error } = await supabase.rpc('set_user_role', { p_user: userId, p_role: stored });
  if (error) throw new Error(error.message);
}

export async function setSubscription(userId: string, active: boolean) {
  if (!isSupabaseConfigured) {
    demoSetSubscription(userId, active);
    return;
  }
  const now = new Date();
  const { error } = await supabase
    .from('subscriptions')
    .update(
      active
        ? {
            status: 'active',
            start_date: now.toISOString(),
            end_date: new Date(now.getTime() + 30 * 86400000).toISOString(),
            payment_method: 'manual',
            updated_at: now.toISOString(),
          }
        : { status: 'inactive', updated_at: now.toISOString() },
    )
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (active) {
    await supabase.from('payments').insert({
      user_id: userId,
      gateway: 'manual',
      external_id: `manual-${userId}-${now.getTime()}`,
      amount: MONTHLY_PRICE_IDR,
      status: 'settlement',
      payment_method: 'manual',
    });
  }
}

export async function fetchAdminContent() {
  if (!isSupabaseConfigured) {
    return { lessons: demoLessons(), words: demoAllWords(), quizzes: demoAllQuizzes() };
  }
  const [lessons, words, quizzes] = await Promise.all([
    supabase.from('lessons').select('*').order('order_index'),
    supabase.from('quran_words').select('*').order('word_position'),
    supabase.from('quizzes').select('*').order('order_index'),
  ]);
  if (lessons.error) throw new Error(lessons.error.message);
  if (words.error) throw new Error(words.error.message);
  if (quizzes.error) throw new Error(quizzes.error.message);
  return {
    lessons: (lessons.data ?? []).map((row) => mapLesson(row as Record<string, unknown>)),
    words: (words.data ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      return mapWord(record, (record.audio_url as string | null) ?? null);
    }),
    quizzes: (quizzes.data ?? []).map((row) => mapQuiz(row as Record<string, unknown>, null)),
  };
}

export async function upsertLesson(input: Lesson) {
  const payload = {
    title: input.title,
    level: input.level,
    category: input.category,
    description: input.description,
    order_index: input.orderIndex,
  };
  if (!isSupabaseConfigured) {
    demoUpsertLesson({ ...input });
    return;
  }
  const query = input.id
    ? supabase.from('lessons').update(payload).eq('id', input.id)
    : supabase.from('lessons').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteLesson(id: string) {
  if (!isSupabaseConfigured) {
    demoDeleteLesson(id);
    return;
  }
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function upsertWord(input: QuranWord) {
  const payload = {
    lesson_id: input.lessonId,
    surah_number: input.surahNumber,
    ayah_number: input.ayahNumber,
    word_position: input.wordPosition,
    arabic_text: input.arabicText,
    transliteration: input.transliteration,
    translation: input.translation,
    tamyiz_category: input.tamyizCategory,
    color_code: input.colorCode,
    audio_url: input.audioUrl,
  };
  if (!isSupabaseConfigured) {
    demoUpsertWord(input);
    return input.id;
  }
  const query = input.id
    ? supabase.from('quran_words').update(payload).eq('id', input.id).select('id').single()
    : supabase.from('quran_words').insert(payload).select('id').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

export async function deleteWord(id: string) {
  if (!isSupabaseConfigured) {
    demoDeleteWord(id);
    return;
  }
  const { error } = await supabase.from('quran_words').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function upsertQuiz(input: QuizItem) {
  const payload = {
    lesson_id: input.lessonId,
    question: input.question,
    options: ['Isim', "Fi'il", 'Huruf', 'Tamyiz'],
    correct_answer: input.correctAnswer,
    score_points: input.scorePoints,
    arabic_text: input.arabicText,
    translation: input.translation,
    explanation: input.explanation,
    audio_url: input.audioUrl,
    order_index: input.orderIndex,
  };
  if (!isSupabaseConfigured) {
    demoUpsertQuiz(input);
    return;
  }
  const query = input.id
    ? supabase.from('quizzes').update(payload).eq('id', input.id)
    : supabase.from('quizzes').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteQuiz(id: string) {
  if (!isSupabaseConfigured) {
    demoDeleteQuiz(id);
    return;
  }
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function loadOwnSubscription(userId: string) {
  if (!isSupabaseConfigured) return demoSubscription(userId);
  const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return mapSubscription((data as Record<string, unknown> | null) ?? null);
}
