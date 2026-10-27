import { fetchGamification, nextLessonHref, saveNotifyPrefs, studiedToday } from '@/lib/api';
import { ensureNotificationPermission, syncStudyReminder } from '@/lib/notifications';
import type { NotifyPrefs } from '@/lib/types';

export async function saveStudyReminder(prefs: NotifyPrefs) {
  if (prefs.enabled) {
    const allowed = await ensureNotificationPermission();
    if (!allowed) return 'denied' as const;
  }
  await saveNotifyPrefs(prefs);
  const [game, href] = await Promise.all([fetchGamification(), nextLessonHref()]);
  await syncStudyReminder({
    prefs,
    streak: game.streak,
    studiedToday: studiedToday(game.streak),
    href,
  });
  return 'saved' as const;
}
