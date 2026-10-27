-- Support tickets and private screenshot attachments.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in ('pembayaran', 'bug', 'materi', 'lainnya')),
  subject text not null check (char_length(subject) between 3 and 160),
  description text not null check (char_length(description) between 10 and 4000),
  attachment_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);

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
  elsif not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah tiket';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_support_ticket on public.support_tickets;
create trigger protect_support_ticket
  before insert or update on public.support_tickets
  for each row execute function public.protect_support_ticket();

alter table public.support_tickets enable row level security;

drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.support_tickets from anon, authenticated;
grant select, insert, update on public.support_tickets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('support_attachments', 'support_attachments', false, 5242880)
on conflict (id) do nothing;

drop policy if exists support_attachment_read on storage.objects;
create policy support_attachment_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support_attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists support_attachment_write on storage.objects;
create policy support_attachment_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support_attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
