-- ============================================================================
-- Business logic: role helpers, product/image guards, audit triggers,
-- reservation creation (RPC), reservation status machine, admin RPCs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can read profiles without recursion)
-- ---------------------------------------------------------------------------
create or replace function app.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function app.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_role() = any (roles), false)
$$;

revoke all on function app.current_role() from public;
revoke all on function app.has_role(text[]) from public;
grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.current_role() to anon, authenticated, service_role;
grant execute on function app.has_role(text[]) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- products: search text, ownership stamps, publish guard, editor restrictions
-- ---------------------------------------------------------------------------
create or replace function app.products_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat text;
  v_sub text;
  v_role text := app.current_role();
begin
  -- searchable text (same normalisation as the public Arabic search)
  select c.name into v_cat from public.categories c where c.id = new.category_id;
  select s.name into v_sub from public.subcategories s where s.id = new.subcategory_id;
  new.search_text := public.normalize_arabic(concat_ws(' ', new.name, new.description, new.size_label, v_cat, v_sub));

  -- subcategory must belong to the chosen category
  if new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then
    raise exception 'subcategory_mismatch' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);

  -- Editors may create and edit content but cannot publish, archive or delete
  if v_role = 'editor' then
    if new.status in ('published', 'archived')
       and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      raise exception 'forbidden_status_for_role' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at then
      raise exception 'forbidden_status_for_role' using errcode = '42501';
    end if;
  end if;

  -- A product can only go live with a name, a category and at least one image
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if tg_op = 'INSERT' or not exists (select 1 from public.product_images i where i.product_id = new.id) then
      raise exception 'cannot_publish_without_images' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
create trigger products_before_write before insert or update on public.products
  for each row execute function app.products_before_write();

-- images: first image becomes primary; never leave a published product without images
create or replace function app.product_images_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.product_images i where i.product_id = new.product_id and i.is_primary) then
    update public.product_images set is_primary = true where id = new.id;
  end if;
  return new;
end;
$$;
create trigger product_images_after_insert after insert on public.product_images
  for each row execute function app.product_images_after_insert();

create or replace function app.product_images_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_remaining int;
begin
  select p.status into v_status from public.products p where p.id = old.product_id;
  if v_status is null then
    return old;                                  -- product itself is being deleted (cascade)
  end if;
  select count(*) into v_remaining from public.product_images i where i.product_id = old.product_id and i.id <> old.id;
  if v_status = 'published' and v_remaining = 0 then
    raise exception 'last_image_of_published_product' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
create trigger product_images_before_delete before delete on public.product_images
  for each row execute function app.product_images_before_delete();

-- promote another image when the primary one is removed
create or replace function app.product_images_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_primary then
    update public.product_images set is_primary = true
    where id = (select i.id from public.product_images i where i.product_id = old.product_id order by i.sort_order, i.created_at limit 1);
  end if;
  return old;
end;
$$;
create trigger product_images_after_delete after delete on public.product_images
  for each row execute function app.product_images_after_delete();

-- ---------------------------------------------------------------------------
-- Image RPCs (single statements cannot swap a partial-unique "primary" safely)
-- ---------------------------------------------------------------------------
create or replace function public.set_primary_image(p_image_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_product uuid;
begin
  if not app.has_role(array['admin', 'manager', 'editor']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select product_id into v_product from public.product_images where id = p_image_id;
  if v_product is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.product_images set is_primary = false where product_id = v_product and is_primary;
  update public.product_images set is_primary = true where id = p_image_id;
end;
$$;

create or replace function public.reorder_product_images(p_product_id uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not app.has_role(array['admin', 'manager', 'editor']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- the list must be exactly the product's images (no foreign ids, no omissions)
  if (select count(*) from public.product_images where product_id = p_product_id) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) u(id) where not exists (
          select 1 from public.product_images i where i.id = u.id and i.product_id = p_product_id)) then
    raise exception 'invalid_image_list' using errcode = 'P0001';
  end if;
  update public.product_images i set sort_order = t.ord
  from unnest(p_ids) with ordinality as t(id, ord)
  where i.id = t.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Iraqi phone normalisation + reservation number
-- ---------------------------------------------------------------------------
create or replace function app.normalize_iraqi_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when x ~ '^07[0-9]{9}$' then x
    else null
  end
  from (
    select regexp_replace(
             regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[\s\-()]', '', 'g'),
             '^(\+|00)?964', '0') as x
  ) s
$$;

create or replace function app.next_reservation_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Baghdad')::date;
  v_n int;
begin
  insert into public.reservation_counters as c (day, last_number) values (v_day, 1)
  on conflict (day) do update set last_number = c.last_number + 1
  returning last_number into v_n;
  return 'AB-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- create_reservation – the ONLY way a customer creates a reservation.
-- All validation is repeated here (the browser is never trusted).
-- ---------------------------------------------------------------------------
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
    address, size, quantity, notes
  ) values (
    v_number, v_product.id, v_product.name, v_name, v_phone, p_governorate, v_district,
    nullif(btrim(coalesce(p_address, '')), ''), v_size, p_quantity, nullif(btrim(coalesce(p_notes, '')), '')
  ) returning * into v_row;

  return query select v_row.id, v_row.reservation_number, v_row.status, v_row.created_at;
end;
$$;
revoke all on function public.create_reservation(uuid, text, text, text, text, text, text, integer, text) from public;
grant execute on function public.create_reservation(uuid, text, text, text, text, text, text, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reservation status machine (server-side; the UI only offers valid moves)
-- ---------------------------------------------------------------------------
create or replace function app.reservation_transition_ok(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('pending', 'contacted'), ('pending', 'confirmed'), ('pending', 'cancelled'), ('pending', 'rejected'),
    ('contacted', 'confirmed'), ('contacted', 'cancelled'), ('contacted', 'rejected'),
    ('confirmed', 'completed'), ('confirmed', 'cancelled'),
    ('cancelled', 'pending'), ('rejected', 'pending')          -- re-open
  )
$$;

create or replace function app.reservations_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not app.reservation_transition_ok(old.status, new.status) then
      raise exception 'invalid_status_transition' using errcode = 'P0001',
        detail = old.status || ' -> ' || new.status;
    end if;
    new.status_changed_at := now();
    new.handled_by := (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger reservations_before_update before update on public.reservations
  for each row execute function app.reservations_before_update();

-- ---------------------------------------------------------------------------
-- Audit trail (who added / edited / hid / deleted a product, who changed a reservation)
-- ---------------------------------------------------------------------------
create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_entity uuid;
  v_meta   jsonb := '{}'::jsonb;
  v_diff   jsonb;
  v_old    jsonb;
  v_new    jsonb;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_entity := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      into v_diff
    from jsonb_each(v_new) n join jsonb_each(v_old) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'updated_by', 'search_text', 'status_changed_at', 'handled_by');
    if v_diff = '{}'::jsonb then return new; end if;   -- nothing meaningful changed
    v_meta := jsonb_build_object('changes', v_diff);
  end if;

  if tg_table_name = 'products' then
    if tg_op = 'INSERT' then v_action := 'product.create'; v_meta := jsonb_build_object('name', new.name, 'source', new.source);
    elsif tg_op = 'DELETE' then v_action := 'product.purge'; v_meta := jsonb_build_object('name', old.name);
    elsif old.deleted_at is null and new.deleted_at is not null then v_action := 'product.delete';
    elsif old.deleted_at is not null and new.deleted_at is null then v_action := 'product.restore';
    elsif new.status is distinct from old.status then
      v_action := case new.status when 'published' then 'product.publish' when 'hidden' then 'product.hide'
                                  when 'archived' then 'product.archive' else 'product.unpublish' end;
    else v_action := 'product.update'; end if;
    if tg_op <> 'INSERT' then v_meta := v_meta || jsonb_build_object('name', coalesce(v_new ->> 'name', v_old ->> 'name')); end if;
  elsif tg_table_name = 'reservations' then
    if tg_op = 'INSERT' then
      v_action := 'reservation.create';
      v_meta := jsonb_build_object('reservation_number', new.reservation_number, 'product', new.product_name_snapshot);
    elsif new.status is distinct from old.status then
      v_action := 'reservation.status';
      v_meta := v_meta || jsonb_build_object('reservation_number', new.reservation_number, 'from', old.status, 'to', new.status);
    else
      v_action := 'reservation.update';
      v_meta := v_meta || jsonb_build_object('reservation_number', new.reservation_number);
    end if;
  elsif tg_table_name = 'categories' then
    v_action := 'category.' || lower(tg_op);
    v_meta := v_meta || jsonb_build_object('name', coalesce(v_new ->> 'name', v_old ->> 'name'));
  elsif tg_table_name = 'subcategories' then
    v_action := 'subcategory.' || lower(tg_op);
    v_meta := v_meta || jsonb_build_object('name', coalesce(v_new ->> 'name', v_old ->> 'name'));
  elsif tg_table_name = 'product_images' then
    v_action := case tg_op when 'INSERT' then 'product_image.add' when 'DELETE' then 'product_image.remove' else 'product_image.update' end;
    if tg_op = 'UPDATE' and (v_new ->> 'is_primary') is not distinct from (v_old ->> 'is_primary')
       and (v_new ->> 'alt_text') is not distinct from (v_old ->> 'alt_text') then
      return new;                                             -- pure re-ordering is not audited
    end if;
    v_meta := v_meta || jsonb_build_object('image_id', v_entity, 'path', coalesce(v_new ->> 'storage_path', v_old ->> 'storage_path'));
    v_entity := coalesce((v_new ->> 'product_id')::uuid, (v_old ->> 'product_id')::uuid);
  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), v_action, tg_table_name, v_entity, v_meta);

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger products_audit      after insert or update or delete on public.products      for each row execute function app.audit_row();
create trigger reservations_audit  after insert or update           on public.reservations  for each row execute function app.audit_row();
create trigger categories_audit    after insert or update or delete on public.categories    for each row execute function app.audit_row();
create trigger subcategories_audit after insert or update or delete on public.subcategories for each row execute function app.audit_row();
create trigger product_images_audit after insert or update or delete on public.product_images for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
-- One round trip for the dashboard cards (SECURITY INVOKER → RLS decides what the caller may count)
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'products_total',        (select count(*) from public.products where deleted_at is null),
    'products_published',    (select count(*) from public.products where deleted_at is null and status = 'published'),
    'products_hidden',       (select count(*) from public.products where deleted_at is null and status = 'hidden'),
    'products_draft',        (select count(*) from public.products where deleted_at is null and status = 'draft'),
    'products_archived',     (select count(*) from public.products where deleted_at is null and status = 'archived'),
    'products_featured',     (select count(*) from public.products where deleted_at is null and status = 'published' and featured),
    'products_trashed',      (select count(*) from public.products where deleted_at is not null),
    'reservations_pending',  (select count(*) from public.reservations where status = 'pending'),
    'reservations_active',   (select count(*) from public.reservations where status in ('contacted', 'confirmed')),
    'reservations_completed',(select count(*) from public.reservations where status = 'completed')
  )
$$;

-- Owner-confirmed currency: turns imported (unverified) prices into displayable ones. Admin only.
create or replace function public.confirm_prices_currency(p_currency text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not app.has_role(array['admin']) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_currency not in ('IQD', 'USD') then raise exception 'invalid_currency' using errcode = 'P0001'; end if;
  update public.products set currency = p_currency, price_verified = true
  where price is not null and price_verified = false and deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
