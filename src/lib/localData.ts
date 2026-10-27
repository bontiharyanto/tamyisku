import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { forgetContentCache } from '@/lib/contentCache';

export async function clearLocalAccountData() {
  forgetContentCache();
  const keys = await AsyncStorage.getAllKeys();
  const own = keys.filter((key) => key.startsWith('tamyiz.') || key.startsWith('sb-') || key.includes('supabase'));
  if (own.length) await AsyncStorage.multiRemove(own);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const doomed: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && (key.startsWith('tamyiz.') || key.startsWith('sb-') || key.includes('supabase'))) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  }
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  }
}
