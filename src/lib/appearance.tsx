import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, type Palette } from '@/lib/theme';

const MODE_KEY = 'tamyiz.appearance.mode';
const WEB_KEY = 'tamyiz.theme';
const SCALE_KEY = 'tamyiz.appearance.arabicScale';
const ONBOARD_KEY = 'tamyiz.onboarding.done';

export type AppearanceMode = 'light' | 'dark';

type AppearanceValue = {
  mode: AppearanceMode;
  palette: Palette;
  dark: boolean;
  arabicScale: number;
  onboarded: boolean;
  ready: boolean;
  setMode: (mode: AppearanceMode) => void;
  setArabicScale: (scale: number) => void;
  completeOnboarding: () => void;
};

const fallback: AppearanceValue = {
  mode: 'light',
  palette: lightPalette,
  dark: false,
  arabicScale: 1,
  onboarded: true,
  ready: true,
  setMode: () => undefined,
  setArabicScale: () => undefined,
  completeOnboarding: () => undefined,
};

const AppearanceContext = createContext<AppearanceValue>(fallback);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>('light');
  const [arabicScale, setScaleState] = useState(1);
  const [onboarded, setOnboarded] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const webMode = readWebMode();
      const [storedMode, storedScale, storedOnboarding] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(SCALE_KEY),
        AsyncStorage.getItem(ONBOARD_KEY),
      ]);
      if (cancelled) return;
      const next = webMode ?? (storedMode === 'dark' || storedMode === 'light' ? storedMode : 'light');
      setModeState(next);
      applyWebMode(next);
      const scale = Number(storedScale);
      if (scale >= 0.85 && scale <= 1.45) setScaleState(scale);
      setOnboarded(storedOnboarding === '1');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AppearanceValue>(
    () => ({
      mode,
      palette: mode === 'dark' ? darkPalette : lightPalette,
      dark: mode === 'dark',
      arabicScale,
      onboarded,
      ready,
      setMode: (next) => {
        setModeState(next);
        applyWebMode(next);
        void AsyncStorage.setItem(MODE_KEY, next);
      },
      setArabicScale: (scale) => {
        const next = Math.min(1.45, Math.max(0.85, Math.round(scale * 100) / 100));
        setScaleState(next);
        void AsyncStorage.setItem(SCALE_KEY, String(next));
      },
      completeOnboarding: () => {
        setOnboarded(true);
        void AsyncStorage.setItem(ONBOARD_KEY, '1');
      },
    }),
    [mode, arabicScale, onboarded, ready],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function useColors() {
  return useAppearance().palette;
}

function readWebMode(): AppearanceMode | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(WEB_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

function applyWebMode(mode: AppearanceMode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  localStorage.setItem(WEB_KEY, mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.backgroundColor = mode === 'dark' ? '#0B1E19' : '#FDFBF7';
}
