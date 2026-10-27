-- Kuis per surah: bank soal, riwayat nilai, dan buka surah berikutnya pada nilai >= 80.

create table if not exists public.surah_quizzes (
  id uuid primary key default gen_random_uuid(),
  surah_number integer not null check (surah_number between 1 and 114),
  ayah_number integer not null check (ayah_number > 0),
  skill_level integer not null check (skill_level between 1 and 4),
  formula_key text,
  prompt text not null,
  highlighted_word text not null,
  verse_words jsonb not null,
  options jsonb not null,
  option_rationales jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text not null,
  audio_url text,
  order_index integer not null check (order_index > 0),
  created_at timestamptz not null default now(),
  unique (surah_number, order_index),
  constraint surah_quizzes_formula_check check (
    (skill_level = 4 and formula_key is not null) or skill_level <> 4
  )
);

create table if not exists public.user_surah_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  surah_number integer not null check (surah_number between 1 and 114),
  score integer not null check (score between 0 and 100),
  time_spent integer not null default 0 check (time_spent >= 0),
  completed_at timestamptz not null default now()
);

create index if not exists surah_quizzes_surah_idx on public.surah_quizzes (surah_number, order_index);
create index if not exists user_surah_progress_user_idx on public.user_surah_progress (user_id, surah_number, score desc);

alter table public.surah_quizzes enable row level security;
alter table public.user_surah_progress enable row level security;

drop policy if exists surah_quizzes_select on public.surah_quizzes;
create policy surah_quizzes_select on public.surah_quizzes
  for select to authenticated
  using (true);

drop policy if exists surah_quizzes_write on public.surah_quizzes;
create policy surah_quizzes_write on public.surah_quizzes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists user_surah_progress_select on public.user_surah_progress;
create policy user_surah_progress_select on public.user_surah_progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.surah_quizzes to authenticated;
grant select on public.user_surah_progress to authenticated;

create or replace function public.save_surah_quiz(
  p_surah integer,
  p_score integer,
  p_time_spent integer,
  p_correct integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  earned integer := greatest(coalesce(p_correct, 0), 0) * 10;
  stored_score integer := least(greatest(coalesce(p_score, 0), 0), 100);
  previous_best integer := 0;
  best integer;
  unlocked boolean := false;
begin
  if uid is null then
    raise exception 'Masuk terlebih dahulu';
  end if;
  if p_surah < 1 or p_surah > 114 then
    raise exception 'Surah tidak valid';
  end if;

  select coalesce(max(score), 0) into previous_best
  from public.user_surah_progress
  where user_id = uid and surah_number = p_surah;

  insert into public.user_surah_progress (user_id, surah_number, score, time_spent)
  values (uid, p_surah, stored_score, greatest(coalesce(p_time_spent, 0), 0));

  best := greatest(previous_best, stored_score);
  unlocked := p_surah < 114 and best >= 80 and previous_best < 80;

  update public.users set xp = xp + earned where id = uid;
  perform public.apply_learning_rewards(uid, stored_score);

  return jsonb_build_object(
    'best_score', best,
    'xp_earned', earned,
    'unlocked_next', unlocked,
    'next_surah', case when p_surah < 114 then p_surah + 1 else null end
  );
end;
$$;

revoke all on function public.save_surah_quiz(integer, integer, integer, integer) from public, anon;
grant execute on function public.save_surah_quiz(integer, integer, integer, integer) to authenticated;

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_progress where user_id = uid;
  delete from public.user_quiz_results where user_id = uid;
  delete from public.user_juz_scores where user_id = uid;
  delete from public.user_surah_progress where user_id = uid;
  delete from public.user_streaks where user_id = uid;
  delete from public.user_badges where user_id = uid;
  delete from public.pending_celebrations where user_id = uid;
  delete from public.payments where user_id = uid;
  delete from public.subscriptions where user_id = uid;
  delete from public.users where id = uid;
  delete from auth.users where id = uid;
end;
$$;
