-- Bound direct Storage uploads, including requests that bypass the web app.
create or replace function public.can_upload_workspace_object(target_bucket text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  owner uuid := (select auth.uid());
  owner_maximum integer;
  bucket_maximum integer;
  used integer;
begin
  if owner is null or not public.account_is_active() then return false; end if;
  if target_bucket = 'consultation-audio' then
    owner_maximum := 5;
    bucket_maximum := 50;
  elsif target_bucket = 'doctor-avatars' then
    owner_maximum := 3;
    bucket_maximum := 100;
  else
    return false;
  end if;
  -- VOLATILE queries see committed inserts after waiting for the shared lock.
  perform pg_advisory_xact_lock(731853);
  select count(*) into used from storage.objects where bucket_id = target_bucket;
  if used >= bucket_maximum then return false; end if;
  select count(*) into used from storage.objects
    where bucket_id = target_bucket and (storage.foldername(name))[1] = owner::text;
  return used < owner_maximum;
end; $$;
revoke all on function public.can_upload_workspace_object(text) from public, anon;
grant execute on function public.can_upload_workspace_object(text) to authenticated;

drop policy if exists audio_upload on storage.objects;
create policy audio_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'consultation-audio'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(mp3|wav|webm|ogg)$')
    and public.can_upload_workspace_object(bucket_id)
  );

drop policy if exists avatar_upload on storage.objects;
create policy avatar_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'doctor-avatars'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(png|jpg|webp)$')
    and public.can_upload_workspace_object(bucket_id)
  );
