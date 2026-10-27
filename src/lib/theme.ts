import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#0F5132',
  primaryDark: '#0A3A24',
  background: '#FDFBF7',
  card: '#FFFFFF',
  accent: '#FF8F00',
  gold: '#D4AF37',
  text: '#1C1915',
  muted: '#5C564C',
  line: '#E6E0D6',
  danger: '#B71C1C',
  success: '#1B5E20',
  white: '#FFFFFF',
};

export type Palette = typeof colors;

export const lightPalette: Palette = { ...colors };

export const darkPalette: Palette = {
  primary: '#B7E0CE',
  primaryDark: '#071410',
  background: '#0B1E19',
  card: '#132A23',
  accent: '#FFB300',
  gold: '#D4AF37',
  text: '#F4EFE6',
  muted: '#D7CBB8',
  line: '#1F4237',
  danger: '#EF9A9A',
  success: '#A5D6A7',
  white: '#FFFFFF',
};

export const MONTHLY_PRICE_IDR = 10000;
export const PASSING_SCORE = 70;

export function formatIdr(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

type CategoryVisual = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  label: string;
};

const TAMYIZ_VISUAL: CategoryVisual = {
  backgroundColor: '#FFF8E1',
  borderColor: '#FF8F00',
  textColor: '#6D4C00',
  label: 'Tamyiz',
};

const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  Isim: { backgroundColor: '#E3F2FD', borderColor: '#0D47A1', textColor: '#0D47A1', label: 'Isim' },
  "Fi'il": { backgroundColor: '#FFEBEE', borderColor: '#B71C1C', textColor: '#B71C1C', label: "Fi'il" },
  Huruf: { backgroundColor: '#E8F5E9', borderColor: '#1B5E20', textColor: '#1B5E20', label: 'Huruf' },
  'Tamyiz 1': { ...TAMYIZ_VISUAL, label: 'Tamyiz 1' },
  'Tamyiz 2': { ...TAMYIZ_VISUAL, label: 'Tamyiz 2' },
  'Tamyiz 3': { ...TAMYIZ_VISUAL, label: 'Tamyiz 3' },
  'Tamyiz 4': { ...TAMYIZ_VISUAL, label: 'Tamyiz 4' },
};

const DARK_CATEGORY: Record<string, CategoryVisual> = {
  Isim: { backgroundColor: '#0D2137', borderColor: '#42A5F5', textColor: '#90CAF9', label: 'Isim' },
  "Fi'il": { backgroundColor: '#370D0D', borderColor: '#EF5350', textColor: '#EF9A9A', label: "Fi'il" },
  Huruf: { backgroundColor: '#0D3715', borderColor: '#66BB6A', textColor: '#A5D6A7', label: 'Huruf' },
  'Tamyiz 1': { backgroundColor: '#2A2108', borderColor: '#D4AF37', textColor: '#FFE082', label: 'Tamyiz 1' },
  'Tamyiz 2': { backgroundColor: '#2A2108', borderColor: '#D4AF37', textColor: '#FFE082', label: 'Tamyiz 2' },
  'Tamyiz 3': { backgroundColor: '#2A2108', borderColor: '#D4AF37', textColor: '#FFE082', label: 'Tamyiz 3' },
  'Tamyiz 4': { backgroundColor: '#2A2108', borderColor: '#D4AF37', textColor: '#FFE082', label: 'Tamyiz 4' },
};

export function categoryVisual(category: string, colorCode?: string | null, dark = false): CategoryVisual {
  const table = dark ? DARK_CATEGORY : CATEGORY_VISUAL;
  const preset =
    table[category] ??
    (category.startsWith('Tamyiz')
      ? { ...(dark ? DARK_CATEGORY['Tamyiz 1'] : TAMYIZ_VISUAL), label: category }
      : null) ?? {
      backgroundColor: dark ? '#132A23' : '#F5F5F5',
      borderColor: dark ? '#1F4237' : '#5C564C',
      textColor: dark ? '#F4EFE6' : '#1C1915',
      label: category,
    };
  return {
    ...preset,
    borderColor: !dark && colorCode ? colorCode : preset.borderColor,
  };
}

export function isTamyizCategory(value: string) {
  return value === 'Isim' || value === "Fi'il" || value === 'Huruf' || value.startsWith('Tamyiz');
}

export function answersMatch(choice: string, correct: string) {
  if (choice === 'Tamyiz') return correct.startsWith('Tamyiz');
  return choice === correct;
}

export const QUIZ_CHOICES = [
  { id: 'Isim', label: 'Isim', hint: 'Kata benda' },
  { id: "Fi'il", label: "Fi'il", hint: 'Kata kerja' },
  { id: 'Huruf', label: 'Huruf', hint: 'Kata tugas' },
  { id: 'Tamyiz', label: 'Tamyiz', hint: 'Kosa kata berulang' },
] as const;

export const latinFont: TextStyle = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: '"Plus Jakarta Sans", Inter, sans-serif',
  }),
  color: colors.text,
};

export const arabicFont: TextStyle = {
  fontFamily: Platform.select({
    ios: 'Geeza Pro',
    android: 'serif',
    default: '"Scheherazade New", "Amiri Quran", Amiri, serif',
  }),
  fontSize: 34,
  lineHeight: 56,
  color: colors.text,
  writingDirection: 'rtl',
};

export const noSelect: TextStyle & ViewStyle =
  Platform.OS === 'web' ? ({ userSelect: 'none' } as TextStyle & ViewStyle) : {};
