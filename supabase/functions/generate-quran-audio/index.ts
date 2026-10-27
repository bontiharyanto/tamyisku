import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
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

    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) return json({ error: profileError.message }, 500);
    if (profile?.role !== 'admin') return json({ error: 'Hanya admin' }, 403);

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? '').trim();
    const prefix = body.prefix === 'premium' ? 'premium' : 'free';
    if (!text) return json({ error: 'Teks Arab kosong' }, 400);

    const audio = (await elevenLabsMp3(text)) ?? (await googleMp3(text));
    if (!audio) {
      return json({ error: 'Isi ELEVENLABS_API_KEY atau GOOGLE_TTS_API_KEY di secret Edge Function' }, 501);
    }

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${prefix}:${text}`));
    const slug = Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const objectPath = `${prefix}/${slug}.mp3`;
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: uploadError } = await admin.storage.from('quran_audios').upload(objectPath, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (uploadError) return json({ error: uploadError.message }, 500);

    return json({ audio_url: `quran_audios/${objectPath}` });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal membuat audio';
    return json({ error: message }, 500);
  }
});
