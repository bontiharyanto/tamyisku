-- Ringkasan kelas untuk pengajar dan admin: hanya agregat, tanpa baris santri.

create or replace function public.staff_class_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Hanya pengajar atau admin';
  end if;

  select jsonb_build_object(
    'modules', (select count(*)::int from public.lessons),
    'missing_audio', (
      select count(*)::int from public.quran_words
      where audio_url is null or btrim(audio_url) = ''
    ),
    'missing_color', (
      select count(*)::int from public.quran_words
      where color_code is null or btrim(color_code) = ''
    ),
    'active_students', (
      select count(distinct user_id)::int from public.user_progress
      where updated_at >= now() - interval '7 days'
    ),
    'average_score', (
      select coalesce(round(avg(score))::int, 0) from public.user_progress
    ),
    'review', coalesce((
      select jsonb_agg(to_jsonb(item))
      from (
        select
          id,
          arabic_text,
          translation,
          tamyiz_category,
          surah_number,
          ayah_number,
          word_position,
          lesson_id,
          case
            when audio_url is null or btrim(audio_url) = '' then 'audio'
            else 'warna'
          end as need
        from public.quran_words
        where audio_url is null or btrim(audio_url) = ''
           or color_code is null or btrim(color_code) = ''
        order by surah_number, ayah_number, word_position
        limit 8
      ) item
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.staff_class_snapshot() from public, anon;
grant execute on function public.staff_class_snapshot() to authenticated;
