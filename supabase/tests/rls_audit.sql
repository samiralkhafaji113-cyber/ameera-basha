-- ============================================================================
-- RLS / privilege audit – READ ONLY. Run it on the LOCAL database and again on the HOSTED project
-- (Supabase Dashboard → SQL Editor → paste → Run). Every row must say PASS.
-- Local:  docker exec -i supabase_db_ameera-basha psql -U postgres -At -F ' | ' < supabase/tests/rls_audit.sql
-- ============================================================================
with
tbl as (
  select c.relname, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
anon_write as (
  select distinct table_name from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
),
anon_read as (
  select distinct table_name from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'
),
anon_fn as (
  select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.prokind = 'f'
),
policies as (
  select tablename, count(*) as n from pg_policies where schemaname = 'public' group by 1
)
select check_name, result, detail from (
  select 1 as ord, 'RLS enabled on every public table' as check_name,
         case when count(*) filter (where not rls) = 0 then 'PASS' else 'FAIL' end as result,
         coalesce(string_agg(relname, ', ') filter (where not rls), (count(*))::text || ' tables') as detail
  from tbl
  union all
  select 2, 'anon has no INSERT/UPDATE/DELETE on any public table',
         case when count(*) = 0 then 'PASS' else 'FAIL' end, coalesce(string_agg(table_name, ', '), 'none') from anon_write
  union all
  select 3, 'anon can read ONLY catalog tables (categories, subcategories, products, product_images, product_slug_history)',
         case when count(*) filter (where table_name not in ('categories', 'subcategories', 'products', 'product_images', 'product_slug_history')) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(table_name, ', '), 'none') from anon_read
  union all
  select 4, 'anon can execute ONLY the public helper functions',
         case when count(*) filter (where proname not in ('create_reservation', 'normalize_arabic', 'iraqi_governorates')) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(proname, ', '), 'none') from anon_fn
  union all
  select 5, 'customer tables have NO anon policy (reservations, audit_logs, profiles, reservation_counters)',
         case when not exists (select 1 from pg_policies where schemaname = 'public'
                               and tablename in ('reservations', 'audit_logs', 'profiles', 'reservation_counters')
                               and 'anon' = any (roles) or 'public' = any (roles)) then 'PASS' else 'FAIL' end,
         'checked pg_policies'
  union all
  select 6, 'every sensitive table has at least one policy or is deliberately closed',
         case when (select count(*) from policies where tablename in ('products', 'categories', 'subcategories', 'product_images', 'reservations', 'audit_logs', 'profiles')) = 7 then 'PASS' else 'FAIL' end,
         (select string_agg(tablename || '=' || n, ', ' order by tablename) from policies)
  union all
  select 7, 'reservation_counters has RLS and no client policy; slug history is read-only for published products',
         case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reservation_counters')
                and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_slug_history' and cmd <> 'SELECT') then 'PASS' else 'FAIL' end, ''
  union all
  select 8, 'storage bucket store-media: public read, 2 MiB, WebP only',
         case when exists (select 1 from storage.buckets where id = 'store-media' and public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp']) then 'PASS' else 'FAIL' end,
         coalesce((select file_size_limit::text || ' bytes / ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'store-media'), 'bucket missing')
  union all
  select 9, 'storage: no anon write/list policy; delete limited to admin/manager',
         case when not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and ('anon' = any (roles) or 'public' = any (roles)) and cmd <> 'SELECT')
                and exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE' and qual like '%admin%' and qual not like '%editor%') then 'PASS' else 'FAIL' end,
         (select string_agg(policyname, ', ') from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'store_media%')
  union all
  select 10, 'product_images DELETE policy excludes editors',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_images' and cmd = 'DELETE' and qual not like '%editor%') then 'PASS' else 'FAIL' end, ''
  union all
  select 11, 'reservations: authenticated may UPDATE only status/admin_notes',
         case when not exists (
                select 1 from information_schema.column_privileges
                where table_schema = 'public' and table_name = 'reservations' and grantee = 'authenticated'
                  and privilege_type = 'UPDATE' and column_name not in ('status', 'admin_notes')) then 'PASS' else 'FAIL' end, ''
  union all
  select 12, 'audit_logs: authenticated has SELECT only (no forging)',
         case when not exists (select 1 from information_schema.role_table_grants
                               where table_schema = 'public' and table_name = 'audit_logs' and grantee in ('anon', 'authenticated')
                                 and privilege_type <> 'SELECT') then 'PASS' else 'FAIL' end, ''
  union all
  select 13, 'INFO: auth users with throw-away test domains (must be 0 on the HOSTED project)',
         case when count(*) = 0 then 'PASS' else 'INFO' end, (count(*))::text || ' account(s)'
  from auth.users where split_part(email, '@', 2) ~* '(^|\.)(test|example|invalid|localhost)(\.|$)'
) checks
order by ord;
