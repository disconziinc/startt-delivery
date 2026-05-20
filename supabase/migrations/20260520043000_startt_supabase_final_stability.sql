-- Startt Delivery - SQL final de estabilidade Supabase.
-- Seguro para rodar no Supabase SQL Editor do projeto real da Startt.
-- Nao apaga dados existentes. Cria apenas o que faltar e ajusta policies/bucket.

create extension if not exists pgcrypto;

do $$ begin create type company_status as enum ('trial', 'active', 'blocked', 'canceled', 'disabled'); exception when duplicate_object then null; end $$;
alter type company_status add value if not exists 'disabled';

do $$ begin create type subscription_status as enum ('trialing', 'active', 'overdue', 'canceled'); exception when duplicate_object then null; end $$;
do $$ begin create type user_role as enum ('dono', 'gerente', 'caixa', 'atendente'); exception when duplicate_object then null; end $$;
do $$ begin create type coupon_type as enum ('percentual', 'fixo'); exception when duplicate_object then null; end $$;
do $$ begin create type order_status as enum ('novo', 'aceito', 'preparando', 'saiu_para_entrega', 'pronto_para_retirada', 'concluido', 'cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type fulfillment_type as enum ('delivery', 'pickup'); exception when duplicate_object then null; end $$;

create or replace function public.startt_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.jwt_is_master()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '') = 'master';
$$;

create or replace function public.jwt_company_id()
returns text
language sql stable
as $$
  select nullif(auth.jwt() ->> 'company_id', '');
$$;

create table if not exists plans (
  id text primary key,
  name text not null,
  monthly_price numeric(10,2) not null default 0,
  max_products integer not null default 0,
  max_users integer not null default 0,
  allow_reports boolean not null default false,
  allow_printing boolean not null default false,
  allow_coupons boolean not null default false,
  is_active boolean not null default true
);

create table if not exists companies (
  id text primary key,
  name text not null,
  slug text not null unique,
  logo_url text not null default '',
  banner_url text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  hero_image text not null default '',
  primary_color text not null default '#116a4b',
  minimum_order numeric(10,2) not null default 0,
  estimated_delivery_time text not null default '30-45 min',
  is_open boolean not null default true,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  status company_status not null default 'trial',
  plan text not null default 'Start',
  is_registration_enabled boolean not null default true,
  plan_id text,
  subscription_status subscription_status not null default 'trialing',
  monthly_price numeric(10,2) not null default 0,
  due_day integer not null default 10,
  next_due_date date,
  last_payment_date date,
  payment_notes text not null default '',
  footer_message text not null default 'produzido por Startt Facilities',
  opening_hours text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists master_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'master',
  is_active boolean not null default true
);

create table if not exists users (
  id text primary key,
  company_id text not null,
  name text not null,
  email text not null,
  password text not null,
  role user_role not null default 'dono',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id text primary key,
  company_id text not null,
  name text not null,
  emoji text not null default '',
  sort_order integer not null default 1,
  active boolean not null default true
);

create table if not exists products (
  id text primary key,
  company_id text not null,
  category_id text not null default '',
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  image text not null default '',
  ingredients text not null default '',
  preparation_time integer not null default 0,
  featured boolean not null default false,
  active boolean not null default true,
  badge text
);

create table if not exists customers (
  id text primary key,
  company_id text not null,
  name text not null,
  phone text not null,
  normalized_phone text not null default '',
  address text not null default '',
  updated_at timestamptz not null default now(),
  total_orders integer not null default 0,
  total_spent numeric(10,2) not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists voucher_brands (
  id text primary key,
  company_id text not null,
  name text not null,
  fee_percentage numeric(5,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_zones (
  id text primary key,
  company_id text not null,
  neighborhood text not null,
  fee numeric(10,2) not null default 0,
  estimated_minutes text not null default '',
  active boolean not null default true
);

create table if not exists coupons (
  id text primary key,
  company_id text not null,
  code text not null,
  type coupon_type not null default 'fixo',
  value numeric(10,2) not null default 0,
  minimum_order numeric(10,2) not null default 0,
  usage_limit integer not null default 0,
  used_count integer not null default 0,
  expires_at date,
  active boolean not null default true
);

create table if not exists orders (
  id text primary key,
  order_number integer,
  company_id text not null,
  customer_id text not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  normalized_phone text not null default '',
  customer_address text not null default '',
  status order_status not null default 'novo',
  fulfillment fulfillment_type not null default 'delivery',
  delivery_zone_id text,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null default '',
  payment_details text not null default '',
  cash_change_for numeric(10,2) default 0,
  calculated_change numeric(10,2) default 0,
  change_for numeric(10,2) default 0,
  change_amount numeric(10,2) default 0,
  card_type text,
  voucher_brand text,
  voucher_fee_percentage numeric(5,2),
  payment_status text,
  pix_txid text,
  pix_payload text,
  pix_qr_code text,
  customer_note text,
  archived boolean not null default false,
  archived_at timestamptz,
  removed_from_dashboard boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id text primary key,
  company_id text not null,
  order_id text not null,
  product_id text not null default '',
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0
);

create table if not exists settings (
  id text primary key,
  company_id text not null unique,
  critical_locked boolean not null default false,
  pix_enabled boolean not null default false,
  pix_key text not null default '',
  pix_receiver_name text not null default '',
  pix_city text not null default 'Porto Alegre',
  pix_description text not null default ''
);

create table if not exists cash_sales (
  id text primary key,
  company_id text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists print_settings (
  company_id text primary key,
  auto_print_orders boolean not null default false,
  auto_print_cash_sales boolean not null default false,
  printer_name text not null default '',
  paper_width text not null default '80mm',
  copies integer not null default 1,
  footer_text text not null default 'Startt Delivery - produzido por Startt Facilities'
);

create table if not exists reports (
  id text primary key,
  company_id text not null,
  name text not null,
  type text not null default 'all',
  created_at timestamptz not null default now()
);

alter table plans add column if not exists name text not null default '';
alter table plans add column if not exists monthly_price numeric(10,2) not null default 0;
alter table plans add column if not exists max_products integer not null default 0;
alter table plans add column if not exists max_users integer not null default 0;
alter table plans add column if not exists allow_reports boolean not null default false;
alter table plans add column if not exists allow_printing boolean not null default false;
alter table plans add column if not exists allow_coupons boolean not null default false;
alter table plans add column if not exists is_active boolean not null default true;

alter table companies add column if not exists slug text;
alter table companies add column if not exists logo_url text not null default '';
alter table companies add column if not exists banner_url text not null default '';
alter table companies add column if not exists whatsapp text not null default '';
alter table companies add column if not exists address text not null default '';
alter table companies add column if not exists hero_image text not null default '';
alter table companies add column if not exists primary_color text not null default '#116a4b';
alter table companies add column if not exists minimum_order numeric(10,2) not null default 0;
alter table companies add column if not exists estimated_delivery_time text not null default '30-45 min';
alter table companies add column if not exists is_open boolean not null default true;
alter table companies add column if not exists delivery_enabled boolean not null default true;
alter table companies add column if not exists pickup_enabled boolean not null default true;
alter table companies add column if not exists status company_status not null default 'trial';
alter table companies add column if not exists plan text not null default 'Start';
alter table companies add column if not exists is_registration_enabled boolean not null default true;
alter table companies add column if not exists plan_id text;
alter table companies add column if not exists subscription_status subscription_status not null default 'trialing';
alter table companies add column if not exists monthly_price numeric(10,2) not null default 0;
alter table companies add column if not exists due_day integer not null default 10;
alter table companies add column if not exists next_due_date date;
alter table companies add column if not exists last_payment_date date;
alter table companies add column if not exists payment_notes text not null default '';
alter table companies add column if not exists footer_message text not null default 'produzido por Startt Facilities';
alter table companies add column if not exists opening_hours text not null default '';
alter table companies add column if not exists created_at timestamptz not null default now();
alter table companies add column if not exists updated_at timestamptz not null default now();

alter table master_users add column if not exists name text not null default 'Admin Master';
alter table master_users add column if not exists email text not null default '';
alter table master_users add column if not exists password text not null default '';
alter table master_users add column if not exists role text not null default 'master';
alter table master_users add column if not exists is_active boolean not null default true;

alter table users add column if not exists company_id text not null default '';
alter table users add column if not exists name text not null default '';
alter table users add column if not exists email text not null default '';
alter table users add column if not exists password text not null default '';
alter table users add column if not exists role user_role not null default 'dono';
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists created_at timestamptz not null default now();

alter table categories add column if not exists company_id text not null default '';
alter table categories add column if not exists name text not null default '';
alter table categories add column if not exists emoji text not null default '';
alter table categories add column if not exists sort_order integer not null default 1;
alter table categories add column if not exists active boolean not null default true;

alter table products add column if not exists company_id text not null default '';
alter table products add column if not exists category_id text not null default '';
alter table products add column if not exists name text not null default '';
alter table products add column if not exists description text not null default '';
alter table products add column if not exists price numeric(10,2) not null default 0;
alter table products add column if not exists image text not null default '';
alter table products add column if not exists ingredients text not null default '';
alter table products add column if not exists preparation_time integer not null default 0;
alter table products add column if not exists featured boolean not null default false;
alter table products add column if not exists active boolean not null default true;
alter table products add column if not exists badge text;

alter table customers add column if not exists company_id text not null default '';
alter table customers add column if not exists name text not null default '';
alter table customers add column if not exists phone text not null default '';
alter table customers add column if not exists normalized_phone text not null default '';
alter table customers add column if not exists address text not null default '';
alter table customers add column if not exists updated_at timestamptz not null default now();
alter table customers add column if not exists total_orders integer not null default 0;
alter table customers add column if not exists total_spent numeric(10,2) not null default 0;
alter table customers add column if not exists last_order_at timestamptz;
alter table customers add column if not exists created_at timestamptz not null default now();

alter table voucher_brands add column if not exists company_id text not null default '';
alter table voucher_brands add column if not exists name text not null default '';
alter table voucher_brands add column if not exists fee_percentage numeric(5,2) not null default 0;
alter table voucher_brands add column if not exists active boolean not null default true;
alter table voucher_brands add column if not exists created_at timestamptz not null default now();
alter table voucher_brands add column if not exists updated_at timestamptz not null default now();

alter table delivery_zones add column if not exists company_id text not null default '';
alter table delivery_zones add column if not exists neighborhood text not null default '';
alter table delivery_zones add column if not exists fee numeric(10,2) not null default 0;
alter table delivery_zones add column if not exists estimated_minutes text not null default '';
alter table delivery_zones add column if not exists active boolean not null default true;

alter table coupons add column if not exists company_id text not null default '';
alter table coupons add column if not exists code text not null default '';
alter table coupons add column if not exists type coupon_type not null default 'fixo';
alter table coupons add column if not exists value numeric(10,2) not null default 0;
alter table coupons add column if not exists minimum_order numeric(10,2) not null default 0;
alter table coupons add column if not exists usage_limit integer not null default 0;
alter table coupons add column if not exists used_count integer not null default 0;
alter table coupons add column if not exists expires_at date;
alter table coupons add column if not exists active boolean not null default true;

alter table orders add column if not exists order_number integer;
alter table orders add column if not exists company_id text not null default '';
alter table orders add column if not exists customer_id text not null default '';
alter table orders add column if not exists customer_name text not null default '';
alter table orders add column if not exists customer_phone text not null default '';
alter table orders add column if not exists normalized_phone text not null default '';
alter table orders add column if not exists customer_address text not null default '';
alter table orders add column if not exists status order_status not null default 'novo';
alter table orders add column if not exists fulfillment fulfillment_type not null default 'delivery';
alter table orders add column if not exists delivery_zone_id text;
alter table orders add column if not exists subtotal numeric(10,2) not null default 0;
alter table orders add column if not exists discount numeric(10,2) not null default 0;
alter table orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table orders add column if not exists total numeric(10,2) not null default 0;
alter table orders add column if not exists payment_method text not null default '';
alter table orders add column if not exists payment_details text not null default '';
alter table orders add column if not exists cash_change_for numeric(10,2) default 0;
alter table orders add column if not exists calculated_change numeric(10,2) default 0;
alter table orders add column if not exists change_for numeric(10,2) default 0;
alter table orders add column if not exists change_amount numeric(10,2) default 0;
alter table orders add column if not exists card_type text;
alter table orders add column if not exists voucher_brand text;
alter table orders add column if not exists voucher_fee_percentage numeric(5,2);
alter table orders add column if not exists payment_status text;
alter table orders add column if not exists pix_txid text;
alter table orders add column if not exists pix_payload text;
alter table orders add column if not exists pix_qr_code text;
alter table orders add column if not exists customer_note text;
alter table orders add column if not exists archived boolean not null default false;
alter table orders add column if not exists archived_at timestamptz;
alter table orders add column if not exists removed_from_dashboard boolean not null default false;
alter table orders add column if not exists created_at timestamptz not null default now();

alter table order_items add column if not exists company_id text not null default '';
alter table order_items add column if not exists order_id text not null default '';
alter table order_items add column if not exists product_id text not null default '';
alter table order_items add column if not exists name text not null default '';
alter table order_items add column if not exists quantity integer not null default 1;
alter table order_items add column if not exists unit_price numeric(10,2) not null default 0;
alter table order_items add column if not exists total numeric(10,2) not null default 0;

alter table settings add column if not exists company_id text not null default '';
alter table settings add column if not exists critical_locked boolean not null default false;
alter table settings add column if not exists pix_enabled boolean not null default false;
alter table settings add column if not exists pix_key text not null default '';
alter table settings add column if not exists pix_receiver_name text not null default '';
alter table settings add column if not exists pix_city text not null default 'Porto Alegre';
alter table settings add column if not exists pix_description text not null default '';

alter table cash_sales add column if not exists company_id text not null default '';
alter table cash_sales add column if not exists items jsonb not null default '[]'::jsonb;
alter table cash_sales add column if not exists subtotal numeric(10,2) not null default 0;
alter table cash_sales add column if not exists discount numeric(10,2) not null default 0;
alter table cash_sales add column if not exists total numeric(10,2) not null default 0;
alter table cash_sales add column if not exists payment_method text not null default '';
alter table cash_sales add column if not exists created_by text not null default '';
alter table cash_sales add column if not exists created_at timestamptz not null default now();

alter table print_settings add column if not exists company_id text;
alter table print_settings add column if not exists auto_print_orders boolean not null default false;
alter table print_settings add column if not exists auto_print_cash_sales boolean not null default false;
alter table print_settings add column if not exists printer_name text not null default '';
alter table print_settings add column if not exists paper_width text not null default '80mm';
alter table print_settings add column if not exists copies integer not null default 1;
alter table print_settings add column if not exists footer_text text not null default 'Startt Delivery - produzido por Startt Facilities';

alter table reports add column if not exists company_id text not null default '';
alter table reports add column if not exists name text not null default '';
alter table reports add column if not exists type text not null default 'all';
alter table reports add column if not exists created_at timestamptz not null default now();

insert into master_users (id, name, email, password, role, is_active)
values ('mst_1', 'Admin Master', 'master@startt.com', 'Achieve123', 'master', true)
on conflict (id) do update set email = excluded.email, password = excluded.password, is_active = true;

create unique index if not exists companies_slug_idx on companies(slug);
create unique index if not exists users_company_email_idx on users(company_id, email);
create unique index if not exists settings_company_id_idx on settings(company_id);
create unique index if not exists coupons_company_code_idx on coupons(company_id, code);
create unique index if not exists orders_company_order_number_idx on orders(company_id, order_number) where order_number is not null;
create index if not exists customers_company_normalized_phone_lookup_idx on customers(company_id, normalized_phone);
create index if not exists customers_company_updated_at_idx on customers(company_id, updated_at desc);
create index if not exists orders_company_created_at_idx on orders(company_id, created_at desc);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists products_company_category_idx on products(company_id, category_id);
create index if not exists delivery_zones_company_neighborhood_idx on delivery_zones(company_id, neighborhood);

drop trigger if exists companies_touch_updated_at on companies;
create trigger companies_touch_updated_at before update on companies for each row execute function public.startt_touch_updated_at();
drop trigger if exists customers_touch_updated_at on customers;
create trigger customers_touch_updated_at before update on customers for each row execute function public.startt_touch_updated_at();
drop trigger if exists voucher_brands_touch_updated_at on voucher_brands;
create trigger voucher_brands_touch_updated_at before update on voucher_brands for each row execute function public.startt_touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('startt-public', 'startt-public', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table plans enable row level security;
alter table companies enable row level security;
alter table master_users enable row level security;
alter table users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table voucher_brands enable row level security;
alter table delivery_zones enable row level security;
alter table coupons enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table settings enable row level security;
alter table cash_sales enable row level security;
alter table print_settings enable row level security;
alter table reports enable row level security;

drop policy if exists "app sync plans" on plans;
create policy "app sync plans" on plans for all using (true) with check (true);
drop policy if exists "app sync companies" on companies;
create policy "app sync companies" on companies for all using (true) with check (true);
drop policy if exists "app sync master_users" on master_users;
create policy "app sync master_users" on master_users for all using (true) with check (true);
drop policy if exists "app sync users" on users;
create policy "app sync users" on users for all using (true) with check (true);
drop policy if exists "app sync categories" on categories;
create policy "app sync categories" on categories for all using (true) with check (true);
drop policy if exists "app sync products" on products;
create policy "app sync products" on products for all using (true) with check (true);
drop policy if exists "app sync customers" on customers;
create policy "app sync customers" on customers for all using (true) with check (true);
drop policy if exists "app sync voucher_brands" on voucher_brands;
create policy "app sync voucher_brands" on voucher_brands for all using (true) with check (true);
drop policy if exists "app sync delivery_zones" on delivery_zones;
create policy "app sync delivery_zones" on delivery_zones for all using (true) with check (true);
drop policy if exists "app sync coupons" on coupons;
create policy "app sync coupons" on coupons for all using (true) with check (true);
drop policy if exists "app sync orders" on orders;
create policy "app sync orders" on orders for all using (true) with check (true);
drop policy if exists "app sync order_items" on order_items;
create policy "app sync order_items" on order_items for all using (true) with check (true);
drop policy if exists "app sync settings" on settings;
create policy "app sync settings" on settings for all using (true) with check (true);
drop policy if exists "app sync cash_sales" on cash_sales;
create policy "app sync cash_sales" on cash_sales for all using (true) with check (true);
drop policy if exists "app sync print_settings" on print_settings;
create policy "app sync print_settings" on print_settings for all using (true) with check (true);
drop policy if exists "app sync reports" on reports;
create policy "app sync reports" on reports for all using (true) with check (true);

drop policy if exists "public read startt assets" on storage.objects;
create policy "public read startt assets" on storage.objects for select using (bucket_id = 'startt-public');
drop policy if exists "app upload startt assets" on storage.objects;
create policy "app upload startt assets" on storage.objects for insert with check (bucket_id = 'startt-public');
drop policy if exists "app update startt assets" on storage.objects;
create policy "app update startt assets" on storage.objects for update using (bucket_id = 'startt-public') with check (bucket_id = 'startt-public');
drop policy if exists "app delete startt assets" on storage.objects;
create policy "app delete startt assets" on storage.objects for delete using (bucket_id = 'startt-public');

notify pgrst, 'reload schema';
