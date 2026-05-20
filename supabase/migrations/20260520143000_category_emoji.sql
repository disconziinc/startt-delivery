-- Startt Delivery - emoji por categoria.
-- Seguro e idempotente. Nao apaga dados.

alter table categories add column if not exists emoji text not null default '';

update categories
set emoji = case
  when lower(name) like '%bebida%' then '🥤'
  when lower(name) like '%dog%' then '🌭'
  when lower(name) like '%hamb%' or lower(name) like '%burg%' then '🍔'
  when lower(name) like '%pizza%' then '🍕'
  when lower(name) like '%combo%' then '🍟'
  when lower(name) like '%sobremesa%' or lower(name) like '%doce%' then '🍰'
  else '🍽️'
end
where coalesce(emoji, '') = '';

notify pgrst, 'reload schema';
