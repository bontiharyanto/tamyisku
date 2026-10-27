-- Penyelesaian modul secara transaksional: nilai 80 membuka modul berikutnya,
-- XP hanya naik saat rekor baru, dan streak memakai aturan harian yang sudah ada.

alter table public.users
  add column if not exists xp integer not null default 0;

create or replace function public.level_xp_gain(p_previous integer, p_score integer)
returns integer
language sql
immutable
as $$
  select case
    when p_score <= p_previous then 0
    when p_score >= 100 and p_previous < 80 then 50
    when p_score >= 100 then 20
    when p_score >= 80 and p_previous < 80 then 30
    else 0
  end;
$$;

revoke all on function public.level_xp_gain(integer, integer) from public, anon, authenticated;

create or replace function public.complete_lesson_level(
  p_user uuid,
  p_current_lesson_id uuid,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored integer := least(greatest(coalesce(p_score, 0), 0), 100);
  v_order integer;
  v_title text;
  v_prev uuid;
  v_prev_score integer := 0;
  v_previous_best integer := 0;
  v_best integer;
  v_gain integer := 0;
  v_passed boolean := false;
  v_next uuid;
  v_next_title text;
  v_surah integer;
  v_badge text;
  v_badge_title text;
  v_badge_json jsonb := null;
  v_new_badge boolean := false;
begin
  if uid is null then
    raise exception 'Masuk terlebih dahulu';
  end if;
  if p_user is not null and p_user <> uid and not public.is_admin() then
    raise exception 'Tidak boleh menyelesaikan modul akun lain';
  end if;
  uid := coalesce(p_user, uid);

  select order_index, title into v_order, v_title
  from public.lessons
  where id = p_current_lesson_id;
  if v_order is null then
    raise exception 'Modul tidak ditemukan';
  end if;
  if not public.can_access_lesson(p_current_lesson_id) then
    raise exception 'Langganan diperlukan untuk modul ini';
  end if;

  select id into v_prev
  from public.lessons
  where order_index < v_order
  order by order_index desc
  limit 1;

  if v_prev is not null and not public.is_admin() then
    select coalesce(max(score), 0) into v_prev_score
    from public.user_progress
    where user_id = uid and lesson_id = v_prev;
    if v_prev_score < 80 then
      raise exception 'Modul ini masih terkunci';
    end if;
  end if;

  select coalesce(max(score), 0) into v_previous_best
  from public.user_progress
  where user_id = uid and lesson_id = p_current_lesson_id;

  v_best := greatest(v_previous_best, stored);
  v_passed := v_best >= 80;
  v_gain := public.level_xp_gain(v_previous_best, stored);

  insert into public.user_progress (user_id, lesson_id, score, is_completed, updated_at)
  values (uid, p_current_lesson_id, v_best, v_passed, now())
  on conflict (user_id, lesson_id) do update
    set score = excluded.score,
        is_completed = excluded.is_completed,
        updated_at = now();

  if v_gain > 0 then
    update public.users set xp = coalesce(xp, 0) + v_gain where id = uid;
  end if;

  perform public.apply_learning_rewards(uid, stored);

  select min(surah_number) into v_surah
  from public.quran_words
  where lesson_id = p_current_lesson_id;

  if v_surah is not null then
    insert into public.user_surah_progress (user_id, surah_number, score, time_spent)
    values (uid, v_surah, stored, 0);
  end if;

  if stored >= 80 then
    v_badge := case when v_surah is not null then 'surah_pass_' || v_surah::text else 'lesson_pass_' || p_current_lesson_id::text end;
    v_badge_title := 'Lulus ' || v_title;
    insert into public.badges (id, title, description, icon, requirement)
    values (
      v_badge,
      v_badge_title,
      'Menyelesaikan ' || v_title || ' dengan nilai minimal 80.',
      '📗',
      'Nilai 80'
    )
    on conflict (id) do nothing;

    if not exists (
      select 1 from public.user_badges
      where user_id = uid and badge_id = v_badge
    ) then
      perform public.unlock_badge(uid, v_badge);
      v_new_badge := true;
      v_badge_json := jsonb_build_object(
        'id', v_badge,
        'title', v_badge_title,
        'description', 'Menyelesaikan ' || v_title || ' dengan nilai minimal 80.',
        'icon', '📗'
      );
    end if;
  end if;

  if v_passed then
    select id, title into v_next, v_next_title
    from public.lessons
    where order_index > v_order
    order by order_index
    limit 1;
  end if;

  return jsonb_build_object(
    'passed', stored >= 80,
    'score', stored,
    'best_score', v_best,
    'xp_earned', v_gain,
    'next_lesson_id', v_next,
    'next_lesson_title', v_next_title,
    'unlocked_badge', v_badge_json,
    'badge_unlocked', v_new_badge
  );
end;
$$;

revoke all on function public.complete_lesson_level(uuid, uuid, integer) from public, anon;
grant execute on function public.complete_lesson_level(uuid, uuid, integer) to authenticated;

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
  stored_score integer := least(greatest(coalesce(p_score, 0), 0), 100);
  previous_best integer := 0;
  best integer;
  earned integer;
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
  earned := public.level_xp_gain(previous_best, stored_score);

  if earned > 0 then
    update public.users set xp = coalesce(xp, 0) + earned where id = uid;
  end if;
  perform public.apply_learning_rewards(uid, stored_score);

  return jsonb_build_object(
    'best_score', best,
    'xp_earned', earned,
    'unlocked_next', unlocked,
    'next_surah', case when unlocked then p_surah + 1 else null end
  );
end;
$$;
