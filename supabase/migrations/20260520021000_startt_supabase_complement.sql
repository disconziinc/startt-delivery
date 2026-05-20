-- Startt Delivery - complemento seguro para Supabase real existente.
-- Pode ser executado no SQL Editor sem apagar dados.
-- Objetivo: garantir colunas, indexes, bucket de imagens e policies necessarias para persistencia multi-dispositivo.

create extension if not exists pgcrypto;

do $$ begin
  create type company_status as enum ('trial', 'active', 'blocked', 'canceled', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('trialing', 'active', 'overdue', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('dono', 'gerente', 'caixa', 'atendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type coupon_type as enum ('percentual', 'fixo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('novo', 'aceito', 'preparando', 'saiu_para_entrega', 'pronto_para_retirada', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fulfillment_type as enum ('delivery', 'pickup');
exception when duplicate_object then null; end $$;

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
  plan_id text references plans(id),
  subscription_status subscription_status not null default 'trialing',
  monthly_price numeric(10,2) not null default 0,
  due_day integer not null default 10,
  next_due_date date,
  last_payment_date date,
  payment_notes text not null default '',
  footer_message text not null default 'produzido por Startt Facilities',
  opening_hours text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
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
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  email text not null,
  password text not null,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create table if not exists categories (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  active boolean not null default true
);

create table if not exists products (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  category_id text references categories(id) on delete cascade,
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
  company_id text not null references companies(id) on delete cascade,
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
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  fee_percentage numeric(5,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_zones (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  neighborhood text not null,
  fee numeric(10,2) not null default 0,
  estimated_minutes text not null default '',
  active boolean not null default true
);

create table if not exists coupons (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  code text not null,
  type coupon_type not null,
  value numeric(10,2) not null default 0,
  minimum_order numeric(10,2) not null default 0,
  usage_limit integer not null default 0,
  used_count integer not null default 0,
  expires_at date,
  active boolean not null default true,
  unique (company_id, code)
);

create table if not exists orders (
  id text primary key,
  order_number integer,
  company_id text not null references companies(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  customer_name text not null default '',
  customer_phone text not null default '',
  normalized_phone text not null default '',
  customer_address text not null default '',
  status order_status not null default 'novo',
  fulfillment fulfillment_type not null,
  delivery_zone_id text references delivery_zones(id),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null,
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
  company_id text not null references companies(id) on delete cascade,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null,
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0
);

create table if not exists settings (
  id text primary key,
  company_id text not null references companies(id) on delete cascade unique,
  critical_locked boolean not null default false,
  pix_enabled boolean not null default false,
  pix_key text not null default '',
  pix_receiver_name text not null default '',
  pix_city text not null default 'Porto Alegre',
  pix_description text not null default ''
);

create table if not exists cash_sales (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists print_settings (
  company_id text primary key references companies(id) on delete cascade,
  auto_print_orders boolean not null default false,
  auto_print_cash_sales boolean not null default false,
  printer_name text not null default '',
  paper_width text not null default '80mm',
  copies integer not null default 1,
  footer_text text not null default 'Startt Delivery - produzido por Startt Facilities'
);

create table if not exists reports (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  type text not null default 'all',
  created_at timestamptz not null default now()
);

alter table companies add column if not exists updated_at timestamptz;
alter table customers add column if not exists normalized_phone text not null default '';
alter table customers add column if not exists updated_at timestamptz not null default now();
alter table customers add column if not exists total_orders integer not null default 0;
alter table customers add column if not exists total_spent numeric(10,2) not null default 0;
alter table customers add column if not exists last_order_at timestamptz;
alter table voucher_brands add column if not exists created_at timestamptz not null default now();
alter table voucher_brands add column if not exists updated_at timestamptz not null default now();
alter table orders add column if not exists order_number integer;
alter table orders add column if not exists customer_name text not null default '';
alter table orders add column if not exists customer_phone text not null default '';
alter table orders add column if not exists normalized_phone text not null default '';
alter table orders add column if not exists customer_address text not null default '';
alter table orders add column if not exists payment_details text not null default '';
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
alter table settings add column if not exists pix_enabled boolean not null default false;
alter table settings add column if not exists pix_key text not null default '';
alter table settings add column if not exists pix_receiver_name text not null default '';
alter table settings add column if not exists pix_city text not null default 'Porto Alegre';
alter table settings add column if not exists pix_description text not null default '';

create unique index if not exists customers_company_normalized_phone_idx on customers(company_id, normalized_phone) where normalized_phone <> '';
create unique index if not exists orders_company_order_number_idx on orders(company_id, order_number) where order_number is not null;
create index if not exists companies_slug_idx on companies(slug);
create index if not exists orders_company_created_at_idx on orders(company_id, created_at desc);
create index if not exists customers_company_updated_at_idx on customers(company_id, updated_at desc);
create index if not exists products_company_active_idx on products(company_id, active);
create index if not exists delivery_zones_company_active_idx on delivery_zones(company_id, active);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'startt-public',
  'startt-public',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
