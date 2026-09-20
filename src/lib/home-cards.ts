import { HOME_CATEGORY_CARDS, MORE_SECTIONS } from "../data/categories";
import type { HomeCategoryCard } from "../data/categories";
import type { Category } from "../types/product";

const target = (href: string) => {
  const q = new URLSearchParams(href.split("?")[1] ?? "");
  return { category: q.get("category") ?? "", subcategory: q.get("subcategory") ?? "" };
};

/**
 * Homepage cards. The curated cards (copy + layout) stay as designed; the live category list decides
 *  - which of them still exist (an admin can deactivate a category),
 *  - which cover to use (an image uploaded in the admin wins over the bundled photo),
 * and any category the admin adds that has no curated card is appended to the "more" list.
 */
export function buildHomeCards(categories: Category[]): { main: HomeCategoryCard[]; more: HomeCategoryCard[] } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const resolve = (card: HomeCategoryCard): HomeCategoryCard | null => {
    const t = target(card.href);
    const category = byId.get(t.category);
    if (!category) return null;
    const sub = t.subcategory ? category.subcategories.find((s) => s.id === t.subcategory) : undefined;
    if (t.subcategory && !sub) return null;
    return { ...card, cover: sub?.image ?? (!t.subcategory ? category.image : undefined) ?? card.cover };
  };

  const main = HOME_CATEGORY_CARDS.map(resolve).filter((c): c is HomeCategoryCard => c !== null);
  const curatedMore = MORE_SECTIONS.map(resolve).filter((c): c is HomeCategoryCard => c !== null);

  const covered = new Set([...HOME_CATEGORY_CARDS, ...MORE_SECTIONS].map((c) => target(c.href).category));
  const extra: HomeCategoryCard[] = categories
    .filter((c) => !covered.has(c.id))
    .map((c) => ({
      key: `cat-${c.id}`,
      title: c.name,
      description: c.description,
      href: `/products?category=${encodeURIComponent(c.id)}`,
      cover: c.image ?? "/brand/logo-mark-black.png",
      coverAlt: c.name,
    }));

  return { main, more: [...curatedMore, ...extra] };
}
