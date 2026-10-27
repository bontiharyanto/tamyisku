import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRICE = 10000;
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Masuk terlebih dahulu' }, 401);

  const user = userData.user;
  const admin = createClient(supabaseUrl, serviceKey);
  const gateway = (Deno.env.get('PAYMENT_GATEWAY') ?? 'midtrans').toLowerCase();
  const orderId = `tmy-${user.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`;

  const { error: insertError } = await admin.from('payments').insert({
    user_id: user.id,
    gateway,
    external_id: orderId,
    amount: PRICE,
    status: 'pending',
  });
  if (insertError) return json({ error: insertError.message }, 500);

  try {
    if (gateway === 'xendit') {
      const secret = Deno.env.get('XENDIT_SECRET_KEY');
      if (!secret) return json({ error: 'XENDIT_SECRET_KEY belum diatur' }, 501);
      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${secret}:`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: orderId,
          amount: PRICE,
          currency: 'IDR',
          description: 'Langganan Bulanan Aplikasi Tamyiz (1 Bulan)',
          payer_email: user.email,
          invoice_duration: 86400,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        await admin.from('payments').update({ status: 'failed' }).eq('gateway', gateway).eq('external_id', orderId);
        return json({ error: payload.message ?? 'Xendit menolak transaksi' }, 502);
      }
      return json({ payment_url: payload.invoice_url, order_id: orderId });
    }

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) return json({ error: 'MIDTRANS_SERVER_KEY belum diatur' }, 501);
    const production = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';
    const host = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
    const response = await fetch(`${host}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${serverKey}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: PRICE },
        item_details: [
          {
            id: 'tamyiz-monthly',
            price: PRICE,
            quantity: 1,
            name: 'Langganan Bulanan Aplikasi Tamyiz (1 Bulan)',
          },
        ],
        customer_details: { email: user.email, first_name: user.id },
        custom_field1: user.id,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      await admin.from('payments').update({ status: 'failed' }).eq('gateway', gateway).eq('external_id', orderId);
      return json({ error: payload.error_messages ?? payload.status_message ?? 'Midtrans menolak transaksi' }, 502);
    }
    return json({ payment_url: payload.redirect_url, snap_token: payload.token, order_id: orderId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat pembayaran';
    return json({ error: message }, 500);
  }
});
