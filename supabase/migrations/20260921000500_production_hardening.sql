-- ============================================================================
-- Production hardening (additive; no data is deleted or rewritten)
--   1. Deleting images (rows AND files) is limited to admin/manager – editors can add and reorder, not delete
--   2. Reservations keep a price snapshot (only when the price was verified at the time of the request)
--   3. Slug history: renaming a product's URL never breaks the old link (old slug → 301 to the new one)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Image deletion: admin / manager only
-- ---------------------------------------------------------------------------
drop policy if exists product_images_delete on public.product_images;
create policy product_images_delete on public.product_images
  for delete to authenticated using (app.has_role(array['admin', 'manager']));

drop policy if exists store_media_staff_delete on storage.objects;
create policy store_media_privileged_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-media' and app.has_role(array['admin', 'manager']));

-- ---------------------------------------------------------------------------
-- 2. Reservation price snapshot
--    price_snapshot / currency_snapshot stay NULL unless the product had a verified price + currency.
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists price_snapshot    numeric(12, 2) check (price_snapshot is null or price_snapshot >= 0),
  add column if not exists currency_snapshot text check (currency_snapshot is null or currency_snapshot in ('IQD', 'USD'));

create or replace function public.create_reservation(
  p_product_id    uuid,
  p_customer_name text,
  p_phone         text,
  p_governorate   text,
  p_district      text,
  p_address       text default null,
  p_size          text default null,
  p_quantity      integer default 1,
  p_notes         text default null
)
returns table (id uuid, reservation_number text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_phone   text := app.normalize_iraqi_phone(p_phone);
  v_name    text := btrim(coalesce(p_customer_name, ''));
  v_district text := btrim(coalesce(p_district, ''));
  v_size    text := nullif(btrim(coalesce(p_size, '')), '');
  v_allowed text[];
  v_number  text;
  v_row     public.reservations%rowtype;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  if v_phone is null then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if p_governorate is null or not (p_governorate = any (public.iraqi_governorates())) then
    raise exception 'invalid_governorate' using errcode = 'P0001';
  end if;
  if char_length(v_district) < 2 or char_length(v_district) > 80 then raise exception 'invalid_district' using errcode = 'P0001'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  if p_address is not null and char_length(p_address) > 300 then raise exception 'invalid_address' using errcode = 'P0001'; end if;
  if p_notes is not null and char_length(p_notes) > 600 then raise exception 'invalid_notes' using errcode = 'P0001'; end if;

  select * into v_product from public.products p where p.id = p_product_id;
  if not found or v_product.status <> 'published' or v_product.deleted_at is not null then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  if v_product.available is false then
    raise exception 'product_unavailable' using errcode = 'P0001';
  end if;

  -- size: when the product lists discrete sizes the request must pick one of them
  v_allowed := v_product.sizes || v_product.numeric_sizes;
  if 'FREE' = any (v_product.sizes) then v_allowed := v_allowed || array['فري سايز']; end if;
  if v_size is not null then
    if char_length(v_size) > 40 then raise exception 'invalid_size' using errcode = 'P0001'; end if;
    if cardinality(v_allowed) > 0 and not (v_size = any (v_allowed)) then
      raise exception 'invalid_size' using errcode = 'P0001';
    end if;
  end if;

  -- abuse protection: per phone and global hourly limits
  if (select count(*) from public.reservations r where r.phone = v_phone and r.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.reservations r where r.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_number := app.next_reservation_number();
  insert into public.reservations as r (
    reservation_number, product_id, product_name_snapshot, customer_name, phone, governorate, district,
    address, size, quantity, notes, price_snapshot, currency_snapshot
  ) values (
    v_number, v_product.id, v_product.name, v_name, v_phone, p_governorate, v_district,
    nullif(btrim(coalesce(p_address, '')), ''), v_size, p_quantity, nullif(btrim(coalesce(p_notes, '')), ''),
    case when v_product.price_verified and v_product.currency is not null then v_product.price end,
    case when v_product.price_verified then v_product.currency end
  ) returning * into v_row;

  return query select v_row.id, v_row.reservation_number, v_row.status, v_row.created_at;
end;
$$;
revoke all on function public.create_reservation(uuid, text, text, text, text, text, text, integer, text) from public;
grant execute on function public.create_reservation(uuid, text, text, text, text, text, text, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Slug history
-- ---------------------------------------------------------------------------
create table if not exists public.product_slug_history (
  slug       text primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists product_slug_history_product on public.product_slug_history (product_id);

alter table public.product_slug_history enable row level security;      -- no policies: nobody reads it directly
revoke all on public.product_slug_history from anon, authenticated;

-- Remember the old slug whenever it changes ...
create or replace function app.remember_old_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.product_slug_history (slug, product_id) values (old.slug, old.id)
    on conflict (slug) do update set product_id = excluded.product_id;
  end if;
  return new;
end;
$$;
revoke all on function app.remember_old_slug() from public, anon, authenticated;
create trigger products_remember_slug after update of slug on public.products
  for each row execute function app.remember_old_slug();

-- ... and forget a history entry as soon as a product takes that slug for real.
create or replace function app.release_history_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.product_slug_history where slug = new.slug;
  return new;
end;
$$;
revoke all on function app.release_history_slug() from public, anon, authenticated;
create trigger products_release_slug before insert or update of slug on public.products
  for each row execute function app.release_history_slug();

-- Public lookup: an old slug → the CURRENT slug of a published product (nothing else is revealed).
create or replace function public.resolve_product_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug
  from public.product_slug_history h
  join public.products p on p.id = h.product_id
  where h.slug = p_slug and p.status = 'published' and p.deleted_at is null
  limit 1
$$;
revoke all on function public.resolve_product_slug(text) from public;
grant execute on function public.resolve_product_slug(text) to anon, authenticated, service_role;
