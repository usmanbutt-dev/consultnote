-- Apply after the initial migration. Safe to run again. Configure/apply through the CLI later.
create table if not exists public.doctor_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 80),
  specialty text not null default '' check (length(specialty) <= 80),
  clinic text not null default '' check (length(clinic) <= 100),
  avatar_path text,
  deleting_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(png|jpg|webp)$'))
);
alter table public.doctor_profiles enable row level security;
revoke all on public.doctor_profiles from anon, authenticated;
grant select on public.doctor_profiles to authenticated;
grant update(full_name, specialty, clinic) on public.doctor_profiles to authenticated;
grant all on public.doctor_profiles to service_role;
drop policy if exists doctor_read on public.doctor_profiles;
create policy doctor_read on public.doctor_profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists doctor_update on public.doctor_profiles;
create policy doctor_update on public.doctor_profiles for update to authenticated
  using ((select auth.uid()) = id and deleting_at is null)
  with check ((select auth.uid()) = id and deleting_at is null);

create or replace function public.create_doctor_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.doctor_profiles(id, full_name)
  values(new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'), 80), ''), 'Doctor'))
  on conflict (id) do nothing;
  return new;
end; $$;
revoke all on function public.create_doctor_profile() from public, anon, authenticated;
drop trigger if exists create_doctor_profile on auth.users;
create trigger create_doctor_profile after insert on auth.users for each row execute function public.create_doctor_profile();
insert into public.doctor_profiles(id, full_name)
select id, coalesce(nullif(left(trim(raw_user_meta_data->>'full_name'), 80), ''), 'Doctor') from auth.users
on conflict (id) do nothing;

create or replace function public.touch_doctor_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 millisecond');
  return new;
end; $$;
drop trigger if exists doctor_profile_updated on public.doctor_profiles;
create trigger doctor_profile_updated before update on public.doctor_profiles for each row execute function public.touch_doctor_profile();

-- Deleted/inactive accounts must lose storage/database access even before JWT expiry.
create or replace function public.account_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.doctor_profiles where id = (select auth.uid()) and deleting_at is null);
$$;
revoke all on function public.account_is_active() from public, anon;
grant execute on function public.account_is_active() to authenticated, service_role;
drop policy if exists consultations_owner on public.consultations;
create policy consultations_owner on public.consultations for all to authenticated
  using ((select auth.uid()) = user_id and (select public.account_is_active()))
  with check ((select auth.uid()) = user_id and (select public.account_is_active()));
drop policy if exists jobs_read on public.transcription_jobs;
create policy jobs_read on public.transcription_jobs for select to authenticated
  using ((select auth.uid()) = user_id and (select public.account_is_active()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-avatars', 'doctor-avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists avatar_read on storage.objects;
create policy avatar_read on storage.objects for select to authenticated
  using (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.account_is_active()));
drop policy if exists avatar_upload on storage.objects;
create policy avatar_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'doctor-avatars' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(png|jpg|webp)$') and (select public.account_is_active()));
drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.account_is_active()));
drop policy if exists audio_read on storage.objects;
create policy audio_read on storage.objects for select to authenticated
  using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.account_is_active()));
drop policy if exists audio_upload on storage.objects;
create policy audio_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'consultation-audio' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(mp3|wav|webm|ogg)$') and (select public.account_is_active()));
drop policy if exists audio_delete on storage.objects;
create policy audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.account_is_active()));

create or replace function public.reserve_ai_use(owner_id uuid, operation_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer; maximum integer;
begin
  if operation_name not in ('transcribe','notes') then return false; end if;
  perform pg_advisory_xact_lock(731852);
  if not exists(select 1 from public.doctor_profiles where id = owner_id and deleting_at is null) then return false; end if;
  select coalesce(sum(count),0) into used from public.ai_usage where day = current_date;
  if used >= 100 then return false; end if;
  maximum := case when operation_name = 'transcribe' then 10 else 20 end;
  insert into public.ai_usage(user_id, day, operation, count) values(owner_id, current_date, operation_name, 0) on conflict do nothing;
  update public.ai_usage set count = count + 1 where user_id = owner_id and day = current_date and operation = operation_name and count < maximum;
  return found;
end; $$;
revoke all on function public.reserve_ai_use(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_ai_use(uuid,text) to service_role;
