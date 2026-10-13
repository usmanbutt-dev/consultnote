-- Run once in the Supabase SQL editor. No real patient data in this demo.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_owner_updated on public.consultations(user_id, updated_at desc);
alter table public.consultations enable row level security;
create policy consultations_owner on public.consultations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.touch_consultation() returns trigger language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 millisecond');
  return new;
end; $$;
create trigger consultation_updated before update on public.consultations for each row execute function public.touch_consultation();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('consultation-audio', 'consultation-audio', false, 10485760, array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/webm','audio/ogg','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy audio_read on storage.objects for select to authenticated
using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy audio_upload on storage.objects for insert to authenticated
with check (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy audio_delete on storage.objects for delete to authenticated
using (bucket_id = 'consultation-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  operation text not null check(operation in ('transcribe','notes')),
  count integer not null default 0,
  primary key(user_id, day, operation)
);
alter table public.ai_usage enable row level security;
create or replace function public.reserve_ai_use(owner_id uuid, operation_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer; maximum integer;
begin
  if operation_name not in ('transcribe','notes') then return false; end if;
  -- Serialize reservations, including the whole-demo daily budget.
  perform pg_advisory_xact_lock(731852);
  select coalesce(sum(count),0) into used from public.ai_usage where day = current_date;
  if used >= 100 then return false; end if;
  maximum := case when operation_name = 'transcribe' then 10 else 20 end;
  insert into public.ai_usage(user_id, day, operation, count) values(owner_id, current_date, operation_name, 0) on conflict do nothing;
  update public.ai_usage set count = count + 1 where user_id = owner_id and day = current_date and operation = operation_name and count < maximum;
  return found;
end; $$;
revoke all on function public.reserve_ai_use(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_ai_use(uuid,text) to service_role;

create table if not exists public.transcription_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  audio_path text not null,
  language text not null check(language in ('auto','en','ur','en-ur')),
  duration_seconds double precision,
  provider_id text,
  status text not null default 'starting' check(status in ('starting','processing','finalizing','completed','failed','cancelled')),
  result jsonb,
  failure jsonb,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists transcription_jobs_owner on public.transcription_jobs(user_id, created_at desc);
alter table public.transcription_jobs enable row level security;
-- Only server code may attach provider IDs or mutate jobs.
create policy jobs_read on public.transcription_jobs for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.transcription_jobs from anon, authenticated;

create or replace function public.start_transcription(job_id uuid, owner_id uuid, object_path text, audio_language text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(owner_id::text));
  if exists(select 1 from public.transcription_jobs where user_id = owner_id and status in ('starting','processing','finalizing') and created_at > now() - interval '15 minutes') then return false; end if;
  if not public.reserve_ai_use(owner_id, 'transcribe') then return false; end if;
  insert into public.transcription_jobs(id,user_id,audio_path,language) values(job_id,owner_id,object_path,audio_language);
  return true;
end; $$;
revoke all on function public.start_transcription(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.start_transcription(uuid,uuid,text,text) to service_role;
