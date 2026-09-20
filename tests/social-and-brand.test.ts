import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { SOCIAL, sameAsUrls, socialLinks } from "../src/data/social";
import { countByCategory, filterProducts } from "../src/lib/search";
import type { Product } from "../src/types/product";

const products = JSON.parse(readFileSync(new URL("../src/data/catalog.generated.json", import.meta.url), "utf8")) as Product[];

describe("social channels are never invented", () => {
  it("every channel with a URL records how it was verified", () => {
    for (const s of SOCIAL) {
      if (!s.url) continue;
      assert.ok(["owner", "verified", "probable"].includes(s.verification.status), s.id);
      assert.ok(s.verification.evidence.length > 20, `${s.id} needs evidence`);
      assert.match(s.url, /^https:\/\//);
    }
  });

  it("owner-supplied links are exactly the ones given", () => {
    const by = Object.fromEntries(SOCIAL.map((s) => [s.id, s]));
    assert.equal(by.facebook.url, "https://www.facebook.com/amerabasha2/");
    assert.equal(by.telegram.url, "https://t.me/ameera_bashaa");
  });

  it("only owner/verified channels may appear in structured data (sameAs)", () => {
    const same = sameAsUrls();
    assert.ok(same.includes("https://www.instagram.com/ameera.baasha/"));
    assert.ok(!same.some((u) => u.includes("tiktok.com")), "TikTok is only 'probable'");
    assert.equal(socialLinks().length, SOCIAL.filter((s) => s.url).length);
  });
});

describe("official logo assets", () => {
  it("original + technical variants exist (nothing redrawn)", () => {
    for (const f of [
      "brand-source/official-logo-original.jpg",
      "public/brand/official-logo-original.jpg",
      "public/brand/logo-lockup-black.png",
      "public/brand/logo-lockup-white.png",
      "public/brand/logo-mark-black.png",
      "public/brand/logo-mark-white.png",
    ]) {
      assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
    }
    const a = readFileSync(new URL("../brand-source/official-logo-original.jpg", import.meta.url));
    const b = readFileSync(new URL("../public/brand/official-logo-original.jpg", import.meta.url));
    assert.ok(a.equals(b), "reference copy must be byte-identical to the supplied file");
  });
});

describe("products declare their source", () => {
  it("every product has a known source and a matching link", () => {
    for (const p of products) {
      assert.ok(["telegram", "facebook", "instagram", "tiktok"].includes(p.source), p.slug);
      if (p.source === "telegram") assert.match(p.sourceUrl ?? "", /^https:\/\/t\.me\/ameera_bashaa\/\d+$/);
    }
  });
});

describe("Arabic search – the requested terms all return sensible results", () => {
  const terms: Record<string, (p: Product) => boolean> = {
    "فستان": (p) => /فستان/.test(p.name),
    "فساتين": (p) => /فستان/.test(p.name) || p.subcategory === "dresses", // subcategory «فساتين ودشاديش»
    "شنطة": (p) => /حقيب/.test(p.name),
    "حقيبة": (p) => /حقيب/.test(p.name),
    "مدرسي": (p) => p.category === "school" || p.category === "stationery" || /مدرس/.test(p.name),
    "مدرسية": (p) => p.category === "school" || p.category === "stationery" || /مدرس/.test(p.name),
    "أطفال": (p) => p.category === "kids" || /اطفال|أطفال/.test(p.name),
    "بنات": (p) => /بنات/.test(p.name) || p.subcategory === "girls",
    "أولاد": (p) => /ولاد/.test(p.name) || p.subcategory === "boys",
    "قميص": (p) => /قميص/.test(p.name),
    "روب": (p) => /روب/.test(p.name),
  };
  for (const [q, ok] of Object.entries(terms)) {
    it(`"${q}" finds relevant products only`, () => {
      const r = filterProducts(products, { q });
      assert.ok(r.length > 0, `no results for ${q}`);
      assert.ok(r.every(ok), `irrelevant result for ${q}: ${r.filter((p) => !ok(p)).map((p) => p.name)}`);
    });
  }
  it("plural forms match singular products, and 'أحذية' does not return bags", () => {
    const shoes = filterProducts(products, { q: "احذية" });
    assert.ok(shoes.length > 0);
    assert.ok(shoes.every((p) => p.subcategory === "shoes" || /حذاء|احذيه|أحذية|بوت|سليبر/.test(p.name)), shoes.map((p) => p.name).join());
    assert.ok(filterProducts(products, { q: "حذاء" }).length === shoes.length);
  });
});

describe("live category chip counts (adapted 21st.dev Role Filter Chips)", () => {
  it("total equals the sum of category counts and matches the unfiltered list", () => {
    const c = countByCategory(products, {});
    assert.equal(c.total, products.length);
    assert.equal(Object.values(c.byCategory).reduce((a, b) => a + b, 0), c.total);
  });
  it("counts respect the other active filters (query / price)", () => {
    const q = countByCategory(products, { q: "حقيبة" });
    assert.equal(q.total, filterProducts(products, { q: "حقيبة" }).length);
    const p = countByCategory(products, { price: "5-10" });
    assert.equal(p.total, filterProducts(products, { price: "5-10" }).length);
    assert.ok(p.total < products.length);
  });
  it("a category with zero matches reports 0 (its chip is disabled in the UI)", () => {
    const z = countByCategory(products, { q: "zzzz" });
    assert.equal(z.total, 0);
  });
});
