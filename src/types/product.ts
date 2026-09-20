/** Category slug (categories are data-driven now: admins can add/edit them). */
export type CategoryId = string;

export type ProductSource = "telegram" | "facebook" | "instagram" | "tiktok" | "manual";

export interface ProductImage {
  src: string;
  width: number;
  height: number;
  alt?: string;
}

export interface AgeRange {
  minYears: number;
  maxYears: number;
}

/**
 * A catalog product. Every optional field is optional on purpose: if the source
 * (the store's own posts) does not state it, the UI must not invent it.
 */
export interface Product {
  id: string;
  slug: string;
  name: string;
  /** category / subcategory slugs */
  category: CategoryId;
  subcategory: string;
  /** Denormalised display names (so cards need no lookup table). */
  categoryName: string;
  subcategoryName: string;
  description?: string;
  images: ProductImage[];
  /** Price in Iraqi dinar, only when the post states one. */
  price?: number;
  currency?: "IQD";
  /** Letter sizes (S, M, L, XL, XXL, XXXL) or "FREE". */
  sizes?: string[];
  /** Numeric sizes covered by a stated range, e.g. ["38", "39", … "48"]. */
  numericSizes?: string[];
  /** The size text exactly as stated in the source. */
  sizeLabel?: string;
  ageRange?: AgeRange;
  /** true only when the source post says the item is available. */
  available?: boolean;
  featured?: boolean;
  /** Platform the product was taken from (never guessed). */
  source: ProductSource;
  /** ISO date of the source post – used to show how fresh the info is. */
  postedAt: string;
  sourceUrl?: string;
}

export interface Subcategory {
  id: string;
  name: string;
  image?: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  /** Compact label for filter chips. */
  shortName?: string;
  image?: string;
  description: string;
  subcategories: Subcategory[];
}

export type SortKey = "newest" | "price-asc" | "price-desc";
export type AgeBucketId = "0-5" | "6-9" | "10-12" | "13-16" | "17+";
export type PriceBucketId = "lt5" | "5-10" | "10-20" | "gt20";

export interface ProductFilters {
  q?: string;
  category?: CategoryId;
  subcategory?: string;
  age?: AgeBucketId;
  size?: string;
  price?: PriceBucketId;
  sort?: SortKey;
}
