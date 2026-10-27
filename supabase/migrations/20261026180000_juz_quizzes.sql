-- Juz quizzes: question bank, attempt history, and high-score unlocks.

alter table public.users
  add column if not exists xp integer not null default 0;

alter table public.users drop constraint if exists users_xp_check;
alter table public.users
  add constraint users_xp_check check (xp >= 0);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  juz_number integer not null check (juz_number between 1 and 30),
  surah_number integer not null check (surah_number between 1 and 114),
  ayah_number integer not null check (ayah_number > 0),
  skill_level integer not null check (skill_level between 1 and 3),
  prompt text not null,
  highlighted_word text not null,
  verse_words jsonb not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null,
  audio_url text,
  order_index integer not null check (order_index > 0),
  created_at timestamptz not null default now(),
  unique (juz_number, order_index)
);

create table if not exists public.user_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  juz_number integer not null check (juz_number between 1 and 30),
  score integer not null check (score between 0 and 100),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  time_spent integer not null default 0 check (time_spent >= 0),
  hearts_left integer not null default 0 check (hearts_left between 0 and 5),
  completed_at timestamptz not null default now()
);

create table if not exists public.user_juz_scores (
  user_id uuid not null references public.users (id) on delete cascade,
  juz_number integer not null check (juz_number between 1 and 30),
  best_score integer not null check (best_score between 0 and 100),
  best_time_spent integer not null default 0 check (best_time_spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, juz_number)
);

create index if not exists quiz_questions_juz_idx on public.quiz_questions (juz_number, order_index);
create index if not exists user_quiz_results_user_idx on public.user_quiz_results (user_id, completed_at desc);

alter table public.quiz_questions enable row level security;
alter table public.user_quiz_results enable row level security;
alter table public.user_juz_scores enable row level security;

drop policy if exists quiz_questions_select on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (true);

drop policy if exists quiz_questions_write on public.quiz_questions;
create policy quiz_questions_write on public.quiz_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists user_quiz_results_select on public.user_quiz_results;
create policy user_quiz_results_select on public.user_quiz_results
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_juz_scores_select on public.user_juz_scores;
create policy user_juz_scores_select on public.user_juz_scores
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select on public.user_quiz_results to authenticated;
grant select on public.user_juz_scores to authenticated;

create or replace function public.save_juz_quiz(
  p_juz integer,
  p_score integer,
  p_time_spent integer,
  p_hearts_left integer,
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
  if p_juz < 1 or p_juz > 30 then
    raise exception 'Juz tidak valid';
  end if;

  insert into public.user_quiz_results (user_id, juz_number, score, xp_earned, time_spent, hearts_left)
  values (uid, p_juz, stored_score, earned, greatest(coalesce(p_time_spent, 0), 0), least(greatest(coalesce(p_hearts_left, 0), 0), 5));

  select best_score into previous_best
  from public.user_juz_scores
  where user_id = uid and juz_number = p_juz;

  insert into public.user_juz_scores (user_id, juz_number, best_score, best_time_spent)
  values (uid, p_juz, stored_score, greatest(coalesce(p_time_spent, 0), 0))
  on conflict (user_id, juz_number) do update
  set best_score = greatest(public.user_juz_scores.best_score, excluded.best_score),
      best_time_spent = case
        when excluded.best_score > public.user_juz_scores.best_score then excluded.best_time_spent
        else public.user_juz_scores.best_time_spent
      end,
      updated_at = now();

  select best_score into best
  from public.user_juz_scores
  where user_id = uid and juz_number = p_juz;

  update public.users set xp = xp + earned where id = uid;

  perform public.apply_learning_rewards(uid, stored_score);

  unlocked := p_juz < 30 and best >= 80 and coalesce(previous_best, 0) < 80;

  return jsonb_build_object(
    'best_score', best,
    'xp_earned', earned,
    'unlocked_next', unlocked,
    'next_juz', case when p_juz < 30 then p_juz + 1 else null end
  );
end;
$$;

revoke all on function public.save_juz_quiz(integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.save_juz_quiz(integer, integer, integer, integer, integer) to authenticated;

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
  delete from public.user_streaks where user_id = uid;
  delete from public.user_badges where user_id = uid;
  delete from public.pending_celebrations where user_id = uid;
  delete from public.payments where user_id = uid;
  delete from public.subscriptions where user_id = uid;
  delete from public.users where id = uid;
  delete from auth.users where id = uid;
end;
$$;
