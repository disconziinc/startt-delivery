-- Startt Assistente access control for the shared Startt Delivery users/companies model.
-- Safe to run more than once. It does not delete or reset existing data.

create extension if not exists pgcrypto;

create or replace function public.startt_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.companies (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  name text,
  email text not null,
  password text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists assistant_enabled boolean not null default false;
alter table public.companies add column if not exists assistant_status text not null default 'inactive';
alter table public.companies add column if not exists assistant_trial_until timestamptz;
alter table public.companies add column if not exists assistant_notes text not null default '';
alter table public.companies add column if not exists assistant_plan text not null default 'mvp';
alter table public.companies add column if not exists status text not null default 'active';
alter table public.companies add column if not exists updated_at timestamptz not null default now();
alter table public.companies add column if not exists created_at timestamptz not null default now();

alter table public.settings add column if not exists assistant_enabled boolean;
alter table public.settings add column if not exists assistant_status text;
alter table public.settings add column if not exists assistant_trial_until timestamptz;
alter table public.settings add column if not exists assistant_notes text;
alter table public.settings add column if not exists assistant_plan text;
alter table public.settings add column if not exists updated_at timestamptz not null default now();
alter table public.settings add column if not exists created_at timestamptz not null default now();

alter table public.users add column if not exists active boolean not null default true;
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists assistant_role text not null default 'operator';
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists company_id text;
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users add column if not exists created_at timestamptz not null default now();

update public.users
set active = false
where is_active = false and active is distinct from false;

update public.users
set is_active = false
where active = false and is_active is distinct from false;

update public.companies
set assistant_status = 'active'
where assistant_enabled = true
  and coalesce(nullif(assistant_status, ''), 'inactive') = 'inactive';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_assistant_status_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_assistant_status_check
      check (assistant_status in ('inactive', 'disabled', 'trial', 'active', 'blocked', 'overdue', 'canceled', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_assistant_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_assistant_role_check
      check (assistant_role in ('operator', 'admin', 'support'));
  end if;
end $$;

create index if not exists companies_slug_idx on public.companies(slug);
create index if not exists companies_assistant_status_idx on public.companies(assistant_enabled, assistant_status);
create index if not exists users_company_id_idx on public.users(company_id);
create index if not exists users_email_lower_idx on public.users(lower(email));
create index if not exists settings_company_id_idx on public.settings(company_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'companies_touch_updated_at'
      and tgrelid = 'public.companies'::regclass
  ) then
    create trigger companies_touch_updated_at
    before update on public.companies
    for each row execute function public.startt_touch_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'users_touch_updated_at'
      and tgrelid = 'public.users'::regclass
  ) then
    create trigger users_touch_updated_at
    before update on public.users
    for each row execute function public.startt_touch_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'settings_touch_updated_at'
      and tgrelid = 'public.settings'::regclass
  ) then
    create trigger settings_touch_updated_at
    before update on public.settings
    for each row execute function public.startt_touch_updated_at();
  end if;
end $$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'startt_companies_read'
  ) then
    create policy startt_companies_read
      on public.companies
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'startt_companies_write'
  ) then
    create policy startt_companies_write
      on public.companies
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'startt_users_read'
  ) then
    create policy startt_users_read
      on public.users
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'startt_users_write'
  ) then
    create policy startt_users_write
      on public.users
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'settings'
      and policyname = 'startt_settings_read'
  ) then
    create policy startt_settings_read
      on public.settings
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'settings'
      and policyname = 'startt_settings_write'
  ) then
    create policy startt_settings_write
      on public.settings
      for all
      using (true)
      with check (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.companies to anon, authenticated;
grant select, insert, update, delete on public.users to anon, authenticated;
grant select, insert, update, delete on public.settings to anon, authenticated;

notify pgrst, 'reload schema';
