import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppearanceProvider, useColors } from '@/lib/appearance';
import { colors } from '@/lib/theme';
import { NotificationBridge } from '@/components/NotificationBridge';
import { BootScreen, ToastHost } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const top = segments[0];
    const inAuth = top === '(auth)';
    const completing = top === 'auth-callback';
    if (!user && !inAuth && !completing) router.replace('/(auth)/login');
    if (user && (inAuth || completing)) router.replace('/(main)');
  }, [ready, user, segments, router]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <BootScreen />;
  return children;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (process.env.EXPO_PUBLIC_APP_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Scheherazade+New:wght@400;700&display=swap';
    document.head.appendChild(link);
  }, []);

  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <AuthProvider>
          <ThemedStack />
        </AuthProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack() {
  const palette = useColors();
  return (
    <>
      <StatusBar style="light" />
      <Gate>
        <NotificationBridge />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: palette.background },
          }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
            <Stack.Screen name="auth-callback" options={{ title: 'Masuk' }} />
            <Stack.Screen name="lesson/[id]" options={{ title: 'Belajar' }} />
            <Stack.Screen name="quiz/[lessonId]" options={{ title: 'Kuis' }} />
            <Stack.Screen name="juz/index" options={{ title: 'Kuis 30 Juz' }} />
            <Stack.Screen name="juz/[number]" options={{ title: 'Kuis Juz' }} />
            <Stack.Screen name="surah/index" options={{ title: 'Kuis per Surah' }} />
            <Stack.Screen name="surah/[number]" options={{ title: 'Kuis Surah' }} />
            <Stack.Screen name="paywall" options={{ title: 'Langganan' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privasi & Ketentuan' }} />
            <Stack.Screen name="help" options={{ title: 'Pusat Bantuan' }} />
            <Stack.Screen name="dashboard" options={{ title: 'Dasbor' }} />
            <Stack.Screen name="tutor" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
      </Gate>
      <ToastHost />
    </>
  );
}
