-- Startt Delivery - Controle Interno / Estoque Leve
-- Idempotente: pode ser executado no Supabase SQL Editor sem apagar dados existentes.

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

create table if not exists public.inventory_items (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  category text not null default '',
  current_quantity numeric(12, 3) not null default 0,
  minimum_quantity numeric(12, 3) not null default 0,
  unit text not null default 'un',
  notes text not null default '',
  active boolean not null default true,
  purchase_flag boolean not null default false,
  purchase_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items add column if not exists company_id text;
alter table public.inventory_items add column if not exists name text not null default '';
alter table public.inventory_items add column if not exists category text not null default '';
alter table public.inventory_items add column if not exists current_quantity numeric(12, 3) not null default 0;
alter table public.inventory_items add column if not exists minimum_quantity numeric(12, 3) not null default 0;
alter table public.inventory_items add column if not exists unit text not null default 'un';
alter table public.inventory_items add column if not exists notes text not null default '';
alter table public.inventory_items add column if not exists active boolean not null default true;
alter table public.inventory_items add column if not exists purchase_flag boolean not null default false;
alter table public.inventory_items add column if not exists purchase_resolved boolean not null default false;
alter table public.inventory_items add column if not exists created_at timestamptz not null default now();
alter table public.inventory_items add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_company_id_fkey'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_unit_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_unit_check
      check (unit in ('un', 'kg', 'g', 'litro', 'ml', 'pacote', 'caixa'));
  end if;
end;
$$;

create index if not exists inventory_items_company_id_idx on public.inventory_items(company_id);
create index if not exists inventory_items_company_active_idx on public.inventory_items(company_id, active);
create index if not exists inventory_items_purchase_idx on public.inventory_items(company_id, purchase_flag, purchase_resolved);

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.startt_touch_updated_at();

alter table public.inventory_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'startt_inventory_items_all'
  ) then
    create policy startt_inventory_items_all
    on public.inventory_items
    for all
    using (true)
    with check (true);
  end if;
end;
$$;

grant select, insert, update, delete on public.inventory_items to anon, authenticated;

create or replace function public.startt_company_route_bundle(p_slug text, p_include_admin boolean default false)
returns jsonb
language sql
stable
as $$
  with selected_company as (
    select * from public.companies where slug = p_slug limit 1
  )
  select case
    when not exists (select 1 from selected_company) then
      jsonb_build_object(
        'company', null,
        'plans', '[]'::jsonb,
        'users', '[]'::jsonb,
        'categories', '[]'::jsonb,
        'products', '[]'::jsonb,
        'orders', '[]'::jsonb,
        'order_items', '[]'::jsonb,
        'customers', '[]'::jsonb,
        'voucher_brands', '[]'::jsonb,
        'delivery_zones', '[]'::jsonb,
        'coupons', '[]'::jsonb,
        'settings', '[]'::jsonb,
        'cash_sales', '[]'::jsonb,
        'print_settings', '[]'::jsonb,
        'reports', '[]'::jsonb,
        'inventory_items', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'company', (select to_jsonb(selected_company.*) from selected_company),
        'plans', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.plans) row_data), '[]'::jsonb),
        'users', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.users where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'categories', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.categories where company_id = (select id from selected_company) order by sort_order) row_data), '[]'::jsonb),
        'products', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.products where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'orders', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.orders where company_id = (select id from selected_company) order by created_at desc) row_data), '[]'::jsonb),
        'order_items', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.order_items where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'customers', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.customers where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'voucher_brands', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.voucher_brands where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'delivery_zones', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.delivery_zones where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'coupons', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.coupons where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'settings', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.settings where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'cash_sales', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.cash_sales where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'print_settings', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.print_settings where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'reports', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.reports where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'inventory_items', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from public.inventory_items where company_id = (select id from selected_company) order by updated_at desc) row_data), '[]'::jsonb) else '[]'::jsonb end
      )
  end;
$$;

grant execute on function public.startt_company_route_bundle(text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
