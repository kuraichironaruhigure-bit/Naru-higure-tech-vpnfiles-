-- NARU HIGURE FILE HUB — Supabase setup
-- Run this in Supabase Dashboard > SQL Editor. Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.vpn_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  uploader text,
  file_name text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  view_count bigint not null default 0,
  download_count bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.vpn_submissions add column if not exists uploader text;
alter table public.vpn_submissions add column if not exists file_name text;
alter table public.vpn_submissions add column if not exists file_size bigint default 0;
alter table public.vpn_submissions add column if not exists storage_path text;
alter table public.vpn_submissions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.vpn_submissions add column if not exists status text default 'pending';
alter table public.vpn_submissions add column if not exists view_count bigint default 0;
alter table public.vpn_submissions add column if not exists download_count bigint default 0;
alter table public.vpn_submissions add column if not exists created_at timestamptz default now();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Community member',
  about text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.vpn_submissions enable row level security;
alter table public.profiles enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists "Public can read approved files" on public.vpn_submissions;
create policy "Public can read approved files" on public.vpn_submissions
for select to anon, authenticated using (status = 'approved' or (auth.uid() = user_id) or ((auth.jwt()->'app_metadata'->>'role') = 'admin'));

drop policy if exists "Signed in users submit own files" on public.vpn_submissions;
create policy "Signed in users submit own files" on public.vpn_submissions
for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Admin reviews submissions" on public.vpn_submissions;
create policy "Admin reviews submissions" on public.vpn_submissions
for update to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Community posts are public" on public.community_posts;
create policy "Community posts are public" on public.community_posts for select to anon, authenticated using (true);
drop policy if exists "Signed in users post as themselves" on public.community_posts;
create policy "Signed in users post as themselves" on public.community_posts for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.record_file_view(file_id uuid)
returns void language sql security definer set search_path = public
as $$ update public.vpn_submissions set view_count = view_count + 1 where id = file_id and status = 'approved'; $$;
grant execute on function public.record_file_view(uuid) to anon, authenticated;

create or replace function public.record_file_download(file_id uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.vpn_submissions set download_count = download_count + 1 where id = file_id and status = 'approved';
end; $$;
grant execute on function public.record_file_download(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vpn-files','vpn-files',false,52428800)
on conflict (id) do update set public=false, file_size_limit=52428800;
insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-avatars','profile-avatars',true,5242880)
on conflict (id) do update set public=true, file_size_limit=5242880;

drop policy if exists "Users upload own VPN files" on storage.objects;
create policy "Users upload own VPN files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'vpn-files' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users read own or approved VPN files" on storage.objects;
create policy "Users read own or approved VPN files" on storage.objects
for select to authenticated using (
  bucket_id = 'vpn-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    exists (select 1 from public.vpn_submissions s where s.storage_path = name and s.status = 'approved')
  )
);
drop policy if exists "Owners delete own pending VPN files" on storage.objects;
create policy "Owners delete own pending VPN files" on storage.objects
for delete to authenticated using (bucket_id='vpn-files' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Anyone can view profile avatars" on storage.objects;
create policy "Anyone can view profile avatars" on storage.objects
for select to anon, authenticated using (bucket_id='profile-avatars');
drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars" on storage.objects
for insert to authenticated with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars" on storage.objects
for update to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- IMPORTANT: set the administrator role to YOUR Supabase user's app_metadata.role = admin
-- in Supabase Dashboard > Authentication > Users > select your account > Edit user/app metadata.
-- Never put the service_role key in index.html or app.js.
