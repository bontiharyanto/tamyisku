import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lesson, ProgressRow, QuranWord, QuizItem } from '@/lib/types';

const KEY = 'tamyiz.content.v1';

type Store = {
  lessons: Lesson[] | null;
  words: Record<string, QuranWord[]>;
  quizzes: Record<string, QuizItem[]>;
  progress: ProgressRow[] | null;
};

const empty = (): Store => ({ lessons: null, words: {}, quizzes: {}, progress: null });

let memory: Store | null = null;
let usedOfflineCopy = false;

async function readStore() {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memory = raw ? ({ ...empty(), ...(JSON.parse(raw) as Partial<Store>) }) : empty();
  } catch {
    memory = empty();
  }
  return memory;
}

async function writeStore(store: Store) {
  memory = store;
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export function forgetContentCache() {
  memory = empty();
  usedOfflineCopy = false;
}

export function consumeOfflineFallback() {
  const used = usedOfflineCopy;
  usedOfflineCopy = false;
  return used;
}

export async function cachedRead<T>(
  read: (store: Store) => T | null | undefined,
  write: (store: Store, value: T) => void,
  load: () => Promise<T>,
) {
  try {
    const value = await load();
    const store = await readStore();
    write(store, value);
    await writeStore(store);
    return value;
  } catch (error) {
    const cached = read(await readStore());
    if (cached) {
      usedOfflineCopy = true;
      return cached;
    }
    throw error;
  }
}
