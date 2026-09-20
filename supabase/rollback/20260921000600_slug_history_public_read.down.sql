-- ROLLBACK for 20260921000600_slug_history_public_read.sql (not run automatically).
-- Effect: visitors can no longer look up old slugs → renamed products' old URLs return 404 again (no data is touched).
drop policy if exists slug_history_public_read on public.product_slug_history;
revoke select on public.product_slug_history from anon, authenticated;
