-- Peran pengajar, profil yang dibaca dari users, dan izin ubah materi untuk tutor serta admin.
-- Nilai 'user' tetap berarti santri agar data yang sudah ada tidak perlu dipindahkan.

alter table public.users
  add column if not exists avatar_url text;

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('user', 'tutor', 'admin'));

do $$
begin
  create type public.app_role as enum ('student', 'tutor', 'admin');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('tutor', 'admin')
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
        or public.is_staff()
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
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'santri'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.users.full_name, excluded.full_name),
        avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url);

  insert into public.subscriptions (user_id, status)
  values (new.id, 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace view public.profiles
with (security_invoker = true) as
select
  id,
  full_name,
  avatar_url,
  case role
    when 'admin' then 'admin'::public.app_role
    when 'tutor' then 'tutor'::public.app_role
    else 'student'::public.app_role
  end as role,
  coalesce(xp, 0) as xp,
  created_at
from public.users;

grant select on public.profiles to authenticated;

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists words_write on public.quran_words;
create policy words_write on public.quran_words
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists quizzes_write on public.quizzes;
create policy quizzes_write on public.quizzes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists surah_quizzes_write on public.surah_quizzes;
create policy surah_quizzes_write on public.surah_quizzes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.protect_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;
    new.user_id := auth.uid();
    new.status := 'open';
    new.created_at := now();
  elsif auth.uid() = old.user_id and not public.is_admin() then
    new.user_id := old.user_id;
    new.status := old.status;
    new.created_at := old.created_at;
  elsif not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah status tiket';
  end if;
  return new;
end;
$$;

drop policy if exists tickets_update_own on public.support_tickets;
create policy tickets_update_own on public.support_tickets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text := case p_role
    when 'student' then 'user'
    when 'user' then 'user'
    when 'tutor' then 'tutor'
    when 'admin' then 'admin'
    else null
  end;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah peran';
  end if;
  if stored is null then
    raise exception 'Peran tidak dikenal';
  end if;
  if p_user = auth.uid() and stored <> 'admin' then
    raise exception 'Peran admin Anda tidak diubah dari layar ini';
  end if;
  update public.users set role = stored where id = p_user;
  if not found then
    raise exception 'Pengguna tidak ditemukan';
  end if;
end;
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
