// Upsert bank diagnostik per surah dari scripts/data/surah-diagnostic.json.
//
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=kunci-anon
//   export SUPABASE_ADMIN_EMAIL=email-admin
//   export SUPABASE_ADMIN_PASSWORD=kata-sandi-admin
//   node scripts/seed-surah-quizzes.mjs

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_ADMIN_EMAIL;
const password = process.env.SUPABASE_ADMIN_PASSWORD;

if (!url || !anonKey || !email || !password) {
  console.error('Butuh SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ADMIN_EMAIL, dan SUPABASE_ADMIN_PASSWORD.');
  process.exit(1);
}

const rows = JSON.parse(await readFile(new URL('./data/surah-diagnostic.json', import.meta.url), 'utf8'));
if (!Array.isArray(rows) || rows.length !== 10) {
  throw new Error('Diagnostik surah harus berisi 10 soal.');
}

for (const row of rows) {
  if (!Array.isArray(row.options) || row.options.length !== 4) throw new Error(`Opsi soal surah ${row.surah_number} tidak empat.`);
  if (!Array.isArray(row.option_rationales) || row.option_rationales.length !== row.options.length) {
    throw new Error(`Rasio opsi surah ${row.surah_number} tidak seimbang.`);
  }
  if (!row.options.includes(row.correct_answer)) throw new Error(`Kunci surah ${row.surah_number} tidak ada di opsi.`);
  if (row.skill_level === 4 && !row.formula_key) throw new Error('Level 4 wajib punya formula_key.');
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
if (signError) throw new Error(signError.message);

const payload = rows.map((row) => ({
  surah_number: row.surah_number,
  ayah_number: row.ayah_number,
  skill_level: row.skill_level,
  formula_key: row.formula_key,
  prompt: row.prompt,
  highlighted_word: row.highlighted_word,
  verse_words: row.verse_words,
  options: row.options,
  option_rationales: row.option_rationales,
  correct_answer: row.correct_answer,
  explanation: row.explanation,
  audio_url: row.audio_url,
  order_index: row.order_index,
}));

const { error } = await supabase.from('surah_quizzes').upsert(payload, { onConflict: 'surah_number,order_index' });
if (error) throw new Error(error.message);
console.log(`Berhasil menyimpan ${payload.length} soal ke surah_quizzes`);
