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
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Masuk terlebih dahulu' }, 401);

    const body = await req.json().catch(() => ({}));
    const ticketId = String(body.ticket_id ?? '');
    if (!ticketId) return json({ error: 'Tiket tidak ditemukan' }, 400);

    const { data: ticket, error: ticketError } = await userClient
      .from('support_tickets')
      .select('id, category, subject, description, status, created_at')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError || !ticket) return json({ error: 'Tiket tidak ditemukan' }, 404);

    const webhook = Deno.env.get('SUPPORT_WEBHOOK_URL') ?? '';
    if (!webhook) return json({ ok: true, notified: false });

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'support_ticket.created',
        email: userData.user.email,
        ticket,
      }),
    });
    if (!response.ok) return json({ error: 'Webhook dukungan gagal' }, 502);
    return json({ ok: true, notified: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal mengirim notifikasi';
    return json({ error: message }, 500);
  }
});
