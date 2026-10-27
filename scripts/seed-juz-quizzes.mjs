// Bangun bank soal 30 juz dari quran_words, tulis JSON, lalu upsert ke quiz_questions.
//
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=kunci-anon
//   export SUPABASE_ADMIN_EMAIL=email-admin
//   export SUPABASE_ADMIN_PASSWORD=kata-sandi-admin
//   node scripts/seed-juz-quizzes.mjs
//
// Bentuk satu soal di scripts/data/juz-quizzes.json:
// {
//   "juz_number": 1,
//   "surah_number": 1,
//   "ayah_number": 1,
//   "skill_level": 1,
//   "prompt": "Manakah yang termasuk Huruf pada ayat ini?",
//   "highlighted_word": "بِسْمِ",
//   "verse_words": [{ "arabic": "بِسْمِ", "category": "Huruf", "translation": "dengan nama", "audio_url": "https://..." }],
//   "options": ["بِسْمِ", "ٱللَّهِ", "ٱلرَّحْمَٰنِ", "ٱلرَّحِيمِ"],
//   "correct_answer": "بِسْمِ",
//   "explanation": "Kata ini termasuk Huruf Tamyiz.",
//   "audio_url": "https://...",
//   "order_index": 1
// }

import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const JUZ = [
  [1, 1, 2, 141],
  [2, 142, 2, 252],
  [2, 253, 3, 92],
  [3, 93, 4, 23],
  [4, 24, 4, 147],
  [4, 148, 5, 81],
  [5, 82, 6, 110],
  [6, 111, 7, 87],
  [7, 88, 8, 40],
  [8, 41, 9, 92],
  [9, 93, 11, 5],
  [11, 6, 12, 52],
  [12, 53, 14, 52],
  [15, 1, 16, 128],
  [17, 1, 18, 74],
  [18, 75, 20, 135],
  [21, 1, 22, 78],
  [23, 1, 25, 20],
  [25, 21, 27, 55],
  [27, 56, 29, 45],
  [29, 46, 33, 30],
  [33, 31, 36, 27],
  [36, 28, 39, 31],
  [39, 32, 41, 46],
  [41, 47, 45, 37],
  [46, 1, 51, 30],
  [51, 31, 57, 29],
  [58, 1, 66, 12],
  [67, 1, 77, 50],
  [78, 1, 114, 6],
];

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function normalizeArabic(value) {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .trim();
}

function inJuz(word, startSurah, startAyah, endSurah, endAyah) {
  const afterStart = word.surah_number > startSurah || (word.surah_number === startSurah && word.ayah_number >= startAyah);
  const beforeEnd = word.surah_number < endSurah || (word.surah_number === endSurah && word.ayah_number <= endAyah);
  return afterStart && beforeEnd;
}

function windowWords(verse, target) {
  const index = verse.findIndex((word) => word.word_position === target.word_position);
  const start = Math.max(0, index - 3);
  return verse.slice(start, start + 8).map((word) => ({
    arabic: word.arabic_text,
    category: word.tamyiz_category,
    translation: word.translation,
    audio_url: word.audio_url,
  }));
}

function fiilExplanation(arabic) {
  const bare = normalizeArabic(arabic);
  if (/^[يتان]/.test(bare) && bare.length > 3) {
    return 'Kata ini adalah Fi\'il Mudhari\' karena diawali huruf Anitay (أ ن ي ت).';
  }
  return 'Kata ini adalah Fi\'il karena polanya kata kerja, bukan kata benda bertanwin atau ber-alif-lam.';
}

function isimExplanation(arabic) {
  if (/[ًٌٍ]/.test(arabic)) return 'Kata ini adalah Isim karena membawa tanwin.';
  if (normalizeArabic(arabic).startsWith('ال')) return 'Kata ini adalah Isim karena diawali alif-lam.';
  return 'Kata ini adalah Isim, kata benda dalam warna biru Tamyiz.';
}

function uniqueOptions(correct, pool, random, limit = 4) {
  const options = [correct];
  for (const item of shuffle(pool, random)) {
    if (options.length >= limit) break;
    if (!item || options.includes(item)) continue;
    options.push(item);
  }
  return shuffle(options, random);
}

function makeQuestion(partial, orderIndex) {
  return { ...partial, order_index: orderIndex };
}

function buildJuz(juzNumber, words, random) {
  const verses = new Map();
  for (const word of words) {
    const key = `${word.surah_number}:${word.ayah_number}`;
    const verse = verses.get(key) ?? [];
    verse.push(word);
    verses.set(key, verse);
  }
  for (const verse of verses.values()) verse.sort((left, right) => left.word_position - right.word_position);

  const huruf = words.filter((word) => word.tamyiz_category === 'Huruf');
  const isim = words.filter((word) => word.tamyiz_category === 'Isim');
  const fiil = words.filter((word) => word.tamyiz_category === "Fi'il");
  const questions = [];
  const used = new Set();

  function claim(word) {
    const key = `${word.surah_number}:${word.ayah_number}:${word.word_position}`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  }

  for (const word of shuffle(huruf, random)) {
    if (questions.length >= 4) break;
    if (!claim(word)) continue;
    const verse = verses.get(`${word.surah_number}:${word.ayah_number}`) ?? [];
    const options = uniqueOptions(word.arabic_text, verse.map((item) => item.arabic_text), random);
    if (options.length < 2) continue;
    questions.push(makeQuestion({
      juz_number: juzNumber,
      surah_number: word.surah_number,
      ayah_number: word.ayah_number,
      skill_level: 1,
      prompt: 'Manakah yang termasuk Huruf pada ayat ini?',
      highlighted_word: word.arabic_text,
      verse_words: windowWords(verse, word),
      options,
      correct_answer: word.arabic_text,
      explanation: 'Kata ini termasuk Huruf Tamyiz (hijau), seperti huruf jar atau huruf tugas.',
      audio_url: word.audio_url,
    }, questions.length + 1));
  }

  const grammar = shuffle([...isim.map((word) => ({ word, kind: 'isim' })), ...fiil.map((word) => ({ word, kind: 'fiil' }))], random);
  let grammarCount = 0;
  for (const item of grammar) {
    if (grammarCount >= 4) break;
    if (!claim(item.word)) continue;
    const verse = verses.get(`${item.word.surah_number}:${item.word.ayah_number}`) ?? [];
    questions.push(makeQuestion({
      juz_number: juzNumber,
      surah_number: item.word.surah_number,
      ayah_number: item.word.ayah_number,
      skill_level: 2,
      prompt: 'Kata yang ditandai termasuk kategori Tamyiz yang mana?',
      highlighted_word: item.word.arabic_text,
      verse_words: windowWords(verse, item.word),
      options: ['Isim', "Fi'il", 'Huruf', 'Tamyiz'],
      correct_answer: item.kind === 'fiil' ? "Fi'il" : 'Isim',
      explanation: item.kind === 'fiil' ? fiilExplanation(item.word.arabic_text) : isimExplanation(item.word.arabic_text),
      audio_url: item.word.audio_url,
    }, questions.length + 1));
    grammarCount += 1;
  }

  const translations = words.filter((word) => word.translation && word.translation !== '—');
  let translationCount = 0;
  for (const word of shuffle(translations, random)) {
    if (translationCount >= 4) break;
    if (!claim(word)) continue;
    const options = uniqueOptions(word.translation, translations.map((item) => item.translation), random);
    if (options.length < 2) continue;
    const verse = verses.get(`${word.surah_number}:${word.ayah_number}`) ?? [];
    questions.push(makeQuestion({
      juz_number: juzNumber,
      surah_number: word.surah_number,
      ayah_number: word.ayah_number,
      skill_level: 3,
      prompt: 'Apa arti kata yang ditandai?',
      highlighted_word: word.arabic_text,
      verse_words: windowWords(verse, word),
      options,
      correct_answer: word.translation,
      explanation: `${word.arabic_text} artinya "${word.translation}".`,
      audio_url: word.audio_url,
    }, questions.length + 1));
    translationCount += 1;
  }

  return questions.map((question, index) => ({ ...question, order_index: index + 1 }));
}

async function adminClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error('Isi SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAIL, dan SUPABASE_ADMIN_PASSWORD.');
  }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return supabase;
}

async function wordsForRange(supabase, startSurah, startAyah, endSurah, endAyah) {
  const rows = [];
  for (let surah = startSurah; surah <= endSurah; surah += 1) {
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      let query = supabase
        .from('quran_words')
        .select('surah_number, ayah_number, word_position, arabic_text, translation, tamyiz_category, audio_url')
        .eq('surah_number', surah)
        .order('ayah_number')
        .order('word_position')
        .range(from, from + pageSize - 1);
      if (surah === startSurah) query = query.gte('ayah_number', startAyah);
      if (surah === endSurah) query = query.lte('ayah_number', endAyah);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const page = (data ?? []).filter((word) => inJuz(word, startSurah, startAyah, endSurah, endAyah));
      rows.push(...page);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }
  return rows;
}

async function main() {
  const supabase = await adminClient();
  const bank = [];
  for (let juz = 1; juz <= 30; juz += 1) {
    const [startSurah, startAyah, endSurah, endAyah] = JUZ[juz - 1];
    const words = await wordsForRange(supabase, startSurah, startAyah, endSurah, endAyah);
    const questions = buildJuz(juz, words, mulberry32(juz * 997));
    if (questions.length < 10) throw new Error(`Juz ${juz} hanya menghasilkan ${questions.length} soal.`);
    bank.push(...questions);
    console.log(`Juz ${juz}: ${questions.length} soal dari ${words.length} kata`);
  }
  await mkdir('scripts/data', { recursive: true });
  await writeFile('scripts/data/juz-quizzes.json', `${JSON.stringify(bank, null, 2)}\n`);
  for (let index = 0; index < bank.length; index += 100) {
    const batch = bank.slice(index, index + 100);
    const { error } = await supabase.from('quiz_questions').upsert(batch, { onConflict: 'juz_number,order_index' });
    if (error) throw new Error(error.message);
  }
  console.log(`Berhasil menyimpan ${bank.length} soal ke quiz_questions`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
