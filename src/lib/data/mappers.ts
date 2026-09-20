import type { Category, Product, ProductImage, ProductSource } from "../../types/product";

/** Shapes returned by the public Supabase queries (see lib/catalog.ts). Pure mapping → unit-testable. */
export interface ImageRow {
  id: string;
  public_url: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  price_verified: boolean;
  size_label: string | null;
  sizes: string[] | null;
  numeric_sizes: string[] | null;
  age_min: number | string | null;
  age_max: number | string | null;
  available: boolean | null;
  featured: boolean;
  source: string;
  source_url: string | null;
  source_published_at: string | null;
  created_at: string;
  category: { slug: string; name: string; short_name: string | null } | null;
  subcategory: { slug: string; name: string } | null;
  images: ImageRow[] | null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  image_url: string | null;
  subcategories: { slug: string; name: string; image_url: string | null; sort_order: number; is_active: boolean }[] | null;
}

const SOURCES: readonly ProductSource[] = ["telegram", "facebook", "instagram", "tiktok", "manual"];

/** Primary image first, then the admin-defined order. */
export function orderImages(images: ImageRow[]): ImageRow[] {
  return [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
}

/**
 * DB row → public Product.
 * - A price is exposed ONLY when it is verified AND has a currency; otherwise the UI shows «السعر عند الاستفسار».
 * - Rows whose category is inactive/hidden by RLS (category = null) are dropped.
 */
export function rowToProduct(row: ProductRow): Product | null {
  if (!row.category) return null;
  const images: ProductImage[] = orderImages(row.images ?? []).map((i) => ({
    src: i.public_url,
    width: i.width ?? 800,
    height: i.height ?? 1000,
    alt: i.alt_text ?? undefined,
  }));
  const price = row.price !== null && row.price_verified && row.currency ? Number(row.price) : undefined;
  const min = row.age_min !== null ? Number(row.age_min) : null;
  const max = row.age_max !== null ? Number(row.age_max) : null;
  const source = (SOURCES as readonly string[]).includes(row.source) ? (row.source as ProductSource) : "manual";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category.slug,
    categoryName: row.category.name,
    subcategory: row.subcategory?.slug ?? "",
    subcategoryName: row.subcategory?.name ?? "",
    ...(row.description ? { description: row.description } : {}),
    images,
    ...(price !== undefined ? { price, currency: row.currency as "IQD" } : {}),
    ...(row.sizes?.length ? { sizes: row.sizes } : {}),
    ...(row.numeric_sizes?.length ? { numericSizes: row.numeric_sizes } : {}),
    ...(row.size_label ? { sizeLabel: row.size_label } : {}),
    ...(min !== null && max !== null ? { ageRange: { minYears: min, maxYears: max } } : {}),
    ...(row.available !== null ? { available: row.available } : {}),
    ...(row.featured ? { featured: true } : {}),
    source,
    postedAt: row.source_published_at ?? row.created_at,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
  };
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.slug,
    name: row.name,
    ...(row.short_name ? { shortName: row.short_name } : {}),
    description: row.description ?? "",
    ...(row.image_url ? { image: row.image_url } : {}),
    subcategories: [...(row.subcategories ?? [])]
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.slug, name: s.name, ...(s.image_url ? { image: s.image_url } : {}) })),
  };
}
