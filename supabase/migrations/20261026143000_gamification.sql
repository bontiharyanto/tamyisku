-- Daily streak, badges, notification preferences, and account deletion.

alter table public.users
  add column if not exists expo_push_token text,
  add column if not exists notify_enabled boolean not null default true,
  add column if not exists notify_hour smallint not null default 20,
  add column if not exists notify_minute smallint not null default 0;

alter table public.users drop constraint if exists users_notify_hour_check;
alter table public.users
  add constraint users_notify_hour_check check (notify_hour between 0 and 23);

alter table public.users drop constraint if exists users_notify_minute_check;
alter table public.users
  add constraint users_notify_minute_check check (notify_minute between 0 and 59);

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date
);

create table if not exists public.badges (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  requirement text not null
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.pending_celebrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('streak', 'badge')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.badges (id, title, description, icon, requirement)
values
  ('streak_3_days', 'Semangat Pembelajar', 'Belajar Tamyiz tiga hari berturut-turut.', '🔥', 'Streak 3 hari'),
  ('streak_7_days', 'Istiqomah 7 Hari', 'Menjaga belajar selama tujuh hari berturut-turut.', '🌙', 'Streak 7 hari'),
  ('modules_5', 'Penjelajah Tamyiz', 'Menyelesaikan lima modul dengan nilai lulus.', '🧭', '5 modul selesai'),
  ('quiz_perfect', 'Nilai Sempurna', 'Mendapat skor 100 pada kuis untuk pertama kali.', '⭐', 'Skor kuis 100')
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    requirement = excluded.requirement;

create or replace function public.unlock_badge(p_user uuid, p_badge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.user_badges (user_id, badge_id)
  values (p_user, p_badge)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    insert into public.pending_celebrations (user_id, kind, payload)
    values (p_user, 'badge', jsonb_build_object('badge_id', p_badge));
  end if;
end;
$$;

create or replace function public.apply_learning_rewards(p_user uuid, p_score integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Asia/Jakarta', now()))::date;
  v_row public.user_streaks;
  v_current integer;
  v_longest integer;
  v_changed boolean := false;
  v_done integer;
begin
  if p_user is null then
    return;
  end if;

  select * into v_row from public.user_streaks where user_id = p_user for update;

  if not found then
    v_current := 1;
    v_longest := 1;
    v_changed := true;
    insert into public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    values (p_user, v_current, v_longest, v_today);
  elsif v_row.last_activity_date = v_today then
    v_current := v_row.current_streak;
    v_longest := v_row.longest_streak;
  elsif v_row.last_activity_date = v_today - 1 then
    v_current := v_row.current_streak + 1;
    v_longest := greatest(v_row.longest_streak, v_current);
    v_changed := true;
    update public.user_streaks
      set current_streak = v_current,
          longest_streak = v_longest,
          last_activity_date = v_today
      where user_id = p_user;
  else
    v_current := 1;
    v_longest := greatest(v_row.longest_streak, 1);
    v_changed := true;
    update public.user_streaks
      set current_streak = v_current,
          longest_streak = v_longest,
          last_activity_date = v_today
      where user_id = p_user;
  end if;

  if v_changed then
    insert into public.pending_celebrations (user_id, kind, payload)
    values (
      p_user,
      'streak',
      jsonb_build_object('current_streak', v_current, 'longest_streak', v_longest)
    );
  end if;

  if v_current >= 3 then
    perform public.unlock_badge(p_user, 'streak_3_days');
  end if;
  if v_current >= 7 then
    perform public.unlock_badge(p_user, 'streak_7_days');
  end if;

  select count(*) into v_done
  from public.user_progress
  where user_id = p_user and is_completed;

  if v_done >= 5 then
    perform public.unlock_badge(p_user, 'modules_5');
  end if;

  if coalesce(p_score, 0) >= 100 then
    perform public.unlock_badge(p_user, 'quiz_perfect');
  end if;
end;
$$;

create or replace function public.on_progress_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_learning_rewards(new.user_id, new.score);
  return new;
end;
$$;

drop trigger if exists rewards_after_progress on public.user_progress;
create trigger rewards_after_progress
  after insert or update on public.user_progress
  for each row execute function public.on_progress_rewards();

create or replace function public.take_learning_celebration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak public.user_streaks;
  v_increased boolean := false;
  v_badges jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1 from public.pending_celebrations
    where user_id = v_user and kind = 'streak'
  ) into v_increased;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'description', b.description,
    'icon', b.icon
  )), '[]'::jsonb)
  into v_badges
  from public.pending_celebrations p
  join public.badges b on b.id = p.payload ->> 'badge_id'
  where p.user_id = v_user and p.kind = 'badge';

  delete from public.pending_celebrations where user_id = v_user;

  select * into v_streak from public.user_streaks where user_id = v_user;

  return jsonb_build_object(
    'current_streak', coalesce(v_streak.current_streak, 0),
    'longest_streak', coalesce(v_streak.longest_streak, 0),
    'streak_increased', v_increased,
    'new_badges', coalesce(v_badges, '[]'::jsonb)
  );
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
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
      select count(*) * 10000 from public.payments
      where status in ('settlement', 'capture', 'paid', 'PAID')
        and created_at >= date_trunc('month', timezone('Asia/Jakarta', now()))
    ),
    'daily_active_learners', (
      select count(distinct user_id) from public.user_progress
      where updated_at >= date_trunc('day', timezone('Asia/Jakarta', now()))
    ),
    'completed_modules', (
      select count(*) from public.user_progress where is_completed
    ),
    'total_users', (select count(*) from public.users)
  );
end;
$$;

alter table public.user_streaks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.pending_celebrations enable row level security;

drop policy if exists streaks_select on public.user_streaks;
create policy streaks_select on public.user_streaks
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated
  using (true);

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.user_streaks, public.badges, public.user_badges, public.pending_celebrations from anon, authenticated;
grant select on public.user_streaks, public.badges, public.user_badges to authenticated;

revoke all on function public.unlock_badge(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_learning_rewards(uuid, integer) from public, anon, authenticated;
revoke all on function public.on_progress_rewards() from public, anon, authenticated;
revoke all on function public.take_learning_celebration() from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.take_learning_celebration() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.admin_overview() to authenticated;
