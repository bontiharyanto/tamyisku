import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { jakartaClock, jakartaDate } from '@/lib/dates';
import type { NotifyPrefs, Streak } from '@/lib/types';

const REMINDER_ID = 'daily-study';
const WARNING_KEY = 'tamyiz.streak-warning';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function reminderCopy(streak: number) {
  if (streak > 0) {
    return {
      title: `🔥 Rekor ${streak} Hari Kamu Terancam Putus!`,
      body: 'Luangkan 3 menit malam ini untuk belajar Tamyiz dan pertahankan streak-mu!',
    };
  }
  return {
    title: '📖 Yuk, Mulai Langkah Pertamamu Hari Ini!',
    body: 'Pelajari 3 kata baru Al-Qur\'an hari ini dengan metode Tamyiz.',
  };
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

export async function readExpoPushToken() {
  if (Platform.OS === 'web') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function syncStudyReminder({
  prefs,
  streak,
  studiedToday,
  href,
}: {
  prefs: NotifyPrefs;
  streak: Streak;
  studiedToday: boolean;
  href: string;
}) {
  if (!prefs.enabled) {
    await cancelStudyReminder();
    return;
  }
  const copy = reminderCopy(studiedToday ? streak.currentStreak : streak.currentStreak);
  const content = {
    title: copy.title,
    body: copy.body,
    data: { href },
    sound: true,
  };

  if (Platform.OS === 'web') {
    scheduleWebReminder(prefs, content, studiedToday);
    return;
  }

  const allowed = await ensureNotificationPermission();
  if (!allowed) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('study-reminder', {
      name: 'Pengingat belajar',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);

  if (studiedToday) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(prefs.hour, prefs.minute, 0, 0);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow },
    });
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { ...content, ...(Platform.OS === 'android' ? {} : {}) },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefs.hour,
      minute: prefs.minute,
      channelId: 'study-reminder',
    },
  });

  const clock = jakartaClock();
  if (clock.hour >= 19 && streak.currentStreak > 0) {
    const stamp = jakartaDate();
    const sent = await AsyncStorage.getItem(WARNING_KEY);
    if (sent !== stamp) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });
      await AsyncStorage.setItem(WARNING_KEY, stamp);
    }
  }
}

export async function cancelStudyReminder() {
  if (Platform.OS === 'web') {
    if (webTimer) {
      clearTimeout(webTimer);
      webTimer = null;
    }
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
}

let webTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWebReminder(
  prefs: NotifyPrefs,
  content: { title: string; body: string; data: { href: string } },
  studiedToday: boolean,
) {
  if (webTimer) clearTimeout(webTimer);
  if (studiedToday || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = new Date();
  const target = new Date(now);
  target.setHours(prefs.hour, prefs.minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const delay = Math.min(target.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  webTimer = setTimeout(() => {
    const note = new Notification(content.title, { body: content.body, data: content.data });
    note.onclick = () => {
      window.focus();
      window.location.assign(content.data.href);
    };
  }, delay);
}

export function listenForNotificationOpens(onHref: (href: string) => void) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const href = response.notification.request.content.data?.href;
    if (typeof href === 'string') onHref(href);
  });
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const href = response?.notification.request.content.data?.href;
    if (typeof href === 'string') onHref(href);
  });
  return () => subscription.remove();
}
