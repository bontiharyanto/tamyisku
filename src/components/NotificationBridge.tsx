import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { fetchGamification, fetchNotifyPrefs, nextLessonHref, savePushToken, studiedToday } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listenForNotificationOpens, readExpoPushToken, syncStudyReminder } from '@/lib/notifications';

export function NotificationBridge() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    return listenForNotificationOpens((href) => {
      router.push(href as never);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function sync() {
      try {
        const [prefs, game, href] = await Promise.all([fetchNotifyPrefs(), fetchGamification(), nextLessonHref()]);
        if (cancelled) return;
        await syncStudyReminder({
          prefs,
          streak: game.streak,
          studiedToday: studiedToday(game.streak),
          href,
        });
        const token = await readExpoPushToken();
        if (token) await savePushToken(token);
      } catch {
        // Reminder setup should not block the lesson flow.
      }
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
