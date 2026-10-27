import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AUDIO_CDN = 'https://audio.qurancdn.com/';
const QURAN_API = 'https://api.quran.com/api/v4';
const MAX_WORDS = 25;

type IncomingWord = { id?: string; arabic?: string };
type AudioStatus = 'quran' | 'ai' | 'missing';
type BoundWord = {
  id: string;
  arabic: string;
  audio_url: string | null;
  translation: string | null;
  status: AudioStatus;
};
type VerseWord = { text_uthmani?: string; text?: string; audio_url?: string | null; translation?: { text?: string }; char_type_name?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

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

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function arabicTokens(text: string) {
  const found = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g) ?? [];
  return found.filter((token) => {
    const stripped = normalizeArabic(token);
    return stripped.length > 0 && !/^[\u0660-\u0669]+$/.test(stripped);
  });
}

async function wordsFromPdf(pdfBase64: string) {
  const bytes = decodeBase64(pdfBase64);
  const { extractText, getDocumentProxy } = await import('npm:unpdf@1.9.1');
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text) ? extracted.text.join('\n') : String(extracted.text ?? '');
  return arabicTokens(text).slice(0, 200).map((arabic, index) => ({ id: String(index), arabic }));
}

async function elevenLabsMp3(text: string) {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') ?? '';
  if (!apiKey || !voiceId) return null;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8 },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs menolak permintaan (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function googleMp3(text: string) {
  const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY') ?? '';
  if (!apiKey) return null;
  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
    }),
  });
  if (!response.ok) throw new Error(`Google TTS menolak permintaan (${response.status})`);
  const payload = await response.json();
  const audio = String(payload.audioContent ?? '');
  if (!audio) throw new Error('Google TTS tidak mengembalikan audio');
  return decodeBase64(audio);
}

async function storeTts(admin: ReturnType<typeof createClient>, prefix: string, text: string) {
  const audio = (await elevenLabsMp3(text)) ?? (await googleMp3(text));
  if (!audio) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${prefix}:${text}`));
  const slug = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const objectPath = `${prefix}/${slug}.mp3`;
  const { error } = await admin.storage.from('quran_audios').upload(objectPath, audio, {
    contentType: 'audio/mpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return `quran_audios/${objectPath}`;
}

function publicAudio(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('quran_audios/')) return path;
  return `${AUDIO_CDN}${path.replace(/^\//, '')}`;
}

async function getJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TamyizkuAudioBind/1.0' } });
  if (!response.ok) throw new Error(`Quran.com ${response.status}`);
  return response.json();
}

async function verseWords(verseKey: string, cache: Map<string, VerseWord[]>) {
  const cached = cache.get(verseKey);
  if (cached) return cached;
  const payload = await getJson(
    `${QURAN_API}/verses/by_key/${verseKey}?words=true&language=id&word_fields=text_uthmani,audio_url`,
  );
  const words = (payload.verse?.words ?? []) as VerseWord[];
  cache.set(verseKey, words);
  return words;
}

async function matchDatabase(admin: ReturnType<typeof createClient>, arabic: string) {
  const { data, error } = await admin
    .from('quran_words')
    .select('audio_url, translation')
    .eq('arabic_text', arabic)
    .not('audio_url', 'is', null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.audio_url) return null;
  return { audio_url: publicAudio(String(data.audio_url)), translation: data.translation ? String(data.translation) : null };
}

async function matchQuranApi(arabic: string, cache: Map<string, VerseWord[]>) {
  const needle = normalizeArabic(arabic);
  if (!needle) return null;
  const payload = await getJson(`${QURAN_API}/search?q=${encodeURIComponent(needle)}&size=5`);
  const results = (payload.search?.results ?? []) as { verse_key?: string }[];
  for (const result of results) {
    if (!result.verse_key) continue;
    const words = await verseWords(result.verse_key, cache);
    const match = words.find((word) => {
      if (word.char_type_name === 'end') return false;
      return normalizeArabic(String(word.text_uthmani || word.text || '')) === needle;
    });
    const audio = publicAudio(match?.audio_url);
    if (match && audio) {
      return { audio_url: audio, translation: match.translation?.text?.trim() || null };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Masuk terlebih dahulu' }, 401);

    const { data: profile, error: profileError } = await userClient.from('users').select('role').eq('id', userData.user.id).maybeSingle();
    if (profileError) return json({ error: profileError.message }, 500);
    if (profile?.role !== 'admin') return json({ error: 'Hanya admin' }, 403);

    const body = await req.json().catch(() => ({}));
    const prefix = body.prefix === 'premium' ? 'premium' : 'free';
    const mode = body.mode === 'extract' ? 'extract' : 'bind';
    let incoming = Array.isArray(body.words) ? (body.words as IncomingWord[]) : [];
    if (typeof body.pdf_base64 === 'string' && body.pdf_base64.trim()) {
      incoming = await wordsFromPdf(body.pdf_base64.trim());
    }
    const words = incoming
      .map((word, index) => ({ id: String(word.id ?? index), arabic: String(word.arabic ?? '').trim() }))
      .filter((word) => word.arabic);
    if (!words.length) return json({ error: 'Tidak ada kata Arab yang bisa diproses' }, 422);
    if (mode === 'extract') {
      return json({
        words: words.map((word) => ({ id: word.id, arabic: word.arabic, audio_url: null, translation: null, status: 'missing' })),
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const cache = new Map<string, VerseWord[]>();
    const bound: BoundWord[] = [];
    for (const word of words.slice(0, MAX_WORDS)) {
      try {
        const fromDb = await matchDatabase(admin, word.arabic);
        const fromApi = fromDb ?? (await matchQuranApi(word.arabic, cache));
        if (fromApi?.audio_url) {
          bound.push({ ...word, audio_url: fromApi.audio_url, translation: fromApi.translation, status: 'quran' });
          continue;
        }
        const stored = await storeTts(admin, prefix, word.arabic);
        bound.push({
          ...word,
          audio_url: stored,
          translation: null,
          status: stored ? 'ai' : 'missing',
        });
      } catch {
        bound.push({ ...word, audio_url: null, translation: null, status: 'missing' });
      }
    }
    for (const word of words.slice(MAX_WORDS)) {
      bound.push({ ...word, audio_url: null, translation: null, status: 'missing' });
    }
    return json({ words: bound });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal menyesuaikan audio';
    return json({ error: message }, 500);
  }
});
