import type { AgeBucketId, Category, CategoryId, PriceBucketId } from "@/types/product";

/**
 * Category taxonomy. Extendable: add a category/subcategory here and (re)classify products in
 * scripts/build-catalog.mjs – no UI change required.
 */
export const CATEGORIES: Category[] = [
  {
    id: "women",
    name: "ملابس نسائية",
    shortName: "نسائية",
    description: "فساتين وقمصان وأرواب وأطقم وسترات نسائية",
    subcategories: [
      { id: "dresses", name: "فساتين ودشاديش" },
      { id: "shirts", name: "قمصان" },
      { id: "robes", name: "أرواب وبيجامات" },
      { id: "sets", name: "أطقم وتنسيقات" },
      { id: "outerwear", name: "سترات وسويترات" },
      { id: "other", name: "أخرى" },
    ],
  },
  {
    id: "kids",
    name: "ملابس الأطفال",
    shortName: "أطفال",
    description: "ملابس بنات وأولاد حسب العمر",
    subcategories: [
      { id: "girls", name: "ملابس بنات" },
      { id: "boys", name: "ملابس أولاد" },
      { id: "general", name: "للأطفال عموماً" },
    ],
  },
  {
    id: "school",
    name: "ملابس مدرسية",
    shortName: "مدرسية",
    description: "صداري مدرسية بمقاسات متنوعة",
    subcategories: [{ id: "uniforms", name: "صداري وملابس مدرسية" }],
  },
  {
    id: "stationery",
    name: "قرطاسية",
    shortName: "قرطاسية",
    description: "دفاتر وحقائب مدرسية ومحافظ أقلام ومستلزمات دراسية",
    subcategories: [
      { id: "notebooks", name: "دفاتر" },
      { id: "school-bags", name: "حقائب مدرسية" },
      { id: "pencil-cases", name: "محافظ أقلام" },
      { id: "general", name: "مستلزمات مدرسية" },
    ],
  },
  {
    id: "accessories",
    name: "حقائب وأحذية وإكسسوارات",
    shortName: "حقائب وأحذية",
    description: "حقائب وأحذية وساعات وأحزمة وإكسسوارات",
    subcategories: [
      { id: "bags", name: "حقائب" },
      { id: "shoes", name: "أحذية" },
      { id: "accessories", name: "إكسسوارات وساعات" },
      { id: "hijab", name: "حجابات" },
    ],
  },
  {
    id: "home",
    name: "مفروشات وكوزمتك ومنوعات",
    shortName: "مفروشات ومنوعات",
    description: "مفروشات ومنتجات عناية وألعاب ومنوعات",
    subcategories: [
      { id: "furnishing", name: "مفروشات" },
      { id: "cosmetics", name: "كوزمتك وعناية" },
      { id: "toys", name: "ألعاب" },
      { id: "electrical", name: "أجهزة كهربائية" },
      { id: "misc", name: "منوعات" },
    ],
  },
];

export const categoryById = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id)!;

export const subcategoryName = (category: CategoryId, sub: string): string =>
  categoryById(category).subcategories.find((s) => s.id === sub)?.name ?? "";

/** The five main entry points shown as large cards on the homepage. */
export interface HomeCategoryCard {
  key: string;
  title: string;
  description: string;
  href: string;
  /** Real product photo used as cover (ids are Telegram post ids). */
  cover: string;
  coverAlt: string;
}

export const HOME_CATEGORY_CARDS: HomeCategoryCard[] = [
  {
    key: "women",
    title: "ملابس نسائية",
    description: "فساتين وقمصان وأرواب وأطقم وسترات",
    href: "/products?category=women",
    cover: "/products/26598/1.webp",
    coverAlt: "فستان نسائي من منتجات المجمع",
  },
  {
    key: "girls",
    title: "ملابس بنات",
    description: "أطقم وتراكات وسترات للبنات بمقاسات متنوعة",
    href: "/products?category=kids&subcategory=girls",
    cover: "/products/26595/1.webp",
    coverAlt: "طقم بناتي من منتجات المجمع",
  },
  {
    key: "boys",
    title: "ملابس أولاد",
    description: "تراكات وسترات وبناطيل وقاط للأولاد",
    href: "/products?category=kids&subcategory=boys",
    cover: "/products/26514/1.webp",
    coverAlt: "قاط ولادي رسمي من منتجات المجمع",
  },
  {
    key: "school",
    title: "ملابس مدرسية",
    description: "صداري مدرسية بمقاسات متنوعة",
    href: "/products?category=school",
    cover: "/products/26793/1.webp",
    coverAlt: "صدرية مدرسية من منتجات المجمع",
  },
  {
    key: "stationery",
    title: "قرطاسية",
    description: "دفاتر وحقائب مدرسية ومحافظ أقلام ومستلزمات دراسية",
    href: "/products?category=stationery",
    cover: "/products/26771/1.webp",
    coverAlt: "محفظة أقلام من منتجات المجمع",
  },
];

/** Additional sections seen in the store's own posts (shown as a secondary row). */
export const MORE_SECTIONS: HomeCategoryCard[] = [
  {
    key: "accessories",
    title: "حقائب وأحذية وإكسسوارات",
    description: "حقائب نسائية وأحذية وساعات وأحزمة",
    href: "/products?category=accessories",
    cover: "/products/26807/1.webp",
    coverAlt: "حقيبة نسائية من منتجات المجمع",
  },
  {
    key: "home",
    title: "مفروشات وكوزمتك ومنوعات",
    description: "مفروشات ومنتجات عناية وألعاب أطفال",
    href: "/products?category=home",
    cover: "/products/26524/1.webp",
    coverAlt: "مفروشات من منتجات المجمع",
  },
];

export const AGE_BUCKETS: { id: AgeBucketId; label: string; min: number; max: number }[] = [
  { id: "0-5", label: "حتى 5 سنوات", min: 0, max: 5 },
  { id: "6-9", label: "6 – 9 سنوات", min: 6, max: 9 },
  { id: "10-12", label: "10 – 12 سنة", min: 10, max: 12 },
  { id: "13-16", label: "13 – 16 سنة", min: 13, max: 16 },
  { id: "17+", label: "17 سنة فأكثر", min: 17, max: 99 },
];

export const PRICE_BUCKETS: { id: PriceBucketId; label: string; min: number; max: number }[] = [
  { id: "lt5", label: "أقل من 5,000", min: 0, max: 5000 },
  { id: "5-10", label: "5,000 – 10,000", min: 5000, max: 10000 },
  { id: "10-20", label: "10,000 – 20,000", min: 10000, max: 20000 },
  { id: "gt20", label: "أكثر من 20,000", min: 20000, max: Infinity },
];

export const SIZE_LABELS: Record<string, string> = { FREE: "فري سايز" };
