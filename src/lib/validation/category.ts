import { SLUG, generateSlug, normalizeSlug } from "./product";

export interface CategoryInput {
  name: string;
  slug: string;
  short_name: string | null;
  description: string | null;
  is_active: boolean;
}
export type CategoryErrors = Partial<Record<keyof CategoryInput, string>>;
export type CategoryParse = { ok: true; value: CategoryInput } | { ok: false; errors: CategoryErrors };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const flag = (v: unknown) => v === true || v === "on" || v === "true";

/** Used for categories and subcategories (subcategories simply ignore short_name/description). */
export function parseCategoryInput(raw: Record<string, unknown>, opts: { random?: () => number; prefix?: string } = {}): CategoryParse {
  const errors: CategoryErrors = {};
  const name = str(raw.name);
  if (name.length < 2 || name.length > 80) errors.name = "الاسم مطلوب (2 – 80 حرفاً).";

  let slug = normalizeSlug(str(raw.slug));
  if (!slug) slug = generateSlug(opts.random).replace(/^p-/, `${opts.prefix ?? "c"}-`);
  if (!SLUG.test(slug) || slug.length > 60) errors.slug = "الرابط المختصر: أحرف إنجليزية صغيرة وأرقام وشرطات فقط (حتى 60).";

  const short_name = str(raw.short_name) || null;
  if (short_name && short_name.length > 40) errors.short_name = "الاسم المختصر حتى 40 حرفاً.";
  const description = str(raw.description) || null;
  if (description && description.length > 300) errors.description = "الوصف حتى 300 حرف.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, slug, short_name, description, is_active: flag(raw.is_active) } };
}
