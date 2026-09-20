-- ============================================================================
-- Ameera Basha Complex – core schema (additive, non-destructive)
-- Tables: profiles, categories, subcategories, products, product_images,
--         reservations, reservation_counters, audit_logs
-- Security model: RLS on every table (see 20260921000300_rls.sql). Nothing here
-- deletes existing data; every statement is CREATE-only.
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Private schema for helpers – NOT exposed through the Data API (only `public` is).
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------

-- Arabic-aware normalisation, mirrors src/lib/search.ts (normalizeArabic):
-- alef/hamza forms → ا, ى → ي, ة → ه, ؤ → و, ئ → ي, strips tashkeel/tatweel, Arabic-Indic digits → 0-9.
create or replace function public.normalize_arabic(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(t, '')), 'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'اااايهوي0123456789'),
      E'[\\u064B-\\u0652\\u0670\\u0640]', '', 'g'),
    '\s+', ' ', 'g'))
$$;

create or replace function public.iraqi_governorates()
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array['بغداد','بابل','البصرة','نينوى','أربيل','السليمانية','دهوك','كركوك','الأنبار','ديالى',
               'صلاح الدين','واسط','ميسان','ذي قار','المثنى','القادسية','النجف','كربلاء','حلبجة']
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles – staff roles live HERE (never in user_metadata, which users can edit)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'editor' check (role in ('admin', 'manager', 'editor')),
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories / subcategories
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  short_name  text check (short_name is null or char_length(short_name) <= 40),
  description text check (description is null or char_length(description) <= 300),
  image_path  text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index categories_order on public.categories (sort_order, name);
create trigger categories_updated_at before update on public.categories
  for each row execute function app.set_updated_at();

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  image_path  text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, slug)
);
create index subcategories_category on public.subcategories (category_id, sort_order);
create trigger subcategories_updated_at before update on public.subcategories
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
--   status: draft | published | hidden | archived   (hidden ≠ deleted)
--   deleted_at: soft delete (trash) – restorable, images kept
--   price / currency / price_verified: a price is only shown publicly when verified
-- ---------------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 2 and 160),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  category_id         uuid not null references public.categories (id) on delete restrict,
  subcategory_id      uuid references public.subcategories (id) on delete restrict,
  description         text check (description is null or char_length(description) <= 2000),

  price               numeric(12, 2) check (price is null or price >= 0),
  currency            text check (currency is null or currency in ('IQD', 'USD')),
  price_verified      boolean not null default false,

  size_label          text check (size_label is null or char_length(size_label) <= 120),  -- exactly as stated by the source
  sizes               text[] not null default '{}',          -- S, M, L, XL, XXL, XXXL, FREE
  numeric_sizes       text[] not null default '{}',          -- '38','39',…
  age_min             numeric(4, 1) check (age_min is null or age_min >= 0),
  age_max             numeric(4, 1) check (age_max is null or age_max <= 120),
  available           boolean,                               -- null = unknown (never invented)

  status              text not null default 'draft' check (status in ('draft', 'published', 'hidden', 'archived')),
  featured            boolean not null default false,

  source              text not null default 'manual' check (source in ('telegram', 'facebook', 'instagram', 'tiktok', 'manual')),
  source_url          text check (source_url is null or source_url ~ '^https://'),
  source_post_id      text,
  source_published_at timestamptz,

  search_text         text not null default '',
  deleted_at          timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint verified_price_needs_currency check (not price_verified or (price is not null and currency is not null)),
  constraint age_range_valid check (age_min is null or age_max is null or age_min <= age_max),
  -- idempotent imports: the same source post can only exist once (manual products have no post id)
  constraint products_source_post_unique unique (source, source_post_id)
);
create index products_public_list   on public.products (created_at desc) where status = 'published' and deleted_at is null;
create index products_admin_list    on public.products (status, created_at desc);
create index products_category      on public.products (category_id);
create index products_featured      on public.products (featured) where featured and status = 'published';
create index products_search_trgm   on public.products using gin (search_text extensions.gin_trgm_ops);
create trigger products_updated_at before update on public.products
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_images – files live in Storage; only their paths/URLs are stored here
-- ---------------------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  public_url   text not null,
  alt_text     text check (alt_text is null or char_length(alt_text) <= 200),
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (product_id, storage_path)
);
create index product_images_order on public.product_images (product_id, sort_order);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- reservations (customers never insert directly – see create_reservation())
-- ---------------------------------------------------------------------------
create table public.reservations (
  id                    uuid primary key default gen_random_uuid(),
  reservation_number    text not null unique,
  product_id            uuid references public.products (id) on delete set null,
  product_name_snapshot text not null,          -- survives renames / deletion of the product
  customer_name         text not null check (char_length(btrim(customer_name)) between 2 and 80),
  phone                 text not null check (phone ~ '^07[0-9]{9}$'),
  governorate           text not null check (governorate = any (public.iraqi_governorates())),
  district              text not null check (char_length(btrim(district)) between 2 and 80),
  address               text check (address is null or char_length(address) <= 300),
  size                  text check (size is null or char_length(size) <= 40),
  quantity              integer not null check (quantity between 1 and 50),
  notes                 text check (notes is null or char_length(notes) <= 600),
  admin_notes           text check (admin_notes is null or char_length(admin_notes) <= 1000),
  status                text not null default 'pending'
                        check (status in ('pending', 'contacted', 'confirmed', 'cancelled', 'completed', 'rejected')),
  status_changed_at     timestamptz,
  handled_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index reservations_status_created on public.reservations (status, created_at desc);
create index reservations_created        on public.reservations (created_at desc);
create index reservations_phone          on public.reservations (phone);
create index reservations_product        on public.reservations (product_id);
create trigger reservations_updated_at before update on public.reservations
  for each row execute function app.set_updated_at();

-- per-day counter → AB-YYYYMMDD-0001 (atomic upsert, no gaps under concurrency)
create table public.reservation_counters (
  day         date primary key,
  last_number integer not null default 0
);

-- ---------------------------------------------------------------------------
-- audit_logs – written ONLY by triggers (SECURITY DEFINER); clients cannot insert
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                       -- null = system / anonymous (e.g. customer reservation)
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs (created_at desc);
create index audit_logs_entity  on public.audit_logs (entity_type, entity_id);
