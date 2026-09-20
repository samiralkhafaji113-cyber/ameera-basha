/**
 * Catalog migration: static catalog (src/data/catalog.generated.json + public/products/**) → Supabase.
 *
 *   tsx --env-file=.env.local scripts/seed-catalog.mts                                  (local stack)
 *   tsx --env-file=.env.production.local scripts/seed-catalog.mts --allow-remote        (hosted project, first import)
 *
 * SAFE TO RE-RUN. It only INSERTS what is missing (matched by source + source_post_id, and by category slug):
 *  - existing products / categories are never updated (admin edits are never overwritten),
 *  - products keep their source / source_url / source_post_id / published date,
 *  - images are uploaded to Storage once (deterministic paths) and registered once.
 * Currency was never confirmed by the owner, so prices are stored with currency = NULL and
 * price_verified = FALSE (the public site then shows «السعر عند الاستفسار» until the admin confirms).
 *
 * Prints a Before/After comparison and exits with code 1 if anything is missing.
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, HOME_CATEGORY_CARDS, MORE_SECTIONS } from "../src/data/categories";
import type { Product } from "../src/types/product";
import { flag, operatorTarget } from "./lib/operator.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, isLocal, args } = operatorTarget("Catalog migration (72 products + images)");
const BUCKET = "store-media";

const products = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/catalog.generated.json"), "utf8")) as Product[];

// ---------------------------------------------------------------- BEFORE
const before = {
  products: products.length,
  images: products.reduce((n, p) => n + p.images.length, 0),
  withPrice: products.filter((p) => p.price !== undefined).length,
  withoutPrice: products.filter((p) => p.price === undefined).length,
  byCategory: Object.fromEntries(CATEGORIES.map((c) => [c.id, products.filter((p) => p.category === c.id).length])) as Record<string, number>,
  duplicateSlugs: products.length - new Set(products.map((p) => p.slug)).size,
  duplicatePosts: products.length - new Set(products.map((p) => p.sourceUrl)).size,
};
console.log("BEFORE", JSON.stringify(before));
const { count: alreadyImported } = await db.from("products").select("id", { count: "exact", head: true }).eq("source", "telegram");
const firstRun = (alreadyImported ?? 0) === 0;
if (!firstRun && !isLocal && !flag(args, "yes")) {
  throw new Error(
    `The hosted project already contains ${alreadyImported} imported products. Re-running only INSERTS missing ones – but a product an admin permanently deleted would come back. Pass --yes to continue.`,
  );
}
if (before.duplicateSlugs || before.duplicatePosts) throw new Error("duplicate products in the source catalog – aborting");

async function upload(storagePath: string, file: string): Promise<string> {
  const buf = fs.readFileSync(file);
  const { error } = await db.storage.from(BUCKET).upload(storagePath, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// ---------------------------------------------------------------- categories
const coverByKey = new Map([...HOME_CATEGORY_CARDS, ...MORE_SECTIONS].map((c) => [c.key, c.cover]));
const categoryCover = (slug: string) => coverByKey.get(slug) ?? (slug === "kids" ? coverByKey.get("girls") : undefined);

const { data: existingCats } = await db.from("categories").select("id, slug");
const catIds = new Map((existingCats ?? []).map((c) => [c.slug as string, c.id as string]));

for (const [i, c] of CATEGORIES.entries()) {
  if (catIds.has(c.id)) continue;
  const cover = categoryCover(c.id);
  let imagePath: string | null = null;
  let imageUrl: string | null = null;
  if (cover) {
    imagePath = `categories/${c.id}.webp`;
    imageUrl = await upload(imagePath, path.join(ROOT, "public", cover));
  }
  const { data, error } = await db
    .from("categories")
    .insert({ slug: c.id, name: c.name, short_name: c.shortName ?? null, description: c.description, sort_order: (i + 1) * 10, image_path: imagePath, image_url: imageUrl })
    .select("id")
    .single();
  if (error) throw error;
  catIds.set(c.id, data.id);
}

const { data: existingSubs } = await db.from("subcategories").select("id, slug, category_id");
const subIds = new Map((existingSubs ?? []).map((s) => [`${s.category_id}/${s.slug}`, s.id as string]));
for (const c of CATEGORIES) {
  for (const [i, s] of c.subcategories.entries()) {
    const k = `${catIds.get(c.id)}/${s.id}`;
    if (subIds.has(k)) continue;
    const cover = s.id === "girls" || s.id === "boys" ? coverByKey.get(s.id) : undefined;
    let imagePath: string | null = null;
    let imageUrl: string | null = null;
    if (cover) {
      imagePath = `categories/${c.id}-${s.id}.webp`;
      imageUrl = await upload(imagePath, path.join(ROOT, "public", cover));
    }
    const { data, error } = await db
      .from("subcategories")
      .insert({ category_id: catIds.get(c.id), slug: s.id, name: s.name, sort_order: (i + 1) * 10, image_path: imagePath, image_url: imageUrl })
      .select("id")
      .single();
    if (error) throw error;
    subIds.set(k, data.id);
  }
}

// ---------------------------------------------------------------- products (insert-only)
const { data: existing } = await db.from("products").select("id, source_post_id").eq("source", "telegram");
const known = new Map((existing ?? []).map((p) => [p.source_post_id as string, p.id as string]));
const fresh = products.filter((p) => !known.has(p.slug));
console.log(`products already in DB: ${known.size} · to insert: ${fresh.length}`);

const created: { id: string; p: Product }[] = [];
for (let i = 0; i < fresh.length; i += 25) {
  const chunk = fresh.slice(i, i + 25);
  const rows = chunk.map((p) => ({
    name: p.name,
    slug: p.slug,
    category_id: catIds.get(p.category)!,
    subcategory_id: subIds.get(`${catIds.get(p.category)}/${p.subcategory}`) ?? null,
    description: p.description ?? null,
    price: p.price ?? null,
    currency: null, // NOT confirmed by the owner – never assumed
    price_verified: false,
    size_label: p.sizeLabel ?? null,
    sizes: p.sizes ?? [],
    numeric_sizes: p.numericSizes ?? [],
    age_min: p.ageRange?.minYears ?? null,
    age_max: p.ageRange?.maxYears ?? null,
    available: p.available === true ? true : null,
    featured: p.featured ?? false,
    status: "draft", // published after the images exist (DB rule: no publishing without images)
    source: "telegram",
    source_url: p.sourceUrl ?? null,
    source_post_id: p.slug,
    source_published_at: p.postedAt,
  }));
  const { data, error } = await db.from("products").insert(rows).select("id, source_post_id");
  if (error) throw error;
  for (const r of data) created.push({ id: r.id, p: chunk.find((c) => c.slug === r.source_post_id)! });
}

// ---------------------------------------------------------------- images
let imagesInserted = 0;
for (const { id, p } of created) {
  const rows = [];
  for (const [i, img] of p.images.entries()) {
    const storagePath = `products/${p.slug}/${i + 1}.webp`;
    const publicUrl = await upload(storagePath, path.join(ROOT, "public", img.src));
    rows.push({
      product_id: id,
      storage_path: storagePath,
      public_url: publicUrl,
      alt_text: i === 0 ? p.name : `${p.name} – صورة ${i + 1}`,
      width: img.width,
      height: img.height,
      sort_order: i,
      is_primary: i === 0,
    });
  }
  const { error } = await db.from("product_images").insert(rows);
  if (error) throw error;
  imagesInserted += rows.length;
}
if (created.length) {
  const { error } = await db.from("products").update({ status: "published" }).in("id", created.map((c) => c.id));
  if (error) throw error;
}
console.log(`inserted products: ${created.length} · images: ${imagesInserted}`);

// ---------------------------------------------------------------- AFTER + comparison
const { data: rows, error: afterErr } = await db
  .from("products")
  .select("id, slug, price, status, source, source_url, source_post_id, source_published_at, category:categories(slug), images:product_images(id)")
  .eq("source", "telegram")
  .limit(5000);
if (afterErr) throw afterErr;
const imagesAfter = rows.reduce((n, r) => n + (r.images as unknown[]).length, 0);
const after = {
  products: rows.length,
  images: imagesAfter,
  withPrice: rows.filter((r) => r.price !== null).length,
  withoutPrice: rows.filter((r) => r.price === null).length,
  byCategory: Object.fromEntries(CATEGORIES.map((c) => [c.id, rows.filter((r) => (r.category as unknown as { slug: string } | null)?.slug === c.id).length])) as Record<string, number>,
  duplicatePostIds: rows.length - new Set(rows.map((r) => r.source_post_id)).size,
  published: rows.filter((r) => r.status === "published").length,
  missingSourceInfo: rows.filter((r) => !r.source_url || !r.source_post_id || !r.source_published_at).length,
};
console.log("AFTER ", JSON.stringify(after));

const missing = products.filter((p) => !rows.some((r) => r.source_post_id === p.slug)).map((p) => p.slug);
// First import: exact before/after equality. Later re-runs: admins may legitimately have hidden, re-priced or deleted things,
// so only the invariants that must always hold are enforced (nothing missing, no duplicates, source info kept).
const checks: [string, boolean][] = firstRun
  ? [
      ["products before = after", before.products === after.products],
      ["images before = after", before.images === after.images],
      ["priced products preserved", before.withPrice === after.withPrice && before.withoutPrice === after.withoutPrice],
      ["per-category counts preserved", JSON.stringify(before.byCategory) === JSON.stringify(after.byCategory)],
      ["no duplicates", after.duplicatePostIds === 0],
      ["no missing records", missing.length === 0],
      ["all published (as before)", after.published === before.products],
      ["source url / post id / date kept on every product", after.missingSourceInfo === 0],
    ]
  : [
      ["no missing records", missing.length === 0],
      ["no duplicates", after.duplicatePostIds === 0],
      ["source url / post id / date kept on every product", after.missingSourceInfo === 0],
    ];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);

fs.writeFileSync(
  path.join(ROOT, "supabase/migration-report.json"),
  JSON.stringify({ ranAt: new Date().toISOString(), before, after, missing, checks: Object.fromEntries(checks) }, null, 2) + "\n",
);
if (checks.some(([, ok]) => !ok)) {
  console.error("MIGRATION VERIFICATION FAILED");
  process.exit(1);
}
console.log("Migration verified: no data lost.");
