# Tamyizku

Aplikasi belajar Al-Qur'an metode Tamyiz untuk Android, iOS, dan web. Satu codebase Expo. Data, akun, dan audio tinggal di Supabase.

## Menjalankan tampilan

```bash
npm install
npx expo start
```

Tekan `w` untuk web. Tanpa file `.env`, aplikasi berjalan dalam mode demo:

- santri mana pun: email valid dan kata sandi minimal 6 karakter
- admin: `admin@tamyiz.test`

Mode demo menyimpan progres hanya di perangkat. Jangan dipakai sebagai produksi.

Panduan Supabase lokal dan image web ada di [DOCKER.md](DOCKER.md).

## Menghubungkan Supabase

1. Buat project gratis di Supabase.
2. Jalankan `supabase/migrations/20261026120000_init.sql` di SQL Editor.
3. Salin URL dan anon key ke `.env` (lihat `.env.example`), lalu mulai ulang Expo.
4. Daftarkan redirect Google: `tamyizku://auth-callback` dan URL web Anda. Aktifkan provider Google.
5. Jadikan akun sendiri admin:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

Audio disimpan di bucket privat `lesson-audio`. Path untuk modul gratis diawali `free/`. Aplikasi meminta signed URL 5 menit; file tidak ikut di dalam bundle.

## Pembayaran Rp10.000

```bash
supabase functions deploy create-payment
supabase functions deploy payment-webhook --no-verify-jwt
supabase secrets set PAYMENT_GATEWAY=midtrans MIDTRANS_SERVER_KEY=... MIDTRANS_IS_PRODUCTION=false
```

Webhook Midtrans: `https://YOUR_PROJECT.supabase.co/functions/v1/payment-webhook`. Untuk Xendit, set `PAYMENT_GATEWAY=xendit`, `XENDIT_SECRET_KEY`, dan `XENDIT_CALLBACK_TOKEN`.

Pembelian Google Play dan App Store belum dihubungkan karena membutuhkan akun toko. Di ponsel, tombol bayar membuka halaman QRIS yang sama.

## Struktur

```text
src/app                 layar Expo Router
src/components          kartu kata, kuis, pelindung layar
src/lib                 Supabase, mode demo, pembayaran
supabase/migrations     skema, RLS, contoh modul
supabase/functions      buat pembayaran dan webhook
```

Modul `order_index = 1` bisa dibaca tanpa langganan. Kata, kuis, dan audio modul lain ditolak oleh Row Level Security.
