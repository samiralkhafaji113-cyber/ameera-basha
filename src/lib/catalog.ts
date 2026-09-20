import "server-only";
import { cache } from "react";
import raw from "@/data/catalog.generated.json";
import { CATEGORIES } from "@/data/categories";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category, Product } from "@/types/product";
import { enrichStaticProducts } from "./data/static";
import { rowToCategory, rowToProduct } from "./data/mappers";
import type { CategoryRow, ProductRow } from "./data/mappers";

/**
 * Data abstraction layer for the PUBLIC site. UI code only calls this repository.
 *  - Supabase configured  → published products / active categories from the database (RLS + tag-cached).
 *  - Not configured       → the bundled static catalog (development / CI without a backend).
 */
export interface ProductRepository {
  list(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  featured(limit?: number): Promise<Product[]>;
  related(product: Product, limit?: number): Promise<Product[]>;
  categories(): Promise<Category[]>;
  /** An OLD slug of a product → its current slug (null when unknown / not public). Keeps renamed URLs working. */
  resolveSlug(slug: string): Promise<string | null>;
}

function derived(base: Omit<ProductRepository, "categories">, categories: () => Promise<Category[]>): ProductRepository {
  return { ...base, categories };
}

// --------------------------------------------------------------------------- shared helpers
const pickFeatured = (all: Product[], limit: number) => all.filter((p) => p.featured).slice(0, limit);
const pickRelated = (all: Product[], product: Product, limit: number) => {
  const same = all.filter((p) => p.slug !== product.slug && p.category === product.category);
  const sameSub = same.filter((p) => p.subcategory === product.subcategory);
  return [...sameSub, ...same.filter((p) => !sameSub.includes(p))].slice(0, limit);
};

// --------------------------------------------------------------------------- static fallback
function staticRepository(): ProductRepository {
  const all = enrichStaticProducts(raw);
  return derived(
    {
      list: async () => all,
      getBySlug: async (slug) => all.find((p) => p.slug === slug) ?? null,
      featured: async (limit = 8) => pickFeatured(all, limit),
      related: async (product, limit = 4) => pickRelated(all, product, limit),
      resolveSlug: async () => null,
    },
    async () => CATEGORIES,
  );
}

// --------------------------------------------------------------------------- Supabase
const PRODUCT_SELECT =
  "id,slug,name,description,price,currency,price_verified,size_label,sizes,numeric_sizes,age_min,age_max,available,featured,source,source_url,source_published_at,created_at," +
  "category:categories(slug,name,short_name),subcategory:subcategories(slug,name)," +
  "images:product_images(id,public_url,alt_text,width,height,sort_order,is_primary)";

const MAX_PUBLIC_PRODUCTS = 1000; // matches the API row cap; the browse page filters this list client-side

// React cache() de-duplicates within one render; the Next data cache (tag "catalog") does the rest.
const loadProducts = cache(async (): Promise<Product[]> => {
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_PUBLIC_PRODUCTS);
  if (error) throw new Error(`catalog query failed: ${error.message}`);
  return (data as unknown as ProductRow[]).map(rowToProduct).filter((p): p is Product => p !== null);
});

const loadCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id,slug,name,short_name,description,image_url,subcategories(slug,name,image_url,sort_order,is_active)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`categories query failed: ${error.message}`);
  return (data as unknown as CategoryRow[]).map(rowToCategory);
});

function supabaseRepository(): ProductRepository {
  return derived(
    {
      list: loadProducts,
      getBySlug: async (slug) => (await loadProducts()).find((p) => p.slug === slug) ?? null,
      featured: async (limit = 8) => pickFeatured(await loadProducts(), limit),
      related: async (product, limit = 4) => pickRelated(await loadProducts(), product, limit),
      resolveSlug: async (slug) => {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
        // plain GET (tag-cached like every catalog read): RLS only exposes history rows of PUBLISHED products
        const { data, error } = await createPublicClient().from("product_slug_history").select("product:products(slug)").eq("slug", slug).maybeSingle();
        const current = (data as { product?: { slug?: string } | null } | null)?.product?.slug;
        return error || typeof current !== "string" ? null : current;
      },
    },
    loadCategories,
  );
}

export function getProductRepository(): ProductRepository {
  return isSupabaseConfigured() ? supabaseRepository() : staticRepository();
}
