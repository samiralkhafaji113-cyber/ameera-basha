import { AGE_BUCKETS, PRICE_BUCKETS } from "../data/categories";
import type { Product, ProductFilters, SortKey } from "../types/product";

/** Arabic-aware normalisation so "فستان", "فُستان" and "بيجامة"/"بجامه" all match. */
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Colloquial spellings, broken plurals and singular/plural pairs. Each key (already normalised) expands to a
 * list of ALTERNATIVES – a product matches if it contains any of them – so "احذية" finds both "حذاء" and "أحذية".
 */
const SYNONYMS: Record<string, string[]> = {
  شنطه: ["حقيبه"],
  شنط: ["حقيبه"],
  جنطه: ["حقيبه"],
  حقايب: ["حقيبه", "حقايب"],
  بنطلون: ["بنطرون"],
  بنطلونات: ["بنطرون"],
  بناطيل: ["بنطرون"],
  بناطرين: ["بنطرون"],
  بجامه: ["بيجامه"],
  بيجاما: ["بيجامه"],
  بجاما: ["بيجامه"],
  جزمه: ["حذاء", "احذيه"],
  احذيه: ["احذيه", "حذاء"],
  حذاء: ["حذاء", "احذيه"],
  فساتين: ["فستان", "فساتين"],
  فستانات: ["فستان"],
  قمصان: ["قميص", "قمصان"],
  ارواب: ["روب", "ارواب"],
  اروب: ["روب"],
  اطقم: ["طقم", "اطقم"],
  دفاتر: ["دفتر", "دفاتر"],
  صداري: ["صدريه", "صداري"],
  صداره: ["صدريه"],
  صدره: ["صدريه"],
  ساعات: ["ساعه", "ساعات"],
  اولاد: ["اولاد", "ولاد"],
  ولد: ["ولد", "ولادي"],
  بنت: ["بنت", "بناتي"],
  طفل: ["طفل", "اطفال"],
  مدرسه: ["مدرسه", "مدرسيه"],
};

/** One group of alternatives per query word. */
function tokens(q: string): string[][] {
  return normalizeArabic(q)
    .split(" ")
    .filter(Boolean)
    .map((t) => SYNONYMS[t] ?? [t]);
}

const CATEGORY_TAGS: Record<string, string> = { women: "نسائية", kids: "أطفال", school: "مدرسية", stationery: "قرطاسية", accessories: "", home: "" };

const haystackCache = new WeakMap<Product, { all: string; name: string }>();
function haystack(p: Product) {
  let h = haystackCache.get(p);
  if (!h) {
    // Category *names* are compound («حقائب وأحذية وإكسسوارات») and would make "أحذية" match every bag, so only a
    // short tag per category is indexed, plus the precise subcategory name.
    const sub = p.subcategoryName;
    h = {
      name: normalizeArabic(p.name),
      all: normalizeArabic([p.name, p.description, CATEGORY_TAGS[p.category], sub, p.sizeLabel].filter(Boolean).join(" ")),
    };
    haystackCache.set(p, h);
  }
  return h;
}

export function matchesQuery(p: Product, q: string): number {
  const ts = tokens(q);
  if (!ts.length) return 1;
  const h = haystack(p);
  let score = 0;
  for (const alts of ts) {
    if (alts.some((t) => h.name.includes(t))) score += 2;
    else if (alts.some((t) => h.all.includes(t))) score += 1;
    else return 0;
  }
  return score;
}

export function matchesAge(p: Product, bucketId: string): boolean {
  const b = AGE_BUCKETS.find((x) => x.id === bucketId);
  if (!b || !p.ageRange) return false;
  return p.ageRange.minYears <= b.max && p.ageRange.maxYears >= b.min;
}

export function matchesPrice(p: Product, bucketId: string): boolean {
  const b = PRICE_BUCKETS.find((x) => x.id === bucketId);
  if (!b || p.price === undefined) return false;
  return p.price >= b.min && p.price < b.max;
}

export function matchesSize(p: Product, size: string): boolean {
  return Boolean(p.sizes?.includes(size) || p.numericSizes?.includes(size));
}

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  const q = f.q?.trim() ?? "";
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    if (f.category && p.category !== f.category) continue;
    if (f.subcategory && p.subcategory !== f.subcategory) continue;
    if (f.age && !matchesAge(p, f.age)) continue;
    if (f.size && !matchesSize(p, f.size)) continue;
    if (f.price && !matchesPrice(p, f.price)) continue;
    const score = q ? matchesQuery(p, q) : 1;
    if (!score) continue;
    scored.push({ p, score });
  }
  return sortProducts(scored, f.sort ?? "newest", Boolean(q));
}

function sortProducts(rows: { p: Product; score: number }[], sort: SortKey, hasQuery: boolean): Product[] {
  const byDate = (a: Product, b: Product) => b.postedAt.localeCompare(a.postedAt);
  const priced = (a: Product, b: Product, dir: 1 | -1) => {
    if (a.price === undefined && b.price === undefined) return byDate(a, b);
    if (a.price === undefined) return 1; // unpriced always last
    if (b.price === undefined) return -1;
    return (a.price - b.price) * dir || byDate(a, b);
  };
  const cmp =
    sort === "price-asc"
      ? (a: { p: Product; score: number }, b: { p: Product; score: number }) => priced(a.p, b.p, 1)
      : sort === "price-desc"
        ? (a: { p: Product; score: number }, b: { p: Product; score: number }) => priced(a.p, b.p, -1)
        : (a: { p: Product; score: number }, b: { p: Product; score: number }) =>
            (hasQuery ? b.score - a.score : 0) || byDate(a.p, b.p);
  return rows.sort(cmp).map((r) => r.p);
}

/** Live chip counts: how many products each category would show given the OTHER active filters (query, age, size, price). */
export function countByCategory(
  products: Product[],
  f: Omit<ProductFilters, "category" | "subcategory" | "sort">,
): { total: number; byCategory: Record<string, number> } {
  const rows = filterProducts(products, { ...f, category: undefined, subcategory: undefined });
  const byCategory: Record<string, number> = {};
  for (const p of rows) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
  return { total: rows.length, byCategory };
}

const LETTER_ORDER = ["S", "M", "L", "XL", "XXL", "XXXL", "FREE"];

/** Size options that actually exist in the catalog (letters first, then numbers ascending). */
export function collectSizeOptions(products: Product[]): string[] {
  const letters = new Set<string>();
  const numbers = new Set<string>();
  for (const p of products) {
    p.sizes?.forEach((s) => letters.add(s));
    p.numericSizes?.forEach((s) => numbers.add(s));
  }
  return [
    ...LETTER_ORDER.filter((s) => letters.has(s)),
    ...[...numbers].sort((a, b) => Number(a) - Number(b)),
  ];
}
