-- Private bucket for generated and recorded Tamyiz audio.
-- Object keys use the free/ prefix for lesson 1 and premium/ for the rest.

insert into storage.buckets (id, name, public, file_size_limit)
values ('quran_audios', 'quran_audios', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists quran_audio_read on storage.objects;
create policy quran_audio_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quran_audios'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = 'free'
      or public.has_active_subscription(auth.uid())
    )
  );

drop policy if exists quran_audio_write on storage.objects;
create policy quran_audio_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quran_audios' and public.is_admin());

drop policy if exists quran_audio_update on storage.objects;
create policy quran_audio_update on storage.objects
  for update to authenticated
  using (bucket_id = 'quran_audios' and public.is_admin())
  with check (bucket_id = 'quran_audios' and public.is_admin());

drop policy if exists quran_audio_delete on storage.objects;
create policy quran_audio_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'quran_audios' and public.is_admin());
