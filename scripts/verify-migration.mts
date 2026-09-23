/**
 * Migration verification: compares the ORIGINAL local sources (src/data/catalog.generated.json + public/products/**)
 * with what is actually in the target Supabase project (database rows + Storage objects + public URLs).
 *
 *   tsx --env-file=.env.local scripts/verify-migration.mts
 *   tsx --env-file=.env.production.local scripts/verify-migration.mts --allow-remote [--baseline supabase/local-audit.json]
 *
 * Reports: Images local / Supabase, Missing, Duplicate, Primary missing, Broken URLs. Exits 1 if ANYTHING is missing or
 * broken – a migration with a lost image is never declared successful. Read-only.
 */
import fs from "node:fs";
import path from "node:path";
import type { Product } from "../src/types/product";
import { operatorTarget, option } from "./lib/operator.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, args } = operatorTarget("Migration verification (read-only)");

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/catalog.generated.json"), "utf8")) as Product[];
const localImages = catalog.flatMap((p) => p.images.map((img, i) => ({ post: p.slug, n: i + 1, file: path.join(ROOT, "public", img.src) })));
const localFilesMissing = localImages.filter((i) => !fs.existsSync(i.file));

const { data: products, error } = await db
  .from("products")
  .select("id, slug, source_post_id, source_url, name, status, product_images(id, storage_path, public_url, is_primary, sort_order)")
  .eq("source", "telegram")
  .limit(5000);
if (error) throw error;

type Row = { id: string; source_post_id: string; product_images: { id: string; storage_path: string; public_url: string; is_primary: boolean; sort_order: number }[] };
const rows = (products ?? []) as unknown as Row[];
const byPost = new Map(rows.map((r) => [r.source_post_id, r]));

const missingProducts = catalog.filter((p) => !byPost.has(p.slug)).map((p) => p.slug);
const duplicateProducts = rows.length - new Set(rows.map((r) => r.source_post_id)).size;

const remotePaths = rows.flatMap((r) => r.product_images.map((i) => i.storage_path));
const duplicateImages = remotePaths.length - new Set(remotePaths).size;

// every local image must exist remotely under its deterministic path
const missingImages: string[] = [];
for (const img of localImages) {
  const row = byPost.get(img.post);
  const expected = `products/${img.post}/${img.n}.webp`;
  if (!row || !row.product_images.some((i) => i.storage_path === expected)) missingImages.push(expected);
}

const primaryMissing = rows.filter((r) => r.product_images.length > 0 && r.product_images.filter((i) => i.is_primary).length !== 1).map((r) => r.source_post_id);
const noImages = rows.filter((r) => r.product_images.length === 0).map((r) => r.source_post_id);

// storage objects + public URLs: HEAD every URL (bounded concurrency), must be 200 image/webp and a non-trivial size.
// Retries transient 429s / network hiccups (CDN burst rate-limiting right after a large upload, or a flaky local
// connection pool) a few times with backoff before calling a URL broken, so those don't masquerade as data loss.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const urls = rows.flatMap((r) => r.product_images.map((i) => ({ url: i.public_url, path: i.storage_path })));
const broken: string[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < urls.length) {
      const { url, path: p } = urls[next++];
      let lastErr = "";
      let done = false;
      for (let attempt = 1; attempt <= 6 && !done; attempt++) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          if ((res.status === 429 || res.status >= 500) && attempt < 6) {
            lastErr = String(res.status);
            await sleep(attempt * 600);
            continue;
          }
          const type = res.headers.get("content-type") ?? "";
          const size = Number(res.headers.get("content-length") ?? 0);
          if (!res.ok || !type.includes("image/webp") || size < 500) broken.push(`${p} (${res.status} ${type} ${size}B)`);
          done = true;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : "unreachable";
          if (attempt < 6) await sleep(attempt * 600);
        }
      }
      if (!done) broken.push(`${p} (${lastErr || "unreachable"} after retries)`);
    }
  }),
);

const result = {
  productsLocal: catalog.length,
  productsInSupabase: rows.length,
  imagesLocal: localImages.length,
  imagesSupabase: remotePaths.length,
  missingProducts,
  missingImages,
  duplicateProducts,
  duplicateImages,
  primaryImageMissingOrAmbiguous: primaryMissing,
  productsWithoutImages: noImages,
  brokenUrls: broken,
  localSourceFilesMissing: localFilesMissing.map((f) => f.file),
};

const baseline = option(args, "baseline");
const baselineNotes: string[] = [];
if (baseline && fs.existsSync(baseline)) {
  const b = JSON.parse(fs.readFileSync(baseline, "utf8")) as { products: { total: number }; images: number };
  if (rows.length < b.products.total) baselineNotes.push(`products (${rows.length}) < baseline (${b.products.total})`);
  if (remotePaths.length < b.images) baselineNotes.push(`images (${remotePaths.length}) < baseline (${b.images})`);
}

console.log(JSON.stringify(result, null, 2));
const ok =
  result.missingProducts.length === 0 &&
  result.missingImages.length === 0 &&
  result.duplicateProducts === 0 &&
  result.duplicateImages === 0 &&
  result.primaryImageMissingOrAmbiguous.length === 0 &&
  result.productsWithoutImages.length === 0 &&
  result.brokenUrls.length === 0 &&
  result.localSourceFilesMissing.length === 0 &&
  baselineNotes.length === 0 &&
  result.productsInSupabase >= result.productsLocal &&
  result.imagesSupabase >= result.imagesLocal;
for (const n of baselineNotes) console.error("BASELINE:", n);
console.log(ok ? "\nPASS – every product and image is present, unique and reachable." : "\nFAIL – see the lists above. Do NOT declare the migration successful.");
process.exit(ok ? 0 : 1);
