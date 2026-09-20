import "server-only";
import type { CategoryOption, ProductFormValues } from "@/components/admin/ProductForm";
import { createSessionClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSessionClient>>;

/** Categories with their sub-categories for the product form (staff can see inactive ones too). */
export async function loadCategoryOptions(supabase: Client): Promise<CategoryOption[]> {
  const { data } = await supabase.from("categories").select("id, name, sort_order, subcategories(id, name, sort_order)").order("sort_order");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    subcategories: ((c.subcategories ?? []) as { id: string; name: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ id: s.id, name: s.name })),
  }));
}

interface ProductDbRow {
  name: string;
  slug: string;
  category_id: string;
  subcategory_id: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  price_verified: boolean;
  available: boolean | null;
  featured: boolean;
  sizes: string[] | null;
  numeric_sizes: string[] | null;
  size_label: string | null;
  age_min: number | string | null;
  age_max: number | string | null;
  source: string;
  source_url: string | null;
  source_post_id: string | null;
  source_published_at: string | null;
}

const numText = (v: number | string | null) => (v === null ? "" : String(Number(v)));

export function productToFormValues(p: ProductDbRow): ProductFormValues {
  return {
    name: p.name,
    slug: p.slug,
    category_id: p.category_id,
    subcategory_id: p.subcategory_id ?? "",
    description: p.description ?? "",
    price: numText(p.price),
    currency: p.currency ?? "",
    price_verified: p.price_verified,
    available: p.available === null ? "" : String(p.available),
    featured: p.featured,
    sizes: p.sizes ?? [],
    numeric_sizes: (p.numeric_sizes ?? []).join(", "),
    size_label: p.size_label ?? "",
    age_min: numText(p.age_min),
    age_max: numText(p.age_max),
    source: p.source,
    source_url: p.source_url ?? "",
    source_post_id: p.source_post_id ?? "",
    source_published_at: p.source_published_at ? p.source_published_at.slice(0, 10) : "",
  };
}
