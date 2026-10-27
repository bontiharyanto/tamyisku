import type { QuranWord } from '@/lib/types';

export const WORD_FILTERS = ['Semua', 'Isim', "Fi'il", 'Huruf', 'Tamyiz'] as const;
export type WordFilter = (typeof WORD_FILTERS)[number];
export const WORD_PAGE_SIZE = 8;

export function filterWords(words: QuranWord[], query: string, filter: WordFilter) {
  const needle = query.trim().toLowerCase();
  return words.filter((item) => {
    const categoryOk =
      filter === 'Semua' ||
      (filter === 'Tamyiz' ? item.tamyizCategory.startsWith('Tamyiz') : item.tamyizCategory === filter);
    const textOk =
      !needle ||
      item.arabicText.includes(query.trim()) ||
      item.translation.toLowerCase().includes(needle) ||
      item.tamyizCategory.toLowerCase().includes(needle);
    return categoryOk && textOk;
  });
}

export function pageCount(total: number, size = WORD_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / size));
}

export function pageSlice<T>(items: T[], page: number, size = WORD_PAGE_SIZE) {
  return items.slice(page * size, page * size + size);
}
