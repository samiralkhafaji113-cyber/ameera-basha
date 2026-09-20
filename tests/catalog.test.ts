import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { filterProducts, matchesQuery, normalizeArabic, collectSizeOptions } from "../src/lib/search";
import { CATEGORIES } from "../src/data/categories";
import { enrichStaticProducts } from "../src/lib/data/static";
import type { Product } from "../src/types/product";

const products: Product[] = enrichStaticProducts(JSON.parse(readFileSync(new URL("../src/data/catalog.generated.json", import.meta.url), "utf8")));

describe("catalog data integrity (nothing invented)", () => {
  it("has products with images that exist on disk", () => {
    assert.ok(products.length > 30);
    for (const p of products) {
      assert.ok(p.images.length > 0, `${p.slug} has no image`);
      for (const img of p.images) {
        assert.ok(readFileSync(new URL(`../public${img.src}`, import.meta.url)).length > 1000, `${img.src} missing`);
      }
    }
  });

  it("every product has a valid category/subcategory and a source link", () => {
    for (const p of products) {
      const cat = CATEGORIES.find((c) => c.id === p.category);
      assert.ok(cat, `${p.slug}: unknown category ${p.category}`);
      assert.ok(cat.subcategories.some((s) => s.id === p.subcategory), `${p.slug}: unknown subcategory ${p.subcategory}`);
      assert.match(p.sourceUrl ?? "", /^https:\/\/t\.me\/ameera_bashaa\/\d+$/);
    }
  });

  it("slugs are unique and prices (when present) are positive integers", () => {
    assert.equal(new Set(products.map((p) => p.slug)).size, products.length);
    for (const p of products.filter((x) => x.price !== undefined)) assert.ok(Number.isInteger(p.price) && p.price! > 0);
  });
});

describe("Arabic search", () => {
  it("normalises hamza / taa marbuta / ya / diacritics", () => {
    assert.equal(normalizeArabic("أَحْذِية"), "احذيه");
    assert.equal(normalizeArabic("مدرسيّة"), "مدرسيه");
    assert.equal(normalizeArabic("  فُستان   نسائي "), "فستان نسايي"); // ئ → ي on both sides of a match
  });

  it("finds 'فستان' and ranks name matches", () => {
    const r = filterProducts(products, { q: "فستان" });
    assert.ok(r.length >= 1);
    assert.ok(r.every((p) => normalizeArabic(p.name).includes("فستان") || matchesQuery(p, "فستان") > 0));
  });

  it("understands colloquial spellings (شنطة → حقيبة, بجامة → بيجامة)", () => {
    assert.ok(filterProducts(products, { q: "شنطة" }).some((p) => p.name.includes("حقيبة")));
    assert.ok(filterProducts(products, { q: "بجامة" }).some((p) => p.name.includes("بيجامة")));
  });

  it("returns nothing for gibberish", () => {
    assert.equal(filterProducts(products, { q: "zzzqqq" }).length, 0);
  });
});

describe("filters & sorting", () => {
  it("category + subcategory narrow results", () => {
    const kids = filterProducts(products, { category: "kids" });
    const girls = filterProducts(products, { category: "kids", subcategory: "girls" });
    assert.ok(girls.length > 0 && girls.length < kids.length);
    assert.ok(girls.every((p) => p.category === "kids" && p.subcategory === "girls"));
  });

  it("age filter only returns products that state an age overlapping the bucket", () => {
    const r = filterProducts(products, { age: "6-9" });
    assert.ok(r.length > 0);
    assert.ok(r.every((p) => p.ageRange && p.ageRange.minYears <= 9 && p.ageRange.maxYears >= 6));
  });

  it("price filter never returns unpriced products; sort puts unpriced last", () => {
    assert.ok(filterProducts(products, { price: "5-10" }).every((p) => p.price !== undefined && p.price >= 5000 && p.price < 10000));
    const asc = filterProducts(products, { sort: "price-asc" });
    const firstUnpriced = asc.findIndex((p) => p.price === undefined);
    assert.ok(asc.slice(firstUnpriced).every((p) => p.price === undefined));
    const priced = asc.slice(0, firstUnpriced).map((p) => p.price!);
    assert.deepEqual(priced, [...priced].sort((a, b) => a - b));
  });

  it("size options come only from real data", () => {
    const opts = collectSizeOptions(products);
    assert.ok(opts.includes("XL"));
    assert.ok(opts.every((o) => /^[A-Z]+$/.test(o) || /^\d+$/.test(o)));
  });
});
