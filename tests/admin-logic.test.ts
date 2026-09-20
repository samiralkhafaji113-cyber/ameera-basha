import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLES, can } from "../src/lib/auth/roles";
import type { Permission } from "../src/lib/auth/roles";
import { safeNext } from "../src/lib/auth/next";
import { parseProductInput, normalizeSlug, toAsciiNumber } from "../src/lib/validation/product";
import { parseCategoryInput } from "../src/lib/validation/category";
import { IMAGE_LIMITS, checkDimensions, checkUpload, sniffImage } from "../src/lib/validation/image";
import { ACTIVE_STATUSES, RESERVATION_STATUSES, canTransition, nextStatuses, sanitizeSearchTerm } from "../src/lib/reservation-status";
import { arabicDbError } from "../src/lib/db-errors";
import { auditActionLabel, auditDetail } from "../src/lib/audit-labels";
import { rowToCategory, rowToProduct } from "../src/lib/data/mappers";
import type { ProductRow } from "../src/lib/data/mappers";
import { buildHomeCards } from "../src/lib/home-cards";
import { CATEGORIES } from "../src/data/categories";
import { customerWhatsappUrl } from "../src/lib/whatsapp";

const UUID = "3f2b8c1e-0d4a-4b6f-9a55-1c2d3e4f5a6b";

describe("role → permission matrix", () => {
  const all: Permission[] = ["products.read", "products.write", "products.publish", "products.delete", "products.purge", "categories.manage", "reservations.manage", "audit.read", "settings.manage"];
  it("admin can do everything", () => {
    for (const p of all) assert.ok(can("admin", p), p);
  });
  it("manager cannot purge, read audit or manage settings", () => {
    for (const p of ["products.purge", "audit.read", "settings.manage"] as const) assert.equal(can("manager", p), false, p);
    for (const p of ["products.publish", "products.delete", "categories.manage", "reservations.manage"] as const) assert.ok(can("manager", p), p);
  });
  it("editor can only read/write products", () => {
    assert.ok(can("editor", "products.write"));
    for (const p of all.filter((x) => !["products.read", "products.write"].includes(x))) assert.equal(can("editor", p), false, p);
  });
  it("no role / unknown role gets nothing", () => {
    for (const p of all) {
      assert.equal(can(null, p), false);
      assert.equal(can(undefined, p), false);
    }
    assert.equal(ROLES.length, 3);
  });
});

describe("post-login redirect target", () => {
  it("accepts admin paths (with a simple query)", () => {
    assert.equal(safeNext("/admin/products"), "/admin/products");
    assert.equal(safeNext("/admin/reservations?status=pending"), "/admin/reservations?status=pending");
  });
  it("rejects open redirects and non-admin targets", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/admin//evil.example", "/admin/../etc", "/products", "javascript:alert(1)", "", undefined, 42, "/admin/x?redirect=//evil"]) {
      assert.equal(safeNext(bad), "/admin", String(bad));
    }
  });
});

describe("product validation (server side)", () => {
  const base = { name: "فستان صيفي", category_id: UUID, slug: "" };
  it("accepts a minimal product and generates a latin slug", () => {
    const r = parseProductInput(base, { random: () => 0.5 });
    assert.ok(r.ok);
    if (r.ok) {
      assert.match(r.value.slug, /^p-[a-z0-9]{8}$/);
      assert.equal(r.value.price, null);
      assert.equal(r.value.currency, null);
      assert.equal(r.value.price_verified, false);
      assert.equal(r.value.available, null, "unknown availability must stay unknown");
      assert.equal(r.value.source, "manual");
    }
  });
  it("requires a name and a valid category", () => {
    const r = parseProductInput({ name: "", category_id: "x" });
    assert.ok(!r.ok);
    if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["category_id", "name"]);
  });
  it("parses Arabic-Indic digits and thousands separators in prices", () => {
    assert.equal(toAsciiNumber("١٢٬٥٠٠"), "12500");
    const r = parseProductInput({ ...base, price: "١٢٬٥٠٠", currency: "IQD" });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.price, 12500);
  });
  it("never verifies a price without a value or a currency", () => {
    const noPrice = parseProductInput({ ...base, price_verified: "on" });
    assert.ok(!noPrice.ok);
    const noCurrency = parseProductInput({ ...base, price: "5000", price_verified: "on" });
    assert.ok(!noCurrency.ok);
    if (!noCurrency.ok) assert.ok(noCurrency.errors.currency);
    const ok = parseProductInput({ ...base, price: "5000", currency: "IQD", price_verified: "on" });
    assert.ok(ok.ok);
    if (ok.ok) assert.equal(ok.value.price_verified, true);
  });
  it("drops the currency when there is no price", () => {
    const r = parseProductInput({ ...base, currency: "USD" });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.currency, null);
  });
  it("rejects negative / non numeric prices and unknown currency", () => {
    assert.ok(!parseProductInput({ ...base, price: "-5" }).ok);
    assert.ok(!parseProductInput({ ...base, price: "abc" }).ok);
    assert.ok(!parseProductInput({ ...base, price: "10", currency: "EUR" }).ok);
  });
  it("validates sizes, ages and source url", () => {
    assert.ok(!parseProductInput({ ...base, sizes: ["S", "HUGE"] }).ok);
    assert.ok(!parseProductInput({ ...base, age_min: "5" }).ok, "age needs both ends");
    assert.ok(!parseProductInput({ ...base, age_min: "9", age_max: "5" }).ok);
    assert.ok(!parseProductInput({ ...base, source_url: "http://insecure.example" }).ok);
    assert.ok(!parseProductInput({ ...base, source_url: "javascript:alert(1)" }).ok);
    const good = parseProductInput({ ...base, sizes: ["s", "M"], numeric_sizes: "38, 40 ٤٢", age_min: "6", age_max: "9", available: "true", source: "telegram", source_url: "https://t.me/x/1" });
    assert.ok(good.ok);
    if (good.ok) {
      assert.deepEqual(good.value.sizes, ["S", "M"]);
      assert.deepEqual(good.value.numeric_sizes, ["38", "40", "42"]);
      assert.equal(good.value.available, true);
    }
  });
  it("normalises slugs to safe latin url segments", () => {
    assert.equal(normalizeSlug("  Summer Dress_01 "), "summer-dress-01");
    assert.equal(normalizeSlug("فستان"), "");
    assert.equal(normalizeSlug("../../etc"), "etc");
  });
  it("cannot smuggle status / deleted_at / ownership fields through the form", () => {
    const r = parseProductInput({ ...base, status: "published", deleted_at: "x", created_by: UUID });
    assert.ok(r.ok);
    if (r.ok) for (const k of ["status", "deleted_at", "created_by"]) assert.ok(!(k in r.value), k);
  });
});

describe("category validation", () => {
  it("requires a name and generates a slug", () => {
    assert.ok(!parseCategoryInput({ name: "" }).ok);
    const r = parseCategoryInput({ name: "أحذية", is_active: "on" }, { random: () => 0.25 });
    assert.ok(r.ok);
    if (r.ok) {
      assert.match(r.value.slug, /^c-[a-z0-9]{8}$/);
      assert.equal(r.value.is_active, true);
    }
  });
  it("unchecked box means inactive", () => {
    const r = parseCategoryInput({ name: "أحذية" });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.is_active, false);
  });
});

describe("image upload validation", () => {
  const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);
  const jpeg = pad([0xff, 0xd8, 0xff, 0xe0]);
  const png = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const avif = pad([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
  it("recognises real image formats by magic bytes", () => {
    assert.equal(sniffImage(jpeg), "jpeg");
    assert.equal(sniffImage(png), "png");
    assert.equal(sniffImage(webp), "webp");
    assert.equal(sniffImage(avif), "avif");
  });
  it("rejects SVG, GIF, HTML, PDF, scripts and executables even if named .jpg", () => {
    const enc = (s: string) => Uint8Array.from([...new TextEncoder().encode(s), ...new Array(16).fill(32)]);
    for (const s of ["<svg xmlns=", "GIF89a....", "<!DOCTYPE html>", "%PDF-1.7....", "<?php echo 1;", "MZ "]) assert.equal(sniffImage(enc(s)), null, s);
    assert.equal(sniffImage(new Uint8Array(4)), null, "too short");
  });
  it("enforces the size cap and empty files", () => {
    assert.ok(checkUpload(1000, jpeg).ok);
    assert.ok(!checkUpload(0, jpeg).ok);
    assert.ok(!checkUpload(IMAGE_LIMITS.maxBytes + 1, jpeg).ok);
    assert.ok(!checkUpload(1000, enc("<svg")).ok);
    function enc(s: string) {
      return Uint8Array.from([...new TextEncoder().encode(s), ...new Array(16).fill(32)]);
    }
  });
  it("enforces dimensions", () => {
    assert.ok(checkDimensions(800, 1000).ok);
    assert.ok(!checkDimensions(100, 1000).ok);
    assert.ok(!checkDimensions(9000, 900).ok);
    assert.ok(!checkDimensions(7000, 7000).ok, "pixel bomb");
    assert.ok(!checkDimensions(0, 0).ok);
  });
});

describe("reservation status machine", () => {
  it("mirrors the allowed transitions of the database trigger", () => {
    assert.deepEqual([...nextStatuses("pending")].sort(), ["cancelled", "confirmed", "contacted", "rejected"]);
    assert.deepEqual([...nextStatuses("contacted")].sort(), ["cancelled", "confirmed", "rejected"]);
    assert.deepEqual([...nextStatuses("confirmed")].sort(), ["cancelled", "completed"]);
    assert.deepEqual([...nextStatuses("completed")], []);
    assert.deepEqual([...nextStatuses("cancelled")], ["pending"]);
  });
  it("Contacted → Confirmed → Completed is a valid path; skipping or going back is not", () => {
    assert.ok(canTransition("pending", "contacted"));
    assert.ok(canTransition("contacted", "confirmed"));
    assert.ok(canTransition("confirmed", "completed"));
    assert.ok(!canTransition("pending", "completed"));
    assert.ok(!canTransition("completed", "pending"));
    assert.ok(!canTransition("confirmed", "contacted"));
  });
  it("covers every status", () => {
    assert.equal(RESERVATION_STATUSES.length, 6);
    for (const s of ACTIVE_STATUSES) assert.ok(RESERVATION_STATUSES.includes(s));
  });
});

describe("search input sanitising (PostgREST or() safety)", () => {
  it("removes characters that could add filter clauses", () => {
    const out = sanitizeSearchTerm("a,status.eq.completed),phone.ilike.%");
    for (const ch of [",", "(", ")", "%", "*"]) assert.ok(!out.includes(ch), ch);
  });
  it("converts Arabic digits and trims / limits length", () => {
    assert.equal(sanitizeSearchTerm("  ٠٧٧٠١  "), "07701");
    assert.ok(sanitizeSearchTerm("x".repeat(500)).length <= 60);
  });
});

describe("database error mapping", () => {
  it("maps known codes to Arabic and never leaks raw messages", () => {
    assert.match(arabicDbError({ message: "invalid_phone" }), /رقم/);
    assert.match(arabicDbError({ message: "cannot_publish_without_images" }), /صورة/);
    assert.match(arabicDbError({ message: "rate_limited" }), /حاول/);
    assert.equal(arabicDbError({ message: 'relation "secret_table" does not exist' }), "حدث خطأ غير متوقع. حاول مرة أخرى.");
    assert.ok(arabicDbError({ message: "x", code: "23505" }).includes("مستخدمة"));
  });
});

describe("audit log labels", () => {
  it("describes actions in Arabic", () => {
    assert.equal(auditActionLabel("product.hide"), "أخفى منتجاً");
    assert.equal(auditActionLabel("unknown.thing"), "unknown.thing");
    assert.match(auditDetail("reservation.status", { reservation_number: "AB-1", from: "pending", to: "contacted" }), /من جديد إلى تم التواصل/);
    assert.equal(auditDetail("product.create", { name: "فستان" }), "فستان");
  });
});

describe("customer WhatsApp link (admin → customer)", () => {
  it("uses the international number and a prepared Arabic text; nothing is sent by the app", () => {
    const url = customerWhatsappUrl("07701234567", "سارة", "AB-20260920-0001", "حقيبة");
    assert.ok(url.startsWith("https://wa.me/9647701234567?text="));
    assert.match(decodeURIComponent(url), /AB-20260920-0001/);
  });
});

describe("DB row → public product mapping", () => {
  const row = (over: Partial<ProductRow> = {}): ProductRow => ({
    id: UUID,
    slug: "p-1",
    name: "حقيبة",
    description: null,
    price: 9500,
    currency: "IQD",
    price_verified: true,
    size_label: null,
    sizes: [],
    numeric_sizes: [],
    age_min: null,
    age_max: null,
    available: null,
    featured: false,
    source: "manual",
    source_url: null,
    source_published_at: null,
    created_at: "2026-09-01T10:00:00Z",
    category: { slug: "accessories", name: "حقائب", short_name: null },
    subcategory: null,
    images: [
      { id: "b", public_url: "https://x/b.webp", alt_text: null, width: 800, height: 1000, sort_order: 1, is_primary: false },
      { id: "a", public_url: "https://x/a.webp", alt_text: "الرئيسية", width: 800, height: 1000, sort_order: 2, is_primary: true },
    ],
    ...over,
  });
  it("shows a price only when it is verified AND has a currency", () => {
    assert.equal(rowToProduct(row())?.price, 9500);
    assert.equal(rowToProduct(row({ price_verified: false }))?.price, undefined, "imported/unverified prices stay hidden");
    assert.equal(rowToProduct(row({ currency: null }))?.price, undefined);
    assert.equal(rowToProduct(row({ price: null }))?.price, undefined);
  });
  it("puts the primary image first, then follows sort_order", () => {
    assert.deepEqual(rowToProduct(row())?.images.map((i) => i.src), ["https://x/a.webp", "https://x/b.webp"]);
  });
  it("drops products whose category is not visible (inactive)", () => {
    assert.equal(rowToProduct(row({ category: null })), null);
  });
  it("falls back to the created date and keeps unknown availability unknown", () => {
    const p = rowToProduct(row());
    assert.equal(p?.postedAt, "2026-09-01T10:00:00Z");
    assert.equal(p?.available, undefined);
    assert.equal(rowToProduct(row({ available: false }))?.available, false);
  });
  it("maps categories with only active subcategories in admin order", () => {
    const c = rowToCategory({
      id: UUID,
      slug: "kids",
      name: "أطفال",
      short_name: "أطفال",
      description: null,
      image_url: null,
      subcategories: [
        { slug: "b", name: "ب", image_url: null, sort_order: 2, is_active: true },
        { slug: "x", name: "معطل", image_url: null, sort_order: 0, is_active: false },
        { slug: "a", name: "أ", image_url: null, sort_order: 1, is_active: true },
      ],
    });
    assert.deepEqual(c.subcategories.map((s) => s.id), ["a", "b"]);
  });
});

describe("homepage category cards follow the live category list", () => {
  it("keeps curated cards for active categories and drops deactivated ones", () => {
    const active = CATEGORIES.filter((c) => c.id !== "stationery");
    const { main, more } = buildHomeCards(active);
    assert.ok(main.some((c) => c.key === "women"));
    assert.ok(!main.some((c) => c.key === "stationery"));
    assert.ok(more.some((c) => c.key === "accessories"));
  });
  it("prefers an admin-uploaded cover and appends admin-created categories", () => {
    const cats = [
      ...CATEGORIES.map((c) => (c.id === "women" ? { ...c, image: "https://cdn/x.webp" } : c)),
      { id: "shoes", name: "أحذية", description: "أحذية للجميع", subcategories: [] },
    ];
    const { main, more } = buildHomeCards(cats);
    assert.equal(main.find((c) => c.key === "women")?.cover, "https://cdn/x.webp");
    assert.ok(more.some((c) => c.href === "/products?category=shoes"));
  });
});
