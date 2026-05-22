alter table public.categories add column if not exists emoji text not null default '';

notify pgrst, 'reload schema';
