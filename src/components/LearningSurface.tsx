import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  enableAppSwitcherProtectionAsync,
  disableAppSwitcherProtectionAsync,
  usePreventScreenCapture,
} from 'expo-screen-capture';
import { colors, noSelect } from '@/lib/theme';

function useWebDeterrent(setCovered: (covered: boolean) => void) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = '@media print { #tamyiz-lesson-guard { visibility: hidden !important; } }';
    document.head.appendChild(style);
    const sync = () => setCovered(document.visibilityState !== 'visible' || !document.hasFocus());
    const cover = () => setCovered(true);
    const blockMenu = (event: Event) => event.preventDefault();
    const blockKeys = (event: KeyboardEvent) => {
      if (__DEV__) return;
      const key = event.key.toUpperCase();
      const devtools =
        key === 'F12' ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && ['I', 'J', 'C'].includes(key));
      if (devtools || key === 'PRINTSCREEN') event.preventDefault();
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('blur', cover);
    window.addEventListener('focus', sync);
    document.addEventListener('contextmenu', blockMenu);
    document.addEventListener('keydown', blockKeys);
    return () => {
      style.remove();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('blur', cover);
      window.removeEventListener('focus', sync);
      document.removeEventListener('contextmenu', blockMenu);
      document.removeEventListener('keydown', blockKeys);
    };
  }, [setCovered]);
}

function NativeScreenGuard() {
  usePreventScreenCapture('tamyiz-lesson');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void enableAppSwitcherProtectionAsync(0.8);
    return () => {
      void disableAppSwitcherProtectionAsync();
    };
  }, []);
  return null;
}

export function LearningSurface({ email, children }: { email: string; children: ReactNode }) {
  const [covered, setCovered] = useState(false);
  useWebDeterrent(setCovered);

  return (
    <View nativeID="tamyiz-lesson-guard" style={[styles.wrap, noSelect]}>
      {Platform.OS === 'web' ? null : <NativeScreenGuard />}
      {children}
      <View pointerEvents="none" style={styles.watermarkWrap}>
        <Text style={styles.watermark}>{email}</Text>
      </View>
      {covered ? (
        <View style={styles.cover}>
          <Text style={styles.coverText}>Konten modul disembunyikan saat layar tidak aktif.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: {
    color: colors.primary,
    opacity: 0.13,
    fontSize: 18,
    fontWeight: '700',
    transform: [{ rotate: '-18deg' }],
  },
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  coverText: { color: colors.text, fontWeight: '700', textAlign: 'center' },
});
