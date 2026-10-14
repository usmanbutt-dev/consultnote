-- Avoid the legacy storage.objects.owner column shadowing the caller variable.
create or replace function public.can_upload_workspace_object(target_bucket text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  request_owner uuid := (select auth.uid());
  owner_maximum integer;
  bucket_maximum integer;
  used integer;
begin
  if request_owner is null or not public.account_is_active() then return false; end if;
  if target_bucket = 'consultation-audio' then
    owner_maximum := 5;
    bucket_maximum := 50;
  elsif target_bucket = 'doctor-avatars' then
    owner_maximum := 3;
    bucket_maximum := 100;
  else
    return false;
  end if;
  perform pg_advisory_xact_lock(731853);
  select count(*) into used from storage.objects as objects where objects.bucket_id = target_bucket;
  if used >= bucket_maximum then return false; end if;
  select count(*) into used from storage.objects as objects
    where objects.bucket_id = target_bucket and (storage.foldername(objects.name))[1] = request_owner::text;
  return used < owner_maximum;
end; $$;
