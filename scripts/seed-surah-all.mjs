// Isi kuis surah yang belum ditinjau tangan.
// Surah 1, 2, 36, 78, dan 114 tidak ditimpa.
// Soal kelas kata hanya dibuat bila tandanya kuat. Sisanya menanyakan arti dari glos Quran.com.
//
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=kunci-anon
//   export SUPABASE_ADMIN_EMAIL=email-admin
//   export SUPABASE_ADMIN_PASSWORD=kata-sandi-admin
//   node scripts/seed-surah-all.mjs

import { createClient } from '@supabase/supabase-js';

const PROTECTED = new Set([1, 2, 36, 78, 114]);
const MUQATTAAT = new Set(['الم', 'المص', 'المر', 'الر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن']);
const HURUF = new Set(
  ['في', 'علي', 'عن', 'الي', 'ثم', 'او', 'بل', 'قد', 'سوف', 'لن', 'لم', 'لما', 'لا', 'الا', 'حتي', 'كي', 'لكي', 'لو', 'لولا', 'يا', 'هل', 'ان', 'انما', 'لكن', 'ولكن'].map(normalize),
);
const FIIL = new Set(
  ['قال', 'قالوا', 'قل', 'قلت', 'كان', 'كانوا', 'كن', 'جعل', 'خلق', 'جاء', 'كفروا', 'امنوا', 'اعلم', 'اعبد', 'اهدنا'].map(normalize),
);

const CLASS_OPTIONS = [
  'Isim · biru · alif-lam atau tanwin',
  "Fi'il · merah · kata kerja",
  'Huruf · hijau · partikel',
  'Lebih dari satu kelas · huruf dan kata lain tertulis menyatu',
];

function normalize(value) {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u08D3-\u08FF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A]/g, '');
}

function hasTanwin(arabic) {
  return /[\u064B\u064C\u064D]/.test(arabic);
}

function feminineVerb(arabic) {
  return /ت[ْۭۡ]?$/.test(arabic.trim());
}

function keyHamza(value) {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u08D3-\u08FF]/g, '')
    .replace(/[^\u0621-\u064A]/g, '');
}

function isBareVerb(arabic) {
  const key = keyHamza(arabic);
  if (FIIL.has(key) || feminineVerb(arabic)) return true;
  const bare = normalize(arabic);
  return /^(ي|ت|ن|ا)(?!ل).{2,}(ون|ين)$/.test(bare);
}

function assess(arabic) {
  const bare = normalize(arabic);
  const key = keyHamza(arabic);
  if (!bare || MUQATTAAT.has(bare)) return { kind: 'unknown', sign: '' };
  if (key === 'كأن' || key === 'أن' || key === 'إن' || key === 'لكن') return { kind: 'huruf', sign: 'partikel yang berdiri sebagai kata sendiri' };
  if (arabic.startsWith('بِ') && bare.length > 2) return { kind: 'campuran', sign: 'بِ huruf jar di depan isim, tertulis satu kata' };
  if ((arabic.startsWith('وَ') || arabic.startsWith('فَ')) && (hasTanwin(arabic) || /^(و|ف)ال/.test(bare))) {
    return { kind: 'campuran', sign: 'waw atau fa di depan isim, tertulis satu kata' };
  }
  if ((arabic.startsWith('وَ') || arabic.startsWith('فَ')) && isBareVerb(arabic.slice(2))) {
    return { kind: 'huruffiil', sign: 'waw atau fa di depan fi\'il, tertulis satu kata' };
  }
  if (HURUF.has(bare)) return { kind: 'huruf', sign: 'partikel yang berdiri sebagai kata sendiri' };
  if (arabic.startsWith('وَ') || arabic.startsWith('فَ') || arabic.startsWith('بِ')) return { kind: 'unknown', sign: '' };
  if (isBareVerb(arabic)) {
    return { kind: 'fiil', sign: feminineVerb(arabic) ? 'ta sukun di akhir, tanda fi\'il madhi' : 'bentuk fi\'il' };
  }
  if (hasTanwin(arabic)) return { kind: 'isim', sign: 'tanwin' };
  if (bare.startsWith('ال') && bare.length > 3) return { kind: 'isim', sign: 'alif-lam' };
  if (arabic.includes('ة')) return { kind: 'isim', sign: 'ta marbutah' };
  return { kind: 'unknown', sign: '' };
}

function cardCategory(kind) {
  if (kind === 'huruf') return 'Huruf';
  if (kind === 'fiil') return "Fi'il";
  if (kind === 'isim') return 'Isim';
  if (kind === 'campuran') return 'Campuran';
  if (kind === 'huruffiil') return 'HurufFiil';
  return 'Teks';
}

function classAnswer(kind) {
  if (kind === 'isim') return CLASS_OPTIONS[0];
  if (kind === 'fiil') return CLASS_OPTIONS[1];
  if (kind === 'huruf') return CLASS_OPTIONS[2];
  return CLASS_OPTIONS[3];
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, count, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, count);
}

function verseAround(words, focus) {
  const ayah = words.filter((word) => word.ayah_number === focus.ayah_number);
  const index = Math.max(0, ayah.findIndex((word) => word.id === focus.id));
  return ayah.slice(Math.max(0, index - 3), index + 4).map((word) => ({
    arabic: word.arabic_text,
    category: cardCategory(word.kind),
    translation: word.translation,
    audio_url: word.audio_url,
  }));
}

function classQuestion(word, words) {
  const correct = classAnswer(word.kind);
  const sign = word.sign ? ` Tandanya ${word.sign}.` : '';
  const own =
    word.kind === 'huruffiil'
      ? `${word.arabic_text} berisi huruf dan fi'il dalam satu kata tertulis.${sign}`
      : word.kind === 'campuran'
        ? `${word.arabic_text} berisi huruf dan isim dalam satu kata tertulis.${sign}`
        : `${word.arabic_text} masuk kelas ini.${sign}`;
  return {
    surah_number: word.surah_number,
    ayah_number: word.ayah_number,
    skill_level: word.kind === 'huruf' || word.kind === 'campuran' ? 1 : 2,
    formula_key: null,
    prompt: `Kelas kata tertulis ${word.arabic_text} pada ayat ini adalah…`,
    highlighted_word: word.arabic_text,
    verse_words: verseAround(words, word),
    options: CLASS_OPTIONS,
    option_rationales: CLASS_OPTIONS.map((option) => (option === correct ? own : 'Kelas ini bukan tanda yang ada pada kata tertulis tersebut.')),
    correct_answer: correct,
    explanation: own,
    audio_url: word.audio_url,
  };
}

function meaningQuestion(word, words, pool) {
  const distractors = [];
  for (const other of pool) {
    if (other.translation === word.translation || distractors.includes(other.translation)) continue;
    distractors.push(other.translation);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = [word.translation, ...distractors];
  return {
    surah_number: word.surah_number,
    ayah_number: word.ayah_number,
    skill_level: 3,
    formula_key: null,
    prompt: `Arti ${word.arabic_text} pada ayat ini, menurut glos kata, adalah…`,
    highlighted_word: word.arabic_text,
    verse_words: verseAround(words, word),
    options,
    option_rationales: options.map((option) =>
      option === word.translation ? `${word.arabic_text} berarti ${word.translation}.` : `${option} adalah arti kata lain pada surah ini.`,
    ),
    correct_answer: word.translation,
    explanation: `${word.arabic_text} berarti ${word.translation}.`,
    audio_url: word.audio_url,
  };
}

function buildSurah(rawWords, random) {
  const words = rawWords.map((word) => {
    const judged = assess(word.arabic_text);
    return { ...word, ...judged };
  });
  const usableGloss = words.filter((word) => word.translation && word.translation !== '—' && word.translation.length > 1);
  const chosen = [
    ...pick(words.filter((word) => word.kind === 'isim'), 3, random),
    ...pick(words.filter((word) => word.kind === 'fiil'), 3, random),
    ...pick(words.filter((word) => word.kind === 'huruf'), 2, random),
    ...pick(words.filter((word) => word.kind === 'campuran'), 2, random),
  ];
  const questions = chosen.map((word) => classQuestion(word, words));
  const glossPool = pick(usableGloss, 12, random);
  for (const word of glossPool) {
    if (questions.length >= 10) break;
    const question = meaningQuestion(word, words, usableGloss);
    if (question) questions.push(question);
  }
  return questions.slice(0, 10).map((question, index) => ({ ...question, order_index: index + 1 }));
}

async function wordsForSurah(supabase, surah) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('quran_words')
      .select('id, surah_number, ayah_number, word_position, arabic_text, translation, audio_url')
      .eq('surah_number', surah)
      .order('ayah_number')
      .order('word_position')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_ADMIN_EMAIL;
const password = process.env.SUPABASE_ADMIN_PASSWORD;
if (!url || !anonKey || !email || !password) {
  console.error('Butuh SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAIL, dan SUPABASE_ADMIN_PASSWORD.');
  process.exit(1);
}

const cardsOnly = process.argv.includes('--cards');
const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
if (signError) throw new Error(signError.message);

const CARD_COLOR = { Isim: '#1976D2', "Fi'il": '#D32F2F', Huruf: '#388E3C' };

async function refreshConfidentCards() {
  let changed = 0;
  for (let surah = 1; surah <= 114; surah += 1) {
    const rows = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('quran_words')
        .select('id, arabic_text, tamyiz_category')
        .eq('surah_number', surah)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    const buckets = { Isim: [], "Fi'il": [], Huruf: [] };
    for (const row of rows) {
      const judged = assess(row.arabic_text);
      const next = judged.kind === 'isim' ? 'Isim' : judged.kind === 'fiil' ? "Fi'il" : judged.kind === 'huruf' ? 'Huruf' : null;
      if (!next || next === row.tamyiz_category) continue;
      buckets[next].push(row.id);
    }
    for (const [category, ids] of Object.entries(buckets)) {
      for (let index = 0; index < ids.length; index += 200) {
        const slice = ids.slice(index, index + 200);
        const { error } = await supabase.from('quran_words').update({ tamyiz_category: category, color_code: CARD_COLOR[category] }).in('id', slice);
        if (error) throw new Error(error.message);
        changed += slice.length;
      }
    }
    console.log(`Kartu surah ${surah} dicek`);
  }
  console.log(`Kartu yang kelas pastinya diperbarui: ${changed}`);
}

if (cardsOnly) {
  await refreshConfidentCards();
  process.exit(0);
}

const bank = [];
for (let surah = 1; surah <= 114; surah += 1) {
  if (PROTECTED.has(surah)) {
    console.log(`Surah ${surah}: soal tinjauan tetap`);
    continue;
  }
  const words = await wordsForSurah(supabase, surah);
  const questions = buildSurah(words, mulberry32(surah * 997));
  if (questions.length < 8) throw new Error(`Surah ${surah} hanya ${questions.length} soal`);
  bank.push(...questions);
  console.log(`Surah ${surah}: ${questions.length} soal dari ${words.length} kata`);
}

for (let index = 0; index < bank.length; index += 100) {
  const batch = bank.slice(index, index + 100);
  const { error } = await supabase.from('surah_quizzes').upsert(batch, { onConflict: 'surah_number,order_index' });
  if (error) throw new Error(error.message);
}
console.log(`Berhasil menyimpan ${bank.length} soal untuk surah yang belum ditinjau`);
