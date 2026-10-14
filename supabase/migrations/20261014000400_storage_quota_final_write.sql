-- Storage's final write uses an elevated role after its RLS permission probe.
-- Enforce the same quotas in that write transaction, including concurrent uploads.
create function public.enforce_workspace_storage_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uuid_pattern constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  path_owner uuid;
  extensions text;
  owner_maximum integer;
  bucket_maximum integer;
  used integer;
begin
  if new.bucket_id = 'consultation-audio' then
    extensions := 'mp3|wav|webm|ogg';
    owner_maximum := 5;
    bucket_maximum := 50;
  elsif new.bucket_id = 'doctor-avatars' then
    extensions := 'png|jpg|webp';
    owner_maximum := 3;
    bucket_maximum := 100;
  else
    return new;
  end if;

  if new.name !~ ('^' || uuid_pattern || '/' || uuid_pattern || '\.(' || extensions || ')$') then
    raise exception 'Invalid upload path' using errcode = '42501';
  end if;
  path_owner := split_part(new.name, '/', 1)::uuid;

  perform pg_advisory_xact_lock(731853);
  -- Account removal must wait for an unfinished upload before cleaning up files.
  perform 1 from public.doctor_profiles as profiles
    where profiles.id = path_owner and profiles.deleting_at is null for share;
  if not found then
    raise exception 'Account is unavailable' using errcode = '42501';
  end if;

  select count(*) into used from storage.objects as objects where objects.bucket_id = new.bucket_id;
  if used >= bucket_maximum then
    raise exception 'Workspace upload limit reached' using errcode = '42501';
  end if;
  select count(*) into used from storage.objects as objects
    where objects.bucket_id = new.bucket_id and (storage.foldername(objects.name))[1] = path_owner::text;
  if used >= owner_maximum then
    raise exception 'Upload limit reached. Remove unused files before uploading again.' using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function public.enforce_workspace_storage_quota() from public, anon, authenticated;
create trigger workspace_storage_quota
before insert on storage.objects
for each row execute function public.enforce_workspace_storage_quota();
