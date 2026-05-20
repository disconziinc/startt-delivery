-- Startt Delivery - RPC de carregamento rapido por slug.
-- Executar no Supabase SQL Editor para reduzir varias chamadas REST para uma unica chamada.

create or replace function public.startt_company_route_bundle(p_slug text, p_include_admin boolean default false)
returns jsonb
language sql
stable
as $$
  with selected_company as (
    select * from companies where slug = p_slug limit 1
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
        'reports', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'company', (select to_jsonb(selected_company.*) from selected_company),
        'plans', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from plans) row_data), '[]'::jsonb),
        'users', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from users where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'categories', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from categories where company_id = (select id from selected_company) order by sort_order) row_data), '[]'::jsonb),
        'products', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from products where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'orders', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from orders where company_id = (select id from selected_company) order by created_at desc) row_data), '[]'::jsonb),
        'order_items', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from order_items where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'customers', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from customers where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'voucher_brands', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from voucher_brands where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'delivery_zones', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from delivery_zones where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'coupons', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from coupons where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'settings', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from settings where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'cash_sales', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from cash_sales where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end,
        'print_settings', coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from print_settings where company_id = (select id from selected_company)) row_data), '[]'::jsonb),
        'reports', case when p_include_admin then coalesce((select jsonb_agg(to_jsonb(row_data.*)) from (select * from reports where company_id = (select id from selected_company)) row_data), '[]'::jsonb) else '[]'::jsonb end
      )
  end;
$$;

grant execute on function public.startt_company_route_bundle(text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
