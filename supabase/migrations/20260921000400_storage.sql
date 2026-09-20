-- ============================================================================
-- Storage: one public-read bucket for product/category images.
--  * public URLs work for visitors without any policy (no listing is possible: no anon SELECT policy)
--  * only staff can write/replace/delete objects
--  * the bucket itself only accepts WebP up to 2 MiB – the upload route converts everything to WebP,
--    so even a leaked staff token cannot store other file types here
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy store_media_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']));

create policy store_media_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']));

create policy store_media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']))
  with check (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']));

create policy store_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-media' and app.has_role(array['admin', 'manager', 'editor']));
