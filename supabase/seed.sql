insert into plans (id, name, monthly_price, max_products, max_users, allow_reports, allow_printing, allow_coupons, is_active) values
('plan_start', 'Start', 49.90, 30, 3, false, false, false, true),
('plan_pro', 'Pro', 79.90, 120, 8, true, true, true, true),
('plan_premium', 'Premium', 129.90, 999, 30, true, true, true, true)
on conflict (id) do update set
name = excluded.name,
monthly_price = excluded.monthly_price,
max_products = excluded.max_products,
max_users = excluded.max_users,
allow_reports = excluded.allow_reports,
allow_printing = excluded.allow_printing,
allow_coupons = excluded.allow_coupons,
is_active = excluded.is_active;

insert into companies (id, name, slug, logo_url, whatsapp, address, hero_image, primary_color, minimum_order, estimated_delivery_time, is_open, delivery_enabled, pickup_enabled, status, plan, is_registration_enabled, plan_id, subscription_status, monthly_price, due_day, next_due_date, last_payment_date, payment_notes, footer_message, opening_hours, created_at) values
('cmp_dogexpress', 'DogExpress POA', 'dogexpress', '', '5551999990000', 'Av. Cristovao Colombo, 820 - Porto Alegre', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80', '#116a4b', 25.00, '35-45 min', true, true, true, 'active', 'Pro', true, 'plan_pro', 'active', 79.90, 10, '2026-05-10', '2026-04-10', 'Pagamento em dia.', 'produzido por Startt Facilities', 'Aberto hoje, 10:30 as 22:30', '2026-01-10T10:00:00.000Z'),
('cmp_pizzariajoao', 'Pizzaria do Joao', 'pizzariadojoao', '', '5551988880000', 'Rua dos Andradas, 455 - Porto Alegre', 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=1600&q=80', '#b91c1c', 45.00, '45-60 min', true, true, true, 'trial', 'Start', true, 'plan_start', 'trialing', 49.90, 15, '2026-05-15', '2026-04-15', 'Periodo de teste.', 'produzido por Startt Facilities', 'Aberto hoje, 18:00 as 23:30', '2026-02-02T10:00:00.000Z'),
('cmp_burguerpaulo', 'Burguer do Paulo', 'burguerdopaulo', '', '5551977770000', 'Rua Padre Chagas, 120 - Porto Alegre', 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=1600&q=80', '#7c2d12', 30.00, '30-40 min', false, true, false, 'active', 'Pro', true, 'plan_pro', 'active', 79.90, 20, '2026-05-20', '2026-04-20', 'Pagamento em dia.', 'produzido por Startt Facilities', 'Fechado agora, abre as 18:00', '2026-03-12T10:00:00.000Z')
on conflict (id) do update set
name = excluded.name,
slug = excluded.slug,
whatsapp = excluded.whatsapp,
address = excluded.address,
hero_image = excluded.hero_image,
primary_color = excluded.primary_color,
minimum_order = excluded.minimum_order,
estimated_delivery_time = excluded.estimated_delivery_time,
is_open = excluded.is_open,
delivery_enabled = excluded.delivery_enabled,
pickup_enabled = excluded.pickup_enabled,
status = excluded.status,
plan = excluded.plan,
is_registration_enabled = excluded.is_registration_enabled,
plan_id = excluded.plan_id,
subscription_status = excluded.subscription_status,
monthly_price = excluded.monthly_price,
due_day = excluded.due_day,
next_due_date = excluded.next_due_date,
last_payment_date = excluded.last_payment_date,
payment_notes = excluded.payment_notes,
footer_message = excluded.footer_message,
opening_hours = excluded.opening_hours;

insert into master_users (id, name, email, password, role) values
('mst_1', 'Admin Master', 'master@startt.com', '123456', 'master')
on conflict (id) do update set name = excluded.name, email = excluded.email, password = excluded.password, role = excluded.role;

insert into users (id, company_id, name, email, password, role, is_active, created_at) values
('usr_dog_owner', 'cmp_dogexpress', 'Marina Alves', 'admin@dogexpress.com', '123456', 'dono', true, '2026-04-26T12:00:00.000Z'),
('usr_dog_cash', 'cmp_dogexpress', 'Caixa Dog', 'caixa@dogexpress.com', '123456', 'caixa', true, '2026-04-26T12:00:00.000Z'),
('usr_piz_owner', 'cmp_pizzariajoao', 'Joao Pereira', 'admin@pizzariadojoao.com', '123456', 'dono', true, '2026-04-26T12:00:00.000Z'),
('usr_bur_owner', 'cmp_burguerpaulo', 'Paulo Mendes', 'admin@burguerdopaulo.com', '123456', 'dono', true, '2026-04-26T12:00:00.000Z')
on conflict (id) do update set name = excluded.name, email = excluded.email, password = excluded.password, role = excluded.role, is_active = excluded.is_active;

insert into categories (id, company_id, name, sort_order, active) values
('cat_dog_1', 'cmp_dogexpress', 'Dogs', 1, true),
('cat_dog_2', 'cmp_dogexpress', 'Combos', 2, true),
('cat_dog_3', 'cmp_dogexpress', 'Bebidas', 3, true),
('cat_piz_1', 'cmp_pizzariajoao', 'Pizzas', 1, true),
('cat_piz_2', 'cmp_pizzariajoao', 'Calzones', 2, true),
('cat_piz_3', 'cmp_pizzariajoao', 'Bebidas', 3, true),
('cat_bur_1', 'cmp_burguerpaulo', 'Hamburgueres', 1, true),
('cat_bur_2', 'cmp_burguerpaulo', 'Combos', 2, true)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, active = excluded.active;

insert into products (id, company_id, category_id, name, description, price, image, preparation_time, featured, active, badge) values
('prd_dog_1', 'cmp_dogexpress', 'cat_dog_1', 'Dog Startt Classico', 'Pao macio, salsicha premium, molho da casa, batata palha e milho.', 22.90, 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=900&q=80', 12, true, true, 'Mais pedido'),
('prd_dog_2', 'cmp_dogexpress', 'cat_dog_2', 'Combo Dog + Refri', 'Dog classico, refrigerante lata e embalagem lacrada para viagem.', 31.90, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=900&q=80', 15, false, true, 'Combo'),
('prd_dog_3', 'cmp_dogexpress', 'cat_dog_3', 'Refrigerante lata', 'Coca-Cola, Guarana ou Sprite. 350 ml.', 7.90, 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=900&q=80', 1, false, true, null),
('prd_piz_1', 'cmp_pizzariajoao', 'cat_piz_1', 'Pizza Margherita', 'Molho artesanal, mussarela, tomate, manjericao e azeite.', 59.90, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80', 30, true, true, 'Forno a lenha'),
('prd_piz_2', 'cmp_pizzariajoao', 'cat_piz_2', 'Calzone quatro queijos', 'Massa fina, parmesao, provolone, gorgonzola e mussarela.', 42.50, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80', 24, false, true, null),
('prd_bur_1', 'cmp_burguerpaulo', 'cat_bur_1', 'Smash Paulo', 'Dois smash burgers, cheddar, cebola caramelizada e molho especial.', 34.90, 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=900&q=80', 18, true, true, 'Assinatura'),
('prd_bur_2', 'cmp_burguerpaulo', 'cat_bur_2', 'Combo Smash', 'Smash Paulo, fritas rusticas e bebida lata.', 47.90, 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=900&q=80', 22, false, true, null)
on conflict (id) do update set name = excluded.name, description = excluded.description, price = excluded.price, image = excluded.image, preparation_time = excluded.preparation_time, featured = excluded.featured, active = excluded.active, badge = excluded.badge;

insert into customers (id, company_id, name, phone, address, total_spent, last_order_at, created_at) values
('cus_dog_1', 'cmp_dogexpress', 'Rafael Costa', '(51) 99999-1010', 'Centro', 206.50, '2026-04-26T12:00:00.000Z', '2026-04-26T12:00:00.000Z'),
('cus_dog_2', 'cmp_dogexpress', 'Marina Alves', '(51) 99999-2020', 'Moinhos', 151.70, '2026-04-25T12:00:00.000Z', '2026-04-25T12:00:00.000Z'),
('cus_piz_1', 'cmp_pizzariajoao', 'Clara Nunes', '(51) 98888-3030', 'Bom Fim', 73.80, '2026-04-26T12:00:00.000Z', '2026-04-26T12:00:00.000Z'),
('cus_bur_1', 'cmp_burguerpaulo', 'Lucas Vieira', '(51) 97777-4040', 'Auxiliadora', 61.80, '2026-04-01T12:00:00.000Z', '2026-04-01T12:00:00.000Z')
on conflict (id) do update set name = excluded.name, phone = excluded.phone, address = excluded.address, total_spent = excluded.total_spent, last_order_at = excluded.last_order_at;

insert into delivery_zones (id, company_id, neighborhood, fee, estimated_minutes, active) values
('zon_dog_1', 'cmp_dogexpress', 'Centro', 7.90, '35-45', true),
('zon_dog_2', 'cmp_dogexpress', 'Moinhos', 9.90, '45-55', true),
('zon_piz_1', 'cmp_pizzariajoao', 'Centro', 8.90, '40-50', true),
('zon_piz_2', 'cmp_pizzariajoao', 'Bom Fim', 10.90, '50-60', true),
('zon_bur_1', 'cmp_burguerpaulo', 'Moinhos', 6.90, '30-40', true)
on conflict (id) do update set neighborhood = excluded.neighborhood, fee = excluded.fee, estimated_minutes = excluded.estimated_minutes, active = excluded.active;

insert into coupons (id, company_id, code, type, value, minimum_order, usage_limit, used_count, expires_at, active) values
('cup_dog_1', 'cmp_dogexpress', 'DOG10', 'percentual', 10, 25, 100, 3, '2026-12-31', true),
('cup_piz_1', 'cmp_pizzariajoao', 'PIZZA15', 'percentual', 15, 45, 80, 5, '2026-12-31', true),
('cup_bur_1', 'cmp_burguerpaulo', 'PAULO5', 'fixo', 5, 30, 50, 1, '2026-12-31', true)
on conflict (id) do update set code = excluded.code, type = excluded.type, value = excluded.value, minimum_order = excluded.minimum_order, usage_limit = excluded.usage_limit, used_count = excluded.used_count, expires_at = excluded.expires_at, active = excluded.active;

insert into orders (id, company_id, customer_id, status, fulfillment, delivery_zone_id, subtotal, discount, delivery_fee, total, payment_method, created_at) values
('ord_dog_1', 'cmp_dogexpress', 'cus_dog_1', 'preparando', 'delivery', 'zon_dog_1', 54.80, 0, 7.90, 62.70, 'Pix', '2026-04-26T12:00:00.000Z'),
('ord_dog_2', 'cmp_dogexpress', 'cus_dog_2', 'saiu_para_entrega', 'delivery', 'zon_dog_2', 151.70, 10, 9.90, 151.60, 'Cartao', '2026-04-25T12:00:00.000Z'),
('ord_piz_1', 'cmp_pizzariajoao', 'cus_piz_1', 'novo', 'pickup', null, 73.80, 0, 0, 73.80, 'Pix', '2026-04-26T12:00:00.000Z'),
('ord_bur_1', 'cmp_burguerpaulo', 'cus_bur_1', 'concluido', 'delivery', 'zon_bur_1', 54.90, 0, 6.90, 61.80, 'Dinheiro', '2026-04-01T12:00:00.000Z')
on conflict (id) do update set status = excluded.status, subtotal = excluded.subtotal, discount = excluded.discount, delivery_fee = excluded.delivery_fee, total = excluded.total;

insert into order_items (id, company_id, order_id, product_id, name, quantity, unit_price, total) values
('oit_1', 'cmp_dogexpress', 'ord_dog_1', 'prd_dog_1', 'Dog Startt Classico', 2, 22.90, 45.80),
('oit_2', 'cmp_dogexpress', 'ord_dog_1', 'prd_dog_3', 'Refrigerante lata', 1, 7.90, 7.90),
('oit_3', 'cmp_pizzariajoao', 'ord_piz_1', 'prd_piz_1', 'Pizza Margherita', 1, 59.90, 59.90)
on conflict (id) do update set name = excluded.name, quantity = excluded.quantity, unit_price = excluded.unit_price, total = excluded.total;

insert into settings (id, company_id, critical_locked) values
('set_dog_1', 'cmp_dogexpress', false),
('set_piz_1', 'cmp_pizzariajoao', false),
('set_bur_1', 'cmp_burguerpaulo', false)
on conflict (id) do update set critical_locked = excluded.critical_locked;

insert into cash_sales (id, company_id, items, subtotal, discount, total, payment_method, created_by, created_at) values
('cash_dog_1', 'cmp_dogexpress', '[{"product_id":"prd_dog_1","name":"Dog Startt Classico","quantity":1,"unit_price":22.9,"total":22.9}]', 22.90, 0, 22.90, 'Dinheiro', 'usr_dog_cash', '2026-04-26T12:00:00.000Z')
on conflict (id) do update set items = excluded.items, subtotal = excluded.subtotal, discount = excluded.discount, total = excluded.total, payment_method = excluded.payment_method;

insert into print_settings (company_id, auto_print_orders, auto_print_cash_sales, printer_name, paper_width, copies, footer_text) values
('cmp_dogexpress', false, false, 'Balcao', '80mm', 1, 'Startt Delivery - produzido por Startt Facilities'),
('cmp_pizzariajoao', true, true, 'Cozinha', '80mm', 2, 'Obrigado pela preferencia'),
('cmp_burguerpaulo', true, false, 'Caixa', '58mm', 1, 'Volte sempre')
on conflict (company_id) do update set auto_print_orders = excluded.auto_print_orders, auto_print_cash_sales = excluded.auto_print_cash_sales, printer_name = excluded.printer_name, paper_width = excluded.paper_width, copies = excluded.copies, footer_text = excluded.footer_text;

insert into reports (id, company_id, name, type, created_at) values
('rep_dog_1', 'cmp_dogexpress', 'Resumo diario', 'all', '2026-04-26T12:00:00.000Z')
on conflict (id) do update set name = excluded.name, type = excluded.type;
