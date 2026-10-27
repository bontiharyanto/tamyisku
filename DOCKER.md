# Docker lokal: Supabase dan web Tamyizku

Frontend proyek ini adalah Expo (Android, iOS, dan web), bukan Next.js. Image web mengekspor bundle Expo, lalu nginx menyajikannya. Supabase lokal dijalankan oleh CLI-nya sendiri di Docker Desktop, terpisah dari `docker-compose.yml`.

## Yang perlu terpasang

- Docker Desktop, dalam keadaan berjalan
- Node.js 22 atau lebih baru
- Supabase CLI, lewat `npx supabase` (tidak perlu instal global)

## 1. Supabase lokal

Folder `supabase/` sudah ada, beserta `config.toml` dan migrasi. Jangan menjalankan `supabase init` lagi di folder ini. Perintah itu hanya untuk proyek yang belum punya folder `supabase/`:

```bash
npx supabase init
```

Jalankan stack lokal (Postgres, Auth, Storage, Studio, dan Edge Functions):

```bash
npx supabase start
```

Perintah itu mengunduh image Docker pada pertama kali dan bisa memakan beberapa menit. Setelah siap, catat URL dan anon key:

```bash
npx supabase status
```

Alamat yang dipakai aplikasi:

| Layanan | URL |
| --- | --- |
| API | http://localhost:54321 |
| Database | localhost:54322 |
| Studio | http://localhost:54323 |
| Email uji (Inbucket) | http://localhost:54324 |

Migrasi di `supabase/migrations/` ikut berjalan saat `start` dan `db reset`. Contoh modul Basmalah ada di migrasi itu. Konfirmasi email dimatikan supaya daftar akun lokal langsung bisa masuk. Email yang tetap terkirim bisa dilihat di Inbucket.

Hentikan stack:

```bash
npx supabase stop
```

## 2. Frontend web

`docker-compose.yml` hanya menjalankan web. Browser membukanya di http://localhost:8080 dan memanggil Supabase di http://localhost:54321. URL itu diikat saat image dibangun, karena Expo menyisipkan `EXPO_PUBLIC_*` ke dalam bundle.

```bash
npx supabase start
docker compose up --build
```

Buka http://localhost:8080. Jika `supabase status` menampilkan anon key yang berbeda dari bawaan, bangun ulang dengan key itu:

```bash
EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-key-dari-status" docker compose up --build
```

`Dockerfile` punya dua tahap:

1. `node:22-bookworm-slim` menjalankan `npm ci` dan `npm run export:web`.
2. `nginx:alpine` menyajikan isi folder `dist`. Setiap rute dikembalikan ke `index.html` karena aplikasi web ini satu halaman.

## 3. Akun admin lokal

Setelah mendaftar lewat web:

```bash
npx supabase db query "update public.users set role = 'admin' where email = 'you@example.com';"
```

Lalu buka http://localhost:8080/admin.

## Pembayaran lokal

Webhook Midtrans/Xendit mengarah ke:

```text
http://localhost:54321/functions/v1/payment-webhook
```

Secret fungsi diatur untuk stack lokal, bukan di dalam image web:

```bash
npx supabase secrets set PAYMENT_GATEWAY=midtrans MIDTRANS_SERVER_KEY=SB-Mid-server-xxx MIDTRANS_IS_PRODUCTION=false
```
