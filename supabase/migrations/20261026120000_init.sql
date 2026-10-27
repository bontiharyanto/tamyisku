-- Tamyizku schema, RLS, and sample lesson.
-- Run in the Supabase SQL editor, or with the Supabase CLI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'expired')),
  start_date timestamptz,
  end_date timestamptz,
  payment_method text,
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level integer not null default 1 check (level > 0),
  category text,
  description text,
  order_index integer not null unique check (order_index > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quran_words (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  surah_number integer not null check (surah_number between 1 and 114),
  ayah_number integer not null check (ayah_number > 0),
  word_position integer not null check (word_position > 0),
  arabic_text text not null,
  transliteration text,
  translation text not null,
  tamyiz_category text not null check (
    tamyiz_category in ('Isim', 'Fi''il', 'Huruf', 'Tamyiz 1', 'Tamyiz 2', 'Tamyiz 3', 'Tamyiz 4')
  ),
  color_code text,
  -- Storage object path inside the private lesson-audio bucket, not a public URL.
  audio_url text,
  created_at timestamptz not null default now(),
  unique (surah_number, ayah_number, word_position)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question text not null,
  options jsonb not null default '["Isim","Fi''il","Huruf","Tamyiz"]'::jsonb,
  correct_answer text not null,
  score_points integer not null default 10 check (score_points > 0),
  arabic_text text,
  translation text,
  explanation text,
  audio_url text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  is_completed boolean not null default false,
  score integer not null default 0 check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  gateway text not null,
  external_id text not null,
  amount integer not null check (amount > 0),
  status text not null,
  payment_method text,
  created_at timestamptz not null default now(),
  unique (gateway, external_id)
);

create index if not exists quran_words_lesson_idx on public.quran_words (lesson_id, word_position);
create index if not exists quizzes_lesson_idx on public.quizzes (lesson_id, order_index);
create index if not exists user_progress_user_idx on public.user_progress (user_id, updated_at desc);
create index if not exists payments_created_idx on public.payments (created_at desc);

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_active_subscription(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = p_user
      and status = 'active'
      and end_date is not null
      and end_date > now()
  );
$$;

create or replace function public.can_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons
    where id = p_lesson_id
      and (
        order_index = 1
        or public.is_admin()
        or public.has_active_subscription(auth.uid())
      )
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'santri'), '@', 1)),
    'user'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status)
  values (new.id, 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah peran';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_role on public.users;
create trigger protect_user_role
  before update on public.users
  for each row execute function public.protect_user_role();

create or replace function public.enforce_progress_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    new.user_id := auth.uid();
  end if;

  if not public.can_access_lesson(new.lesson_id) then
    raise exception 'Langganan diperlukan untuk modul ini';
  end if;

  if tg_op = 'UPDATE' then
    new.score := greatest(old.score, least(new.score, 100));
  else
    new.score := least(greatest(new.score, 0), 100);
  end if;

  new.is_completed := new.score >= 70;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_progress_rules on public.user_progress;
create trigger enforce_progress_rules
  before insert or update on public.user_progress
  for each row execute function public.enforce_progress_rules();

create or replace function public.save_quiz_progress(p_lesson_id uuid, p_score integer)
returns public.user_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.user_progress;
  next_score integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Langganan diperlukan untuk modul ini';
  end if;

  select * into result
  from public.user_progress
  where user_id = auth.uid() and lesson_id = p_lesson_id;

  next_score := least(greatest(coalesce(p_score, 0), 0), 100);
  if found then
    next_score := greatest(result.score, next_score);
  end if;

  insert into public.user_progress (user_id, lesson_id, score, is_completed, updated_at)
  values (auth.uid(), p_lesson_id, next_score, next_score >= 70, now())
  on conflict (user_id, lesson_id) do update
    set score = excluded.score,
        is_completed = excluded.is_completed,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  return jsonb_build_object(
    'active_subscribers', (
      select count(*) from public.subscriptions
      where status = 'active' and end_date > now()
    ),
    'monthly_revenue', (
      select coalesce(sum(amount), 0) from public.payments
      where status in ('settlement', 'capture', 'paid', 'PAID')
        and created_at >= date_trunc('month', now())
    ),
    'daily_active_learners', (
      select count(distinct user_id) from public.user_progress
      where updated_at >= date_trunc('day', now())
    ),
    'total_users', (select count(*) from public.users)
  );
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_active_subscription(uuid) from public, anon;
revoke all on function public.can_access_lesson(uuid) from public, anon;
revoke all on function public.save_quiz_progress(uuid, integer) from public, anon;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_active_subscription(uuid) to authenticated;
grant execute on function public.can_access_lesson(uuid) to authenticated;
grant execute on function public.save_quiz_progress(uuid, integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.lessons enable row level security;
alter table public.quran_words enable row level security;
alter table public.quizzes enable row level security;
alter table public.user_progress enable row level security;
alter table public.payments enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (true);

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists words_select on public.quran_words;
create policy words_select on public.quran_words
  for select to authenticated
  using (public.can_access_lesson(lesson_id));

drop policy if exists words_write on public.quran_words;
create policy words_write on public.quran_words
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes
  for select to authenticated
  using (public.can_access_lesson(lesson_id));

drop policy if exists quizzes_write on public.quizzes;
create policy quizzes_write on public.quizzes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists progress_select on public.user_progress;
create policy progress_select on public.user_progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists progress_insert on public.user_progress;
create policy progress_insert on public.user_progress
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists progress_update on public.user_progress;
create policy progress_update on public.user_progress
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (public.is_admin());

drop policy if exists payments_insert_admin on public.payments;
create policy payments_insert_admin on public.payments
  for insert to authenticated
  with check (public.is_admin());

revoke all on public.users, public.subscriptions, public.lessons, public.quran_words, public.quizzes, public.user_progress, public.payments from anon;
grant select, update on public.users to authenticated;
grant select, update on public.subscriptions to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.quran_words to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update on public.user_progress to authenticated;
grant select, insert on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- Private audio bucket. Free lesson files live under the free/ prefix.
-- Signed URLs expire according to the client request (the app asks for 5 minutes).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-audio', 'lesson-audio', false, 10485760)
on conflict (id) do update set public = false;

drop policy if exists audio_read on storage.objects;
create policy audio_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lesson-audio'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = 'free'
      or public.has_active_subscription(auth.uid())
    )
  );

drop policy if exists audio_write on storage.objects;
create policy audio_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lesson-audio' and public.is_admin());

drop policy if exists audio_update on storage.objects;
create policy audio_update on storage.objects
  for update to authenticated
  using (bucket_id = 'lesson-audio' and public.is_admin())
  with check (bucket_id = 'lesson-audio' and public.is_admin());

drop policy if exists audio_delete on storage.objects;
create policy audio_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'lesson-audio' and public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.subscriptions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Sample content. Modul 1 is the free trial. Modul 2 requires a subscription.
-- Promote the first admin after signup:
--   update public.users set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------------

insert into public.lessons (id, title, level, category, description, order_index)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Modul 1 — Basmalah',
    1,
    'Pengenalan',
    'Uji coba gratis. Bedakan Huruf, Isim, dan kosa kata Tamyiz pada basmalah.',
    1
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Modul 2 — Alhamdulillah',
    2,
    'Isim & Huruf',
    'Modul premium. Latihan kata pada ayat kedua Al-Fatihah.',
    2
  )
on conflict (id) do nothing;

insert into public.quran_words (
  lesson_id, surah_number, ayah_number, word_position, arabic_text, transliteration, translation, tamyiz_category, color_code
)
values
  ('11111111-1111-4111-8111-111111111111', 1, 1, 1, 'بِسْمِ', 'bismi', 'Dengan nama', 'Huruf', '#388E3C'),
  ('11111111-1111-4111-8111-111111111111', 1, 1, 2, 'ٱللَّهِ', 'allahi', 'Allah', 'Isim', '#1976D2'),
  ('11111111-1111-4111-8111-111111111111', 1, 1, 3, 'ٱلرَّحْمَٰنِ', 'ar-rahmani', 'Yang Maha Pengasih', 'Tamyiz 1', '#FBC02D'),
  ('11111111-1111-4111-8111-111111111111', 1, 1, 4, 'ٱلرَّحِيمِ', 'ar-rahimi', 'Yang Maha Penyayang', 'Tamyiz 1', '#FBC02D'),
  ('22222222-2222-4222-8222-222222222222', 1, 2, 1, 'ٱلْحَمْدُ', 'al-hamdu', 'Segala puji', 'Isim', '#1976D2'),
  ('22222222-2222-4222-8222-222222222222', 1, 2, 2, 'لِلَّهِ', 'lillahi', 'bagi Allah', 'Huruf', '#388E3C'),
  ('22222222-2222-4222-8222-222222222222', 1, 2, 3, 'رَبِّ', 'rabbi', 'Tuhan', 'Tamyiz 2', '#FBC02D'),
  ('22222222-2222-4222-8222-222222222222', 1, 2, 4, 'ٱلْعَٰلَمِينَ', 'al-alamin', 'semesta alam', 'Isim', '#1976D2')
on conflict (surah_number, ayah_number, word_position) do nothing;

insert into public.quizzes (
  id, lesson_id, question, options, correct_answer, score_points, arabic_text, translation, explanation, order_index
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Termasuk kategori apa kata ini?',
    '["Isim","Fi''il","Huruf","Tamyiz"]'::jsonb,
    'Huruf',
    10,
    'بِسْمِ',
    'Dengan nama',
    'Kata ini termasuk Huruf (kata tugas) dengan kode warna hijau.',
    1
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'Termasuk kategori apa kata ini?',
    '["Isim","Fi''il","Huruf","Tamyiz"]'::jsonb,
    'Isim',
    10,
    'ٱللَّهِ',
    'Allah',
    'Kata ini termasuk Isim (kata benda) dengan kode warna biru.',
    2
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    '11111111-1111-4111-8111-111111111111',
    'Termasuk kategori apa kata ini?',
    '["Isim","Fi''il","Huruf","Tamyiz"]'::jsonb,
    'Tamyiz 1',
    10,
    'ٱلرَّحْمَٰنِ',
    'Yang Maha Pengasih',
    'Kata ini termasuk Tamyiz 1 (kosa kata berulang) dengan kode warna kuning.',
    3
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    '11111111-1111-4111-8111-111111111111',
    'Termasuk kategori apa kata ini?',
    '["Isim","Fi''il","Huruf","Tamyiz"]'::jsonb,
    'Fi''il',
    10,
    'خَلَقَ',
    'Dia menciptakan',
    'Kata ini termasuk Fi''il (kata kerja) dengan kode warna merah.',
    4
  )
on conflict (id) do nothing;
