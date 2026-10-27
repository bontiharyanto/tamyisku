-- Explicit account deletion for the signed-in user.
-- Related rows are removed before the auth user so store review can see the cascade.

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
  delete from public.user_streaks where user_id = uid;
  delete from public.user_badges where user_id = uid;
  delete from public.pending_celebrations where user_id = uid;
  delete from public.payments where user_id = uid;
  delete from public.subscriptions where user_id = uid;
  delete from public.users where id = uid;
  delete from auth.users where id = uid;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.delete_user_account();
end;
$$;

revoke all on function public.delete_user_account() from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
