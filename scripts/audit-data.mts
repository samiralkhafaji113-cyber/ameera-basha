/**
 * Data-integrity snapshot of a Supabase target (Phase "Data Integrity"): run it on the LOCAL database BEFORE migrating
 * and on the hosted project AFTER, then compare the two files.
 *
 *   tsx --env-file=.env.local scripts/audit-data.mts --out supabase/local-audit.json
 *   tsx --env-file=.env.production.local scripts/audit-data.mts --allow-remote --out backups/production-audit.json
 *
 * Read-only. Prints counts only (no customer data).
 */
import fs from "node:fs";
import path from "node:path";
import { operatorTarget, option } from "./lib/operator.mts";

const { db, host, isLocal, args } = operatorTarget("Data audit (read-only)");

type Filter = (q: ReturnType<ReturnType<typeof db.from>["select"]>) => unknown;
const count = async (table: string, apply: Filter = (q) => q): Promise<number> => {
  const { count: n, error } = (await apply(db.from(table).select("id", { count: "exact", head: true }))) as { count: number | null; error: { message: string } | null };
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
};

const products = await count("products");
const byStatus: Record<string, number> = {};
for (const s of ["draft", "published", "hidden", "archived"]) byStatus[s] = await count("products", (q) => q.eq("status", s).is("deleted_at", null));
const trashed = await count("products", (q) => q.not("deleted_at", "is", null));

const { data: cats } = await db.from("categories").select("id, slug, is_active");
const byCategory: Record<string, number> = {};
for (const c of cats ?? []) byCategory[c.slug] = await count("products", (q) => q.eq("category_id", c.id).is("deleted_at", null));

const { data: primaryRows } = await db.from("product_images").select("product_id").eq("is_primary", true).limit(20000);
const withPrimary = new Set((primaryRows ?? []).map((r) => r.product_id)).size;

const audit = {
  target: host,
  local: isLocal,
  takenAt: new Date().toISOString(),
  products: { total: products, ...byStatus, trashed },
  productsByCategory: byCategory,
  images: await count("product_images"),
  productsWithPrimaryImage: withPrimary,
  prices: {
    withPrice: await count("products", (q) => q.not("price", "is", null).is("deleted_at", null)),
    withoutPrice: await count("products", (q) => q.is("price", null).is("deleted_at", null)),
    verified: await count("products", (q) => q.eq("price_verified", true).is("deleted_at", null)),
    unverified: await count("products", (q) => q.not("price", "is", null).eq("price_verified", false).is("deleted_at", null)),
  },
  categories: cats?.length ?? 0,
  reservations: await count("reservations"),
  auditLogRows: await count("audit_logs"),
  staffProfiles: await count("profiles"),
};

console.log(JSON.stringify(audit, null, 2));
const out = option(args, "out");
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(audit, null, 2) + "\n");
  console.log(`saved → ${out}`);
}
