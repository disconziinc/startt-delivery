alter table public.print_settings add column if not exists qz_tray_enabled boolean not null default false;
alter table public.print_settings add column if not exists qz_printer_name text not null default '';

alter table public.orders add column if not exists qz_printed_at timestamptz;
alter table public.orders add column if not exists qz_print_attempts integer not null default 0;
alter table public.orders add column if not exists qz_print_error text not null default '';

create index if not exists idx_orders_company_qz_printed on public.orders(company_id, qz_printed_at);
