// Seed quran_words from Quran.com word-by-word data.
//
// Local run (service role is printed by `npx supabase status`, do not commit it):
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=kunci-anon
//   export SUPABASE_ADMIN_EMAIL=admin@contoh.test
//   export SUPABASE_ADMIN_PASSWORD=kata-sandi-admin
//   node scripts/seed-quran-words.mjs --surah 1
//   node scripts/seed-quran-words.mjs --from 1 --to 114
//   node scripts/seed-quran-words.mjs --surah 1 --dry-run

import { createClient } from '@supabase/supabase-js';

const AUDIO_CDN = 'https://audio.qurancdn.com/';
const API = 'https://api.quran.com/api/v4';
const BATCH = 100;

const COLORS = {
  Isim: '#1976D2',
  "Fi'il": '#D32F2F',
  Huruf: '#388E3C',
};

const HURUF = new Set(
  [
    'في', 'من', 'الى', 'على', 'عن', 'ان', 'إن', 'أن', 'لا', 'ما', 'لم', 'لن', 'الا', 'إلا',
    'حتى', 'ثم', 'او', 'أو', 'بل', 'قد', 'سوف', 'كي', 'لكي', 'لولا', 'لو', 'اذا', 'إذا', 'اذ', 'إذ',
    'ب', 'و', 'ف', 'ل', 'ك', 'انما', 'إنما', 'لكن', 'ولكن', 'يا', 'ايها', 'أيها',
  ].map(normalizeArabic),
);

const FIIl = new Set(
  [
    'قال', 'قالوا', 'قل', 'قلت', 'كان', 'كانوا', 'كن', 'جعل', 'خلق', 'علم', 'عمل', 'جاء', 'ذهبوا',
    'نظر', 'سمع', 'كفر', 'كفروا', 'امن', 'آمن', 'آمنوا', 'عبد', 'رزق', 'هدى', 'قتل', 'مات', 'شاء',
    'انزل', 'أنزل', 'ارسل', 'أرسل', 'يعملون', 'يكفرون', 'يؤمنون', 'يقول', 'تقول', 'نقول', 'يكون',
    'تكون', 'يعلم', 'تعلم', 'نعلم', 'يفعل', 'تريد', 'يريد', 'نزل', 'يتلو', 'اتل',
  ].map(normalizeArabic),
);

function normalizeArabic(value) {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function tamyizCategory(arabic) {
  const stripped = normalizeArabic(arabic);
  if (!stripped) return 'Isim';
  if (HURUF.has(stripped)) return 'Huruf';
  if (FIIl.has(stripped)) return "Fi'il";
  if (!stripped.startsWith('ال') && /^(ي|ت|ن|ا).{2,}(ون|ين|وا|تم|نا|ت)$/.test(stripped)) return "Fi'il";
  return 'Isim';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function args() {
  const values = new Map();
  const list = process.argv.slice(2);
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = list[index + 1];
    if (!next || next.startsWith('--')) values.set(key, 'true');
    else {
      values.set(key, next);
      index += 1;
    }
  }
  const surah = Number(values.get('surah') || 0);
  const from = Number(values.get('from') || surah || 1);
  const to = Number(values.get('to') || surah || from);
  return { from, to, dryRun: values.has('dry-run') };
}

async function getJson(url) {
  let lastError = 'permintaan gagal';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'TamyizkuSeeder/1.0' },
    });
    if (response.status === 429 || response.status >= 500) {
      lastError = `HTTP ${response.status}`;
      await sleep(400 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`Quran.com ${response.status} untuk ${url}`);
    return response.json();
  }
  throw new Error(`${lastError} untuk ${url}`);
}

async function chapterVerses(surah) {
  const payload = await getJson(`${API}/chapters/${surah}?language=id`);
  return {
    name: payload.chapter?.name_simple || `Surah ${surah}`,
    verses: Number(payload.chapter?.verses_count || 0),
  };
}

async function fetchSurahWords(surah) {
  const words = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const payload = await getJson(
      `${API}/verses/by_chapter/${surah}?language=id&words=true&word_fields=text_uthmani,transliteration,audio_url&per_page=50&page=${page}`,
    );
    totalPages = Number(payload.pagination?.total_pages || 1);
    for (const verse of payload.verses ?? []) {
      const [surahNumber, ayahNumber] = String(verse.verse_key).split(':').map(Number);
      for (const word of verse.words ?? []) {
        if (word.char_type_name === 'end') continue;
        const arabic = String(word.text_uthmani || word.text || '').trim();
        if (!arabic) continue;
        const category = tamyizCategory(arabic);
        words.push({
          surah_number: surahNumber,
          ayah_number: ayahNumber,
          word_position: Number(word.position),
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
    await sleep(150);
  }
  return words;
}

async function lessonForSurah(supabase, surah, name) {
  const orderIndex = 1000 + surah;
  const { data: existing, error } = await supabase.from('lessons').select('id').eq('order_index', orderIndex).maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id;
  const { data, error: insertError } = await supabase
    .from('lessons')
    .insert({
      title: `${name}`,
      level: 1,
      category: 'Kosa kata',
      description: 'Kata per kata surah ini, dengan audio bacaan.',
      order_index: orderIndex,
    })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);
  return data.id;
}

async function existingLessons(supabase, surah) {
  const { data, error } = await supabase
    .from('quran_words')
    .select('ayah_number, word_position, lesson_id')
    .eq('surah_number', surah);
  if (error) throw new Error(error.message);
  const map = new Map();
  for (const row of data ?? []) map.set(`${row.ayah_number}:${row.word_position}`, row.lesson_id);
  return map;
}

async function adminClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error('Isi SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAIL, dan SUPABASE_ADMIN_PASSWORD. Jalankan dengan --dry-run untuk mencoba tanpa database.');
  }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return supabase;
}

async function upsertBatches(supabase, rows) {
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const { error } = await supabase.from('quran_words').upsert(batch, {
      onConflict: 'surah_number,ayah_number,word_position',
    });
    if (error) throw new Error(error.message);
  }
}

async function main() {
  const { from, to, dryRun } = args();
  if (from < 1 || to > 114 || from > to) throw new Error('Gunakan surah 1 sampai 114.');
  const supabase = dryRun ? null : await adminClient();

  for (let surah = from; surah <= to; surah += 1) {
    const chapter = await chapterVerses(surah);
    const words = await fetchSurahWords(surah);
    const firstAyah = words[0]?.ayah_number ?? 1;
    const lastAyah = words.at(-1)?.ayah_number ?? chapter.verses;
    if (dryRun) {
      console.log(`Dry-run Surah ${surah} Ayat ${firstAyah}-${lastAyah} (${words.length} kata)`);
      continue;
    }
    const fallbackLesson = await lessonForSurah(supabase, surah, chapter.name);
    const kept = await existingLessons(supabase, surah);
    const rows = words.map((word) => ({
      ...word,
      lesson_id: kept.get(`${word.ayah_number}:${word.word_position}`) ?? fallbackLesson,
    }));
    await upsertBatches(supabase, rows);
    console.log(`Berhasil mengimpor Surah ${surah} Ayat ${firstAyah}-${lastAyah} (${words.length} kata)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
