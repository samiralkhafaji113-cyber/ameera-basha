-- ============================================================================
-- Slug history: make the redirect lookup a plain, cacheable GET instead of an RPC (POST).
-- Next.js can tag-cache a GET (so admin changes invalidate it instantly); a POST inside an ISR page turns the whole page
-- dynamic and fails. Visibility is enforced by RLS: a visitor only ever sees a history row whose product is PUBLISHED.
-- ============================================================================
drop function if exists public.resolve_product_slug(text);

grant select on public.product_slug_history to anon, authenticated;

create policy slug_history_public_read on public.product_slug_history
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published' and p.deleted_at is null
    )
    or app.has_role(array['admin', 'manager', 'editor'])
  );
