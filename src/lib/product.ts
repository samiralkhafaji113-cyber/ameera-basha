import type { Product } from "../types/product";

/** Label for the size text – the source uses one "القياس" line for both ages and sizes. */
export function sizeFieldLabel(p: Pick<Product, "sizeLabel" | "ageRange">): string {
  if (!p.sizeLabel) return "";
  if (p.ageRange && /سن/.test(p.sizeLabel)) return "العمر";
  if (p.ageRange) return "المقاس / العمر";
  return "المقاس";
}

export const productHref = (p: Pick<Product, "slug">) => `/products/${p.slug}`;

/** Selectable size options for the reservation form (empty → free-text field). */
export function sizeOptions(p: Pick<Product, "sizes" | "numericSizes">): string[] {
  return [...(p.sizes ?? []).map((s) => (s === "FREE" ? "فري سايز" : s)), ...(p.numericSizes ?? [])];
}
