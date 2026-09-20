-- ============================================================================
-- Row Level Security + least-privilege grants
--
-- Roles (public.profiles.role):
--   admin    – everything
--   manager  – products, categories, reservations (no user/role management, no purge)
--   editor   – create/edit product content + images; cannot publish, archive, delete;
--              cannot see reservations
-- Visitors (anon) can only read ACTIVE categories and PUBLISHED, non-deleted products.
-- ============================================================================

alter table public.profiles             enable row level security;
alter table public.categories           enable row level security;
alter table public.subcategories        enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.reservations         enable row level security;
alter table public.reservation_counters enable row level security;
alter table public.audit_logs           enable row level security;

-- Grants first: start from nothing, then open exactly what is needed (RLS then narrows rows)
revoke all on all tables    in schema public from anon, authenticated;
-- PUBLIC holds EXECUTE on new functions by default – remove it, then grant explicitly below
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app    from public, anon, authenticated;
-- the two role helpers are needed inside RLS policies evaluated as anon/authenticated
grant execute on function app.current_role()       to anon, authenticated, service_role;
grant execute on function app.has_role(text[])     to anon, authenticated, service_role;
grant execute on all functions in schema public to service_role;

grant select on public.categories, public.subcategories, public.products, public.product_images to anon, authenticated;
grant insert, update, delete on public.categories, public.subcategories to authenticated;
grant insert, update, delete on public.products, public.product_images to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.reservations to authenticated;
grant update (status, admin_notes) on public.reservations to authenticated;   -- customer data is immutable
-- reservation_counters: no client access at all (only the SECURITY DEFINER numbering function)

-- Functions callable from the Data API
grant execute on function public.create_reservation(uuid, text, text, text, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.normalize_arabic(text)          to anon, authenticated;
grant execute on function public.iraqi_governorates()            to anon, authenticated;
grant execute on function public.set_primary_image(uuid)         to authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;
grant execute on function public.admin_dashboard_stats()         to authenticated;
grant execute on function public.confirm_prices_currency(text)   to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_read_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or app.has_role(array['admin']));

-- ---------------------------------------------------------------------------
-- categories / subcategories
-- ---------------------------------------------------------------------------
create policy categories_read on public.categories
  for select to anon, authenticated
  using (is_active or app.has_role(array['admin', 'manager', 'editor']));
create policy categories_insert on public.categories
  for insert to authenticated with check (app.has_role(array['admin', 'manager']));
create policy categories_update on public.categories
  for update to authenticated
  using (app.has_role(array['admin', 'manager'])) with check (app.has_role(array['admin', 'manager']));
create policy categories_delete on public.categories
  for delete to authenticated using (app.has_role(array['admin']));

create policy subcategories_read on public.subcategories
  for select to anon, authenticated
  using (is_active or app.has_role(array['admin', 'manager', 'editor']));
create policy subcategories_insert on public.subcategories
  for insert to authenticated with check (app.has_role(array['admin', 'manager']));
create policy subcategories_update on public.subcategories
  for update to authenticated
  using (app.has_role(array['admin', 'manager'])) with check (app.has_role(array['admin', 'manager']));
create policy subcategories_delete on public.subcategories
  for delete to authenticated using (app.has_role(array['admin']));

-- ---------------------------------------------------------------------------
-- products – hidden / draft / archived / trashed rows are invisible to visitors
-- ---------------------------------------------------------------------------
create policy products_read on public.products
  for select to anon, authenticated
  using ((status = 'published' and deleted_at is null) or app.has_role(array['admin', 'manager', 'editor']));
create policy products_insert on public.products
  for insert to authenticated with check (app.has_role(array['admin', 'manager', 'editor']));
create policy products_update on public.products
  for update to authenticated
  using (app.has_role(array['admin', 'manager', 'editor'])) with check (app.has_role(array['admin', 'manager', 'editor']));
create policy products_delete on public.products
  for delete to authenticated using (app.has_role(array['admin']));      -- permanent purge: admin only

-- ---------------------------------------------------------------------------
-- product_images – public only while the parent product is public
-- ---------------------------------------------------------------------------
create policy product_images_read on public.product_images
  for select to anon, authenticated
  using (
    app.has_role(array['admin', 'manager', 'editor'])
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published' and p.deleted_at is null
    )
  );
create policy product_images_insert on public.product_images
  for insert to authenticated with check (app.has_role(array['admin', 'manager', 'editor']));
create policy product_images_update on public.product_images
  for update to authenticated
  using (app.has_role(array['admin', 'manager', 'editor'])) with check (app.has_role(array['admin', 'manager', 'editor']));
create policy product_images_delete on public.product_images
  for delete to authenticated using (app.has_role(array['admin', 'manager', 'editor']));

-- ---------------------------------------------------------------------------
-- reservations – no public access whatsoever (creation goes through create_reservation())
-- ---------------------------------------------------------------------------
create policy reservations_read on public.reservations
  for select to authenticated using (app.has_role(array['admin', 'manager']));
create policy reservations_update on public.reservations
  for update to authenticated
  using (app.has_role(array['admin', 'manager'])) with check (app.has_role(array['admin', 'manager']));

-- ---------------------------------------------------------------------------
-- audit_logs – readable by admins only, writable by nobody (triggers only)
-- ---------------------------------------------------------------------------
create policy audit_logs_read on public.audit_logs
  for select to authenticated using (app.has_role(array['admin']));

-- reservation_counters: RLS enabled and NO policy → denied to every client role.
