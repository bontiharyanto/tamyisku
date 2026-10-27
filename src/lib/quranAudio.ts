import { signStoredAudio, upsertWord } from '@/lib/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { QuranWord } from '@/lib/types';
import type { WorkSheet } from 'xlsx';

export type AudioPrefix = 'free' | 'premium';

export type ImportedWord = {
  arabicText: string;
  translation: string;
  tamyizCategory: string;
  surahNumber: number;
  ayahNumber: number;
  wordPosition: number;
};

const CATEGORIES = new Set(['Isim', "Fi'il", 'Huruf', 'Tamyiz 1', 'Tamyiz 2', 'Tamyiz 3', 'Tamyiz 4']);

export function audioPrefixForLesson(orderIndex: number): AudioPrefix {
  return orderIndex === 1 ? 'free' : 'premium';
}

async function functionMessage(error: Error) {
  const response = (error as Error & { context?: { json?: () => Promise<{ error?: string }> } }).context;
  if (response?.json) {
    try {
      const body = await response.json();
      if (body.error) return body.error;
    } catch {
      return error.message;
    }
  }
  return error.message;
}

export async function generateQuranAudio(text: string, prefix: AudioPrefix) {
  if (!isSupabaseConfigured) throw new Error('Generator audio membutuhkan Supabase');
  const { data, error } = await supabase.functions.invoke('generate-quran-audio', {
    body: { text, prefix },
  });
  if (error) throw new Error(await functionMessage(error));
  const payload = data as { audio_url?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.audio_url) throw new Error('URL audio tidak diterima');
  return payload.audio_url;
}

export async function uploadQuranAudio(blob: Blob, prefix: AudioPrefix, extension: 'mp3' | 'm4a') {
  if (!isSupabaseConfigured) throw new Error('Unggah audio membutuhkan Supabase');
  const objectPath = `${prefix}/recorded-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('quran_audios').upload(objectPath, blob, {
    contentType: extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return `quran_audios/${objectPath}`;
}

export async function previewStoredAudio(path: string) {
  return signStoredAudio(path);
}

function resample(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input;
  const length = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = (index * fromRate) / toRate;
    const cursor = Math.floor(position);
    const mix = position - cursor;
    const start = input[cursor] ?? 0;
    const end = input[cursor + 1] ?? start;
    output[index] = start + (end - start) * mix;
  }
  return output;
}

export async function encodeRecordingMp3(blob: Blob) {
  if (blob.type.includes('mp4') || blob.type.includes('m4a') || blob.type.includes('aac')) {
    return { blob, extension: 'm4a' as const };
  }
  const { Mp3Encoder } = await import('lamejs');
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  const samples = resample(decoded.getChannelData(0), decoded.sampleRate, 22050);
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const encoder = new Mp3Encoder(1, 22050, 64);
  const parts: BlobPart[] = [];
  const block = 1152;
  const copy = (bytes: Int8Array) => {
    const next = new Uint8Array(bytes.byteLength);
    next.set(bytes);
    return next;
  };
  for (let index = 0; index < pcm.length; index += block) {
    const encoded = encoder.encodeBuffer(pcm.subarray(index, index + block));
    if (encoded.length) parts.push(copy(encoded));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(copy(tail));
  await context.close();
  return { blob: new Blob(parts, { type: 'audio/mpeg' }), extension: 'mp3' as const };
}

function cell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === name);
    if (found) return String(found[1] ?? '').trim();
  }
  return '';
}

function normalizeCategory(value: string) {
  const compact = value.replace(/[’‘]/g, "'").trim();
  if (CATEGORIES.has(compact)) return compact;
  const lower = compact.toLowerCase();
  if (lower === 'isim') return 'Isim';
  if (lower === "fi'il" || lower === 'fiil' || lower === 'fi’il') return "Fi'il";
  if (lower === 'huruf') return 'Huruf';
  const tamyiz = lower.match(/^tamyiz\s*([1-4])$/);
  if (tamyiz) return `Tamyiz ${tamyiz[1]}`;
  return '';
}

export function rowsToWords(rows: Record<string, unknown>[]) {
  const words: ImportedWord[] = [];
  const problems: string[] = [];
  rows.forEach((row, index) => {
    const arabicText = cell(row, ['arabic_text', 'arab', 'arabic', 'kata']);
    const translation = cell(row, ['translation', 'arti', 'terjemahan']);
    const tamyizCategory = normalizeCategory(cell(row, ['tamyiz_category', 'kategori', 'category']));
    if (!arabicText && !translation) return;
    if (!arabicText || !translation || !tamyizCategory) {
      problems.push(`Baris ${index + 2} dilewati karena teks, arti, atau kategori tidak lengkap.`);
      return;
    }
    words.push({
      arabicText,
      translation,
      tamyizCategory,
      surahNumber: Number(cell(row, ['surah_number', 'surah'])) || 1,
      ayahNumber: Number(cell(row, ['ayah_number', 'ayat', 'ayah'])) || 1,
      wordPosition: Number(cell(row, ['word_position', 'posisi'])) || index + 1,
    });
  });
  return { words, problems };
}

export async function readWordSheet(file: Blob) {
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]] as WorkSheet;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return rowsToWords(rows);
}

export async function saveImportedWords({
  lessonId,
  words,
  prefix,
  onProgress,
}: {
  lessonId: string;
  words: ImportedWord[];
  prefix: AudioPrefix;
  onProgress: (message: string) => void;
}) {
  const saved: QuranWord[] = [];
  for (const [index, word] of words.entries()) {
    const draft: QuranWord = {
      id: '',
      lessonId,
      surahNumber: word.surahNumber,
      ayahNumber: word.ayahNumber,
      wordPosition: word.wordPosition || index + 1,
      arabicText: word.arabicText,
      transliteration: '',
      translation: word.translation,
      tamyizCategory: word.tamyizCategory,
      colorCode: null,
      audioUrl: null,
    };
    onProgress(`Menyimpan kata ${index + 1} dari ${words.length}`);
    const id = await upsertWord(draft);
    saved.push({ ...draft, id: id ?? '' });
  }
  let generated = 0;
  for (const [index, word] of saved.entries()) {
    onProgress(`Membuat audio ${index + 1} dari ${saved.length}`);
    const audioUrl = await generateQuranAudio(word.arabicText, prefix);
    await upsertWord({ ...word, audioUrl });
    generated += 1;
  }
  return generated;
}

export async function fillMissingAudio(words: QuranWord[], prefix: AudioPrefix, onProgress: (message: string) => void) {
  const pending = words.filter((word) => word.id && !word.audioUrl);
  let generated = 0;
  for (const [index, word] of pending.entries()) {
    onProgress(`Membuat audio ${index + 1} dari ${pending.length}`);
    const audioUrl = await generateQuranAudio(word.arabicText, prefix);
    await upsertWord({ ...word, audioUrl });
    generated += 1;
  }
  return generated;
}
