import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sha512(value: string) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const body = await req.json();
  const gateway = body.external_id && !body.order_id ? 'xendit' : (Deno.env.get('PAYMENT_GATEWAY') ?? 'midtrans');

  let externalId = '';
  let paid = false;
  let method = 'unknown';
  let nextStatus = 'pending';

  if (gateway === 'xendit' || body.external_id) {
    const token = req.headers.get('x-callback-token') ?? '';
    const expected = Deno.env.get('XENDIT_CALLBACK_TOKEN') ?? '';
    if (!expected || !safeEqual(token, expected)) return json({ error: 'Invalid callback token' }, 401);
    externalId = String(body.external_id ?? '');
    nextStatus = String(body.status ?? 'pending');
    paid = nextStatus === 'PAID' || nextStatus === 'paid';
    method = String(body.payment_method ?? body.payment_channel ?? 'xendit');
  } else {
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') ?? '';
    const orderId = String(body.order_id ?? '');
    const statusCode = String(body.status_code ?? '');
    const grossAmount = String(body.gross_amount ?? '');
    const signature = String(body.signature_key ?? '');
    const expected = await sha512(`${orderId}${statusCode}${grossAmount}${serverKey}`);
    if (!serverKey || !safeEqual(signature.toLowerCase(), expected.toLowerCase())) {
      return json({ error: 'Invalid signature' }, 401);
    }
    externalId = orderId;
    nextStatus = String(body.transaction_status ?? 'pending');
    paid = nextStatus === 'settlement' || nextStatus === 'capture';
    method = String(body.payment_type ?? 'midtrans');
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('id, user_id, amount, status')
    .eq('external_id', externalId)
    .maybeSingle();

  if (paymentError || !payment) return json({ error: 'Order tidak ditemukan' }, 404);

  const reportedAmount = Number(body.gross_amount ?? body.amount ?? payment.amount);
  if (Math.round(reportedAmount) !== payment.amount) return json({ error: 'Nominal tidak sesuai' }, 400);

  if (payment.status === 'settlement' || payment.status === 'paid' || payment.status === 'PAID') {
    return json({ ok: true });
  }

  await admin.from('payments').update({ status: nextStatus, payment_method: method }).eq('id', payment.id);

  if (paid) {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: payment.user_id,
        status: 'active',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        payment_method: method,
        updated_at: start.toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Webhook gagal';
    return json({ error: message }, 500);
  }
});
