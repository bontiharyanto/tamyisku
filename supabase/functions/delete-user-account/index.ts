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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Supabase belum dikonfigurasi' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Masuk terlebih dahulu' }, 401);

    const body = await req.json().catch(() => ({}));
    const confirmation = String(body.confirmation ?? '').trim();
    const password = String(body.password ?? '');
    const user = userData.user;

    if (confirmation !== 'HAPUS') {
      if (!password || !user.email) return json({ error: 'Ketik HAPUS atau masukkan kata sandi' }, 400);
      const { error: passwordError } = await userClient.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (passwordError) return json({ error: 'Kata sandi tidak sesuai' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = user.id;
    const tables = ['user_progress', 'user_quiz_results', 'user_juz_scores', 'user_surah_progress', 'payments', 'subscriptions', 'user_streaks', 'user_badges', 'pending_celebrations'] as const;
    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) return json({ error: error.message }, 500);
    }

    const { error: profileError } = await admin.from('users').delete().eq('id', userId);
    if (profileError) return json({ error: profileError.message }, 500);

    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError && !/not found/i.test(authError.message)) return json({ error: authError.message }, 500);

    return json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal menghapus akun';
    return json({ error: message }, 500);
  }
});
