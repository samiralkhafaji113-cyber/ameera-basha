-- ============================================================================
-- ROLLBACK for 20260921000500_production_hardening.sql   (NOT run automatically – copy into the SQL editor if ever needed)
-- Take a backup first: npm run prod:backup.   Order matters. Each block is independent and safe to run on its own.
-- ============================================================================

-- 1. Image deletion policies back to "any staff role" (editors could delete images again)
drop policy if exists product_images_delete on public.product_images;
create policy product_images_delete on public.product_images
  for delete to authenticated using (app.has_role(array['admin', 'manager', 'editor']));

drop policy if exists store_media_privileged_delete on storage.objects;
create policy store_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']));

-- 2. Slug history: remove the triggers, lookup function and table. Effect: renamed products' OLD urls return 404 again.
--    (No product data is touched.)
drop trigger if exists products_remember_slug on public.products;
drop trigger if exists products_release_slug on public.products;
drop function if exists public.resolve_product_slug(text);
drop function if exists app.remember_old_slug();
drop function if exists app.release_history_slug();
drop table if exists public.product_slug_history;

-- 3. create_reservation: restore the previous definition (without the price snapshot) by re-running the
--    `create or replace function public.create_reservation(...)` block of 20260921000200_logic.sql.
--    The two snapshot columns are LEFT IN PLACE on purpose: they are nullable and dropping them would destroy the
--    snapshots already stored for real reservations. Only if you are certain, and after a backup:
--      -- alter table public.reservations drop column price_snapshot, drop column currency_snapshot;
