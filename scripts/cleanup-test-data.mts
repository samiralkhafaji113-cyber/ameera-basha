/**
 * Removes the labelled TEST data created by scripts/e2e-smoke.mts (operator only, service role):
 *   - reservations whose customer_name starts with "TEST E2E"
 *   - products whose name starts with "TEST-E2E-" (and their image files)
 * Anything else is left alone. Dry run by default; add --apply to delete.
 *
 *   tsx --env-file=.env.production.local scripts/cleanup-test-data.mts --allow-remote [--apply]
 */
import { flag, operatorTarget } from "./lib/operator.mts";

const { db, args } = operatorTarget("Cleanup of automated TEST data");
const apply = flag(args, "apply");

const { data: reservations } = await db.from("reservations").select("id, reservation_number").like("customer_name", "TEST E2E%");
const { data: products } = await db.from("products").select("id, name").like("name", "TEST-E2E-%");
console.log(`test reservations: ${reservations?.length ?? 0} · test products: ${products?.length ?? 0}${apply ? "" : "  (dry run – add --apply)"}`);

if (apply) {
  for (const p of products ?? []) {
    const { data: imgs } = await db.from("product_images").select("storage_path").eq("product_id", p.id);
    if (imgs?.length) await db.storage.from("store-media").remove(imgs.map((i) => i.storage_path));
    await db.from("products").delete().eq("id", p.id);
  }
  if (reservations?.length) await db.from("reservations").delete().in("id", reservations.map((r) => r.id));
  console.log("deleted.");
}
