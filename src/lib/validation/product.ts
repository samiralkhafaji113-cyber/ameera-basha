/**
 * Server-side product validation (pure → unit-tested). Used by the admin Server Actions; the browser form only
 * mirrors it for convenience. The database repeats the important constraints (CHECKs, triggers, RLS).
 */
export const PRODUCT_STATUSES = ["draft", "published", "hidden", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_SOURCES = ["manual", "telegram", "facebook", "instagram", "tiktok"] as const;
export const CURRENCIES = ["IQD", "USD"] as const;
export const LETTER_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL", "FREE"] as const;

export interface ProductInput {
  name: string;
  slug: string;
  category_id: string;
  subcategory_id: string | null;
  description: string | null;
  price: number | null;
  currency: "IQD" | "USD" | null;
  price_verified: boolean;
  size_label: string | null;
  sizes: string[];
  numeric_sizes: string[];
  age_min: number | null;
  age_max: number | null;
  available: boolean | null;
  featured: boolean;
  source: (typeof PRODUCT_SOURCES)[number];
  source_url: string | null;
  source_post_id: string | null;
  source_published_at: string | null;
}

export type ProductErrors = Partial<Record<keyof ProductInput, string>>;
export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ProductErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);

/** Arabic-Indic / Persian digits and Arabic separators → ASCII so «١٢٬٥٠٠» parses. */
export function toAsciiNumber(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
}

function parseNumber(raw: unknown): number | null | "invalid" {
  const s = toAsciiNumber(str(raw));
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return "invalid";
  return Number(s);
}

/** A random latin slug for products created without one (Arabic names cannot be turned into URL-safe latin text reliably). */
export function generateSlug(random: () => number = Math.random): string {
  return `p-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0")}`;
}

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseProductInput(raw: Record<string, unknown>, opts: { random?: () => number } = {}): ParseResult<ProductInput> {
  const errors: ProductErrors = {};

  const name = str(raw.name);
  if (name.length < 2 || name.length > 160) errors.name = "اسم المنتج مطلوب (2 – 160 حرفاً).";

  let slug = normalizeSlug(str(raw.slug));
  if (!slug) slug = generateSlug(opts.random);
  if (!SLUG.test(slug) || slug.length > 80) errors.slug = "الرابط المختصر: أحرف إنجليزية صغيرة وأرقام وشرطات فقط.";

  const category_id = str(raw.category_id);
  if (!UUID.test(category_id)) errors.category_id = "اختر القسم.";
  const subRaw = str(raw.subcategory_id);
  if (subRaw && !UUID.test(subRaw)) errors.subcategory_id = "القسم الفرعي غير صالح.";

  const description = str(raw.description) || null;
  if (description && description.length > 2000) errors.description = "الوصف طويل جداً (الحد 2000 حرف).";

  // price ---------------------------------------------------------------
  const priceParsed = parseNumber(raw.price);
  let price: number | null = null;
  if (priceParsed === "invalid") errors.price = "أدخل السعر كرقم صحيح.";
  else if (priceParsed !== null) {
    if (priceParsed < 0 || priceParsed > 999_999_999) errors.price = "السعر خارج النطاق المسموح.";
    else price = priceParsed;
  }
  const currencyRaw = str(raw.currency);
  let currency: ProductInput["currency"] = null;
  if (currencyRaw) {
    if ((CURRENCIES as readonly string[]).includes(currencyRaw)) currency = currencyRaw as "IQD" | "USD";
    else errors.currency = "العملة غير صالحة.";
  }
  if (price === null) currency = null; // no price → no currency, nothing to verify
  const wantsVerified = raw.price_verified === true || raw.price_verified === "on" || raw.price_verified === "true";
  const price_verified = wantsVerified && price !== null;
  if (wantsVerified && price === null) errors.price_verified = "لا يمكن تأكيد سعر غير مُدخل.";
  if (price_verified && !currency) errors.currency = "اختر العملة لتأكيد السعر.";

  // sizes ---------------------------------------------------------------
  const sizes = list(raw.sizes).map((s) => s.toUpperCase());
  if (sizes.some((s) => !(LETTER_SIZES as readonly string[]).includes(s))) errors.sizes = "مقاس غير معروف.";
  const numeric_sizes = list(typeof raw.numeric_sizes === "string" ? raw.numeric_sizes.split(/[,،\s]+/) : raw.numeric_sizes).map(toAsciiNumber).filter(Boolean);
  if (numeric_sizes.some((s) => !/^\d{1,3}$/.test(s)) || numeric_sizes.length > 40) errors.numeric_sizes = "المقاسات الرقمية: أرقام مفصولة بفواصل (مثل 38, 40, 42).";
  const size_label = str(raw.size_label) || null;
  if (size_label && size_label.length > 120) errors.size_label = "نص المقاس طويل جداً.";

  // age -----------------------------------------------------------------
  const min = parseNumber(raw.age_min);
  const max = parseNumber(raw.age_max);
  if (min === "invalid" || (typeof min === "number" && (min < 0 || min > 120))) errors.age_min = "العمر غير صالح.";
  if (max === "invalid" || (typeof max === "number" && (max < 0 || max > 120))) errors.age_max = "العمر غير صالح.";
  if ((min === null) !== (max === null)) errors.age_max = "أدخل الحد الأدنى والأعلى للعمر معاً أو اتركهما فارغين.";
  if (typeof min === "number" && typeof max === "number" && min > max) errors.age_max = "الحد الأعلى للعمر أقل من الأدنى.";

  // availability: tri-state, unknown stays unknown --------------------------
  const availRaw = str(raw.available);
  const available = availRaw === "true" ? true : availRaw === "false" ? false : null;

  const featured = raw.featured === true || raw.featured === "on" || raw.featured === "true";

  // source --------------------------------------------------------------
  const sourceRaw = str(raw.source) || "manual";
  let source: ProductInput["source"] = "manual";
  if ((PRODUCT_SOURCES as readonly string[]).includes(sourceRaw)) source = sourceRaw as ProductInput["source"];
  else errors.source = "مصدر غير صالح.";
  const source_url = str(raw.source_url) || null;
  if (source_url && (!/^https:\/\/[^\s]+$/.test(source_url) || source_url.length > 500)) errors.source_url = "أدخل رابطاً صحيحاً يبدأ بـ https://";
  const source_post_id = str(raw.source_post_id) || null;
  if (source_post_id && source_post_id.length > 80) errors.source_post_id = "معرّف المنشور طويل جداً.";
  const publishedRaw = str(raw.source_published_at);
  let source_published_at: string | null = null;
  if (publishedRaw) {
    const d = new Date(publishedRaw);
    if (Number.isNaN(d.getTime())) errors.source_published_at = "تاريخ غير صالح.";
    else source_published_at = d.toISOString();
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      slug,
      category_id,
      subcategory_id: subRaw || null,
      description,
      price,
      currency,
      price_verified,
      size_label,
      sizes,
      numeric_sizes,
      age_min: typeof min === "number" ? min : null,
      age_max: typeof max === "number" ? max : null,
      available,
      featured,
      source,
      source_url,
      source_post_id,
      source_published_at,
    },
  };
}

/** Which status changes the admin UI offers from each status. */
export const STATUS_ACTIONS: Record<ProductStatus, readonly { to: ProductStatus; label: string }[]> = {
  draft: [{ to: "published", label: "نشر" }],
  published: [
    { to: "hidden", label: "إخفاء" },
    { to: "archived", label: "أرشفة" },
  ],
  hidden: [
    { to: "published", label: "نشر" },
    { to: "archived", label: "أرشفة" },
  ],
  archived: [
    { to: "draft", label: "استعادة كمسودة" },
    { to: "published", label: "نشر" },
  ],
};
