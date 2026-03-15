create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  signup_method text not null check (signup_method in ('google', 'apple', 'email_magic_link')),
  company_name text,
  country_code text,
  preferred_locale text not null default 'en-GB',
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('analytics', 'marketing_emails', 'terms', 'privacy')),
  granted boolean not null,
  policy_version text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  capture_source text not null,
  created_at timestamptz not null default now(),
  unique (user_id, consent_type, policy_version)
);

create table if not exists public.user_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'email')),
  provider_subject text not null,
  linked_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'delete', 'rectification', 'restriction')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create index if not exists idx_user_consents_user_id on public.user_consents (user_id);
create index if not exists idx_privacy_requests_user_id on public.privacy_requests (user_id);

create or replace trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.user_provider_accounts enable row level security;
alter table public.privacy_requests enable row level security;

create policy "user_profiles_select_own"
on public.user_profiles
for select
using (auth.uid() = id);

create policy "user_profiles_insert_own"
on public.user_profiles
for insert
with check (auth.uid() = id);

create policy "user_profiles_update_own"
on public.user_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "user_consents_select_own"
on public.user_consents
for select
using (auth.uid() = user_id);

create policy "user_consents_insert_own"
on public.user_consents
for insert
with check (auth.uid() = user_id);

create policy "user_consents_update_own"
on public.user_consents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_provider_accounts_select_own"
on public.user_provider_accounts
for select
using (auth.uid() = user_id);

create policy "user_provider_accounts_insert_own"
on public.user_provider_accounts
for insert
with check (auth.uid() = user_id);

create policy "privacy_requests_select_own"
on public.privacy_requests
for select
using (auth.uid() = user_id);

create policy "privacy_requests_insert_own"
on public.privacy_requests
for insert
with check (auth.uid() = user_id);
