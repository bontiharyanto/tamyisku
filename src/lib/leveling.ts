import type { Lesson, ProgressRow } from '@/lib/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const LEVEL_PASS_SCORE = 80;

export type LessonNodeState = 'completed' | 'active' | 'locked';

export type LevelBadge = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type LevelResult = {
  passed: boolean;
  score: number;
  bestScore: number;
  xpEarned: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  unlockedBadge: LevelBadge | null;
};

export function lessonNodeState(
  lesson: Lesson,
  lessons: Lesson[],
  progress: ProgressRow[],
  admin: boolean,
): LessonNodeState {
  const row = progress.find((item) => item.lessonId === lesson.id);
  if ((row?.score ?? 0) >= LEVEL_PASS_SCORE) return 'completed';
  if (admin) return 'active';
  const ordered = [...lessons].sort((left, right) => left.orderIndex - right.orderIndex);
  const index = ordered.findIndex((item) => item.id === lesson.id);
  if (index <= 0) return 'active';
  const previous = ordered[index - 1];
  const previousScore = progress.find((item) => item.lessonId === previous.id)?.score ?? 0;
  return previousScore >= LEVEL_PASS_SCORE ? 'active' : 'locked';
}

export async function completeLessonLevel(input: { lessonId: string; score: number }): Promise<LevelResult> {
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  if (!isSupabaseConfigured) {
    const passed = score >= LEVEL_PASS_SCORE;
    return {
      passed,
      score,
      bestScore: score,
      xpEarned: score >= 100 ? 50 : passed ? 30 : 0,
      nextLessonId: null,
      nextLessonTitle: null,
      unlockedBadge: null,
    };
  }
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc('complete_lesson_level', {
    p_user: auth.user?.id ?? null,
    p_current_lesson_id: input.lessonId,
    p_score: score,
  });
  if (error) throw new Error(error.message);
  const payload = data as {
    passed?: boolean;
    score?: number;
    best_score?: number;
    xp_earned?: number;
    next_lesson_id?: string | null;
    next_lesson_title?: string | null;
    unlocked_badge?: LevelBadge | null;
  };
  return {
    passed: Boolean(payload.passed),
    score: Number(payload.score ?? score),
    bestScore: Number(payload.best_score ?? score),
    xpEarned: Number(payload.xp_earned ?? 0),
    nextLessonId: payload.next_lesson_id ?? null,
    nextLessonTitle: payload.next_lesson_title ?? null,
    unlockedBadge: payload.unlocked_badge ?? null,
  };
}
