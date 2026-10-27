// Impor 114 surah (kata per kata) dari Quran.com v4 ke quran_words.
//
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=kunci-anon
//   export SUPABASE_ADMIN_EMAIL=admin@contoh.test
//   export SUPABASE_ADMIN_PASSWORD=kata-sandi-admin
//   node scripts/seed-quran-full.ts
//   node scripts/seed-quran-full.ts --from 2 --to 2 --dry-run
//   node scripts/seed-quran-full.ts --reset
//
// Progres surah yang sudah selesai ada di scripts/progress.json.
// Audio memakai CDN Quran.com yang benar-benar melayani berkas: audio.qurancdn.com.

import { readFile, writeFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const AUDIO_CDN = 'https://audio.qurancdn.com/';
const API = 'https://api.quran.com/api/v4';
const BATCH = 500;
const PROGRESS = 'scripts/progress.json';

const COLORS = {
  Isim: '#1976D2',
  "Fi'il": '#D32F2F',
  Huruf: '#388E3C',
} as const;

type Category = keyof typeof COLORS;

type WordRow = {
  surah_number: number;
  ayah_number: number;
  word_position: number;
  arabic_text: string;
  transliteration: string | null;
  translation: string;
  audio_url: string | null;
  tamyiz_category: Category;
  color_code: string;
  lesson_id?: string;
};

type Progress = {
  lastCompletedSurah: number;
  importedWords: number;
  updatedAt: string;
};

type VerseWord = {
  char_type_name?: string;
  text_uthmani?: string;
  text?: string;
  position?: number;
  location?: string;
  audio_url?: string | null;
  translation?: { text?: string };
  transliteration?: { text?: string };
};

const HURUF = new Set(
  [
    'في', 'من', 'الى', 'على', 'عن', 'ان', 'إن', 'أن', 'لا', 'ما', 'لم', 'لن', 'الا', 'إلا',
    'حتى', 'ثم', 'او', 'أو', 'بل', 'قد', 'سوف', 'كي', 'لكي', 'لولا', 'لو', 'اذا', 'إذا', 'اذ', 'إذ',
    'ب', 'و', 'ف', 'ل', 'ك', 'انما', 'إنما', 'لكن', 'ولكن', 'يا', 'ايها', 'أيها',
  ].map(normalizeArabic),
);

const FIIL = new Set(
  [
    'قال', 'قالوا', 'قل', 'قلت', 'كان', 'كانوا', 'كن', 'جعل', 'خلق', 'علم', 'عمل', 'جاء', 'ذهبوا',
    'نظر', 'سمع', 'كفر', 'كفروا', 'امن', 'آمن', 'آمنوا', 'عبد', 'رزق', 'هدى', 'قتل', 'مات', 'شاء',
    'انزل', 'أنزل', 'ارسل', 'أرسل', 'يعملون', 'يكفرون', 'يؤمنون', 'يقول', 'تقول', 'نقول', 'يكون',
    'تكون', 'يعلم', 'تعلم', 'نعلم', 'يفعل', 'تريد', 'يريد', 'نزل', 'يتلو', 'اتل',
  ].map(normalizeArabic),
);

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function tamyizCategory(arabic: string): Category {
  const stripped = normalizeArabic(arabic);
  if (!stripped) return 'Isim';
  if (HURUF.has(stripped)) return 'Huruf';
  if (FIIL.has(stripped)) return "Fi'il";
  if (!stripped.startsWith('ال') && /^(ي|ت|ن|ا).{2,}(ون|ين|وا|تم|نا|ت)$/.test(stripped)) return "Fi'il";
  return 'Isim';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readArgs() {
  const values = new Map<string, string>();
  const list = process.argv.slice(2);
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item?.startsWith('--')) continue;
    const key = item.slice(2);
    const next = list[index + 1];
    if (!next || next.startsWith('--')) values.set(key, 'true');
    else {
      values.set(key, next);
      index += 1;
    }
  }
  return {
    from: values.has('from') ? Number(values.get('from')) : null,
    to: values.has('to') ? Number(values.get('to')) : null,
    dryRun: values.has('dry-run'),
    reset: values.has('reset'),
  };
}

async function getJson(url: string) {
  let lastError = 'permintaan gagal';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'TamyizkuFullSeeder/1.0' },
    });
    if (response.status === 429 || response.status >= 500) {
      lastError = `HTTP ${response.status}`;
      await sleep(500 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`Quran.com ${response.status} untuk ${url}`);
    return response.json() as Promise<Record<string, unknown>>;
  }
  throw new Error(`${lastError} untuk ${url}`);
}

async function loadProgress(): Promise<Progress> {
  try {
    const raw = JSON.parse(await readFile(PROGRESS, 'utf8')) as Partial<Progress>;
    return {
      lastCompletedSurah: Number(raw.lastCompletedSurah) || 0,
      importedWords: Number(raw.importedWords) || 0,
      updatedAt: String(raw.updatedAt ?? ''),
    };
  } catch {
    return { lastCompletedSurah: 0, importedWords: 0, updatedAt: '' };
  }
}

async function saveProgress(progress: Progress) {
  await writeFile(PROGRESS, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
}

function verseUrl(surah: number, page: number) {
  const fields = 'text_uthmani,location,audio_url';
  return `${API}/verses/by_chapter/${surah}?language=id&words=true&word_fields=${fields}&translations=33&per_page=50&page=${page}`;
}

async function fetchSurahWords(surah: number) {
  const words: WordRow[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const payload = await getJson(verseUrl(surah, page));
    const pagination = payload.pagination as { total_pages?: number } | undefined;
    totalPages = Number(pagination?.total_pages || 1);
    const verses = (payload.verses as { verse_key?: string; words?: VerseWord[] }[] | undefined) ?? [];
    for (const verse of verses) {
      const [fromKeySurah, fromKeyAyah] = String(verse.verse_key ?? '').split(':').map(Number);
      for (const word of verse.words ?? []) {
        if (word.char_type_name === 'end') continue;
        const arabic = String(word.text_uthmani || word.text || '').trim();
        if (!arabic) continue;
        const [locSurah, locAyah, locPosition] = String(word.location ?? '').split(':').map(Number);
        const category = tamyizCategory(arabic);
        words.push({
          surah_number: fromKeySurah || locSurah,
          ayah_number: fromKeyAyah || locAyah,
          word_position: Number(word.position || locPosition),
          arabic_text: arabic,
          transliteration: word.transliteration?.text || null,
          translation: String(word.translation?.text || '').trim() || '—',
          audio_url: word.audio_url ? `${AUDIO_CDN}${word.audio_url}` : null,
          tamyiz_category: category,
          color_code: COLORS[category],
        });
      }
    }
    page += 1;
    await sleep(120);
  }
  return words;
}

async function lessonForSurah(supabase: SupabaseClient, surah: number) {
  const orderIndex = 1000 + surah;
  const { data: existing, error } = await supabase.from('lessons').select('id').eq('order_index', orderIndex).maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.id) return String(existing.id);
  const chapter = await getJson(`${API}/chapters/${surah}?language=id`);
  const meta = chapter.chapter as { name_simple?: string } | undefined;
  const { data, error: insertError } = await supabase
    .from('lessons')
    .insert({
      title: meta?.name_simple || `Surah ${surah}`,
      level: 1,
      category: 'Kosa kata',
      description: 'Kata per kata surah ini, dengan audio bacaan.',
      order_index: orderIndex,
    })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);
  return String(data.id);
}

async function existingLessons(supabase: SupabaseClient, surah: number) {
  const map = new Map<string, string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('quran_words')
      .select('ayah_number, word_position, lesson_id')
      .eq('surah_number', surah)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) map.set(`${row.ayah_number}:${row.word_position}`, String(row.lesson_id));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function adminClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error('Isi SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAIL, dan SUPABASE_ADMIN_PASSWORD. Tambahkan --dry-run untuk mencoba tanpa database.');
  }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return supabase;
}

async function upsertBatches(supabase: SupabaseClient, rows: WordRow[], surah: number) {
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const { error } = await supabase.from('quran_words').upsert(batch, {
      onConflict: 'surah_number,ayah_number,word_position',
    });
    if (error) throw new Error(error.message);
    console.log(`Surah ${surah}: batch ${Math.min(index + BATCH, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const args = readArgs();
  const progress = args.reset ? { lastCompletedSurah: 0, importedWords: 0, updatedAt: '' } : await loadProgress();
  if (args.reset && !args.dryRun) await saveProgress({ ...progress, updatedAt: new Date().toISOString() });

  const from = args.from ?? progress.lastCompletedSurah + 1;
  const to = args.to ?? 114;
  if (from < 1 || to > 114 || from > to) throw new Error('Gunakan surah 1 sampai 114.');
  if (from > 114) {
    console.log('Semua surah sudah tercatat di scripts/progress.json.');
    return;
  }

  const supabase = args.dryRun ? null : await adminClient();
  console.log(`Mulai surah ${from} sampai ${to}. Progres terakhir: surah ${progress.lastCompletedSurah}.`);

  for (let surah = from; surah <= to; surah += 1) {
    const words = await fetchSurahWords(surah);
    const firstAyah = words[0]?.ayah_number ?? 1;
    const lastAyah = words.at(-1)?.ayah_number ?? firstAyah;
    if (args.dryRun || !supabase) {
      console.log(`Dry-run Surah ${surah} Ayat ${firstAyah}-${lastAyah} (${words.length} kata)`);
      continue;
    }
    const fallbackLesson = await lessonForSurah(supabase, surah);
    const kept = await existingLessons(supabase, surah);
    const rows = words.map((word) => ({
      ...word,
      lesson_id: kept.get(`${word.ayah_number}:${word.word_position}`) ?? fallbackLesson,
    }));
    await upsertBatches(supabase, rows, surah);
    progress.lastCompletedSurah = surah;
    progress.importedWords += words.length;
    progress.updatedAt = new Date().toISOString();
    await saveProgress(progress);
    console.log(`Berhasil mengimpor Surah ${surah} Ayat ${firstAyah}-${lastAyah} (${words.length} kata)`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
