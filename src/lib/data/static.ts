import { CATEGORIES } from "../../data/categories";
import type { Product } from "../../types/product";

/** The bundled catalog JSON stores slugs only; add the denormalised display names the UI expects. */
export function enrichStaticProducts(raw: unknown): Product[] {
  return (raw as Omit<Product, "categoryName" | "subcategoryName">[]).map((p) => {
    const category = CATEGORIES.find((c) => c.id === p.category);
    return {
      ...p,
      categoryName: category?.name ?? "",
      subcategoryName: category?.subcategories.find((s) => s.id === p.subcategory)?.name ?? "",
    };
  });
}
