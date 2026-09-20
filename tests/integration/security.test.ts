import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { anon, cleanup, dropStaff, makeProduct, makeStaff, service, signedIn, uniquePhone } from "./helpers";

/** Security: what the anonymous role and the lowest staff role can and cannot do (RLS, grants, triggers, storage). */
const svc = service();
let published: { id: string; slug: string; name: string };
let hidden: { id: string; slug: string; name: string };
let draft: { id: string; slug: string; name: string };
let trashed: { id: string; slug: string; name: string };
let reservationId: string;

before(async () => {
  await cleanup(svc);
  published = await makeProduct(svc, { status: "published" });
  hidden = await makeProduct(svc, { status: "hidden" });
  draft = await makeProduct(svc, { status: "draft" });
  trashed = await makeProduct(svc, { status: "published" });
  await svc.from("products").update({ deleted_at: new Date().toISOString(), status: "hidden" }).eq("id", trashed.id);
  const { data, error } = await anon().rpc("create_reservation", {
    p_product_id: published.id,
    p_customer_name: "اختبار أمني",
    p_phone: uniquePhone(),
    p_governorate: "بابل",
    p_district: "الحلة",
  });
  assert.equal(error, null);
  reservationId = (Array.isArray(data) ? data[0] : data).id;
});
after(async () => cleanup(svc));

describe("anonymous visitors (public site)", () => {
  it("see published, non-deleted products only", async () => {
    const { data } = await anon().from("products").select("id, status").like("name", "ZZTEST%");
    assert.deepEqual((data ?? []).map((p) => p.id), [published.id]);
  });
  it("cannot read a hidden / draft / trashed product by id or slug", async () => {
    for (const p of [hidden, draft, trashed]) {
      const { data } = await anon().from("products").select("id").eq("id", p.id);
      assert.equal(data?.length, 0, `${p.slug} leaked`);
      const bySlug = await anon().from("products").select("id").eq("slug", p.slug);
      assert.equal(bySlug.data?.length, 0);
    }
  });
  it("see images only of published products", async () => {
    const ok = await anon().from("product_images").select("id").eq("product_id", published.id);
    assert.ok((ok.data?.length ?? 0) > 0);
    for (const p of [hidden, draft, trashed]) {
      const r = await anon().from("product_images").select("id").eq("product_id", p.id);
      assert.equal(r.data?.length, 0);
    }
  });
  it("see only active categories", async () => {
    const { data: cat } = await svc.from("categories").insert({ slug: `zztest-${Date.now()}`, name: "ZZTEST قسم معطل", is_active: false }).select("id").single();
    const r = await anon().from("categories").select("id").eq("id", cat!.id);
    assert.equal(r.data?.length, 0);
    await svc.from("categories").delete().eq("id", cat!.id);
  });
  it("cannot read reservations, audit logs, profiles or the counters table", async () => {
    for (const table of ["reservations", "audit_logs", "profiles", "reservation_counters"]) {
      const r = await anon().from(table).select("*").limit(5);
      assert.ok(r.error !== null || (r.data ?? []).length === 0, `${table} readable by anon`);
    }
  });
  it("cannot insert, update or delete products, categories, images or reservations directly", async () => {
    const a = anon();
    const ins = await a.from("products").insert({ name: "hack", slug: "hack", category_id: "00000000-0000-0000-0000-000000000000" });
    assert.ok(ins.error, "product insert allowed");
    const upd = await a.from("products").update({ name: "hacked" }).eq("id", published.id).select();
    assert.ok(upd.error || (upd.data ?? []).length === 0, "product update allowed");
    const del = await a.from("products").delete().eq("id", published.id).select();
    assert.ok(del.error || (del.data ?? []).length === 0, "product delete allowed");
    const cat = await a.from("categories").update({ name: "hacked" }).eq("slug", "women").select();
    assert.ok(cat.error || (cat.data ?? []).length === 0, "category update allowed");
    const img = await a.from("product_images").delete().eq("product_id", published.id).select();
    assert.ok(img.error || (img.data ?? []).length === 0, "image delete allowed");
    const res = await a.from("reservations").insert({ reservation_number: "AB-HACK", product_name_snapshot: "x", customer_name: "xx", phone: "07700000000", governorate: "بابل", district: "xx" });
    assert.ok(res.error, "direct reservation insert allowed (must go through create_reservation)");
    const resUpd = await a.from("reservations").update({ status: "completed" }).eq("id", reservationId).select();
    assert.ok(resUpd.error || (resUpd.data ?? []).length === 0, "reservation update allowed");
    const after = await svc.from("products").select("name").eq("id", published.id).single();
    assert.notEqual(after.data?.name, "hacked");
  });
  it("cannot call admin-only functions", async () => {
    const r = await anon().rpc("confirm_prices_currency", { p_currency: "IQD" });
    assert.ok(r.error, "confirm_prices_currency callable by anon");
    const s = await anon().rpc("set_primary_image", { p_image_id: "00000000-0000-0000-0000-000000000000" });
    assert.ok(s.error, "set_primary_image callable by anon");
    const g = await anon().rpc("reorder_product_images", { p_product_id: published.id, p_ids: [] });
    assert.ok(g.error, "reorder_product_images callable by anon");
  });
  it("cannot reach the private `app` schema", async () => {
    const r = await anon().schema("app" as never).from("anything").select("*").limit(1);
    assert.ok(r.error, "app schema exposed");
  });
});

describe("storage bucket store-media", () => {
  it("is public-read but anon cannot upload, overwrite, delete or list", async () => {
    const a = anon();
    const up = await a.storage.from("store-media").upload(`products/zztest-${Date.now()}.webp`, new Blob([new Uint8Array(20)], { type: "image/webp" }));
    assert.ok(up.error, "anon upload allowed");
    const list = await a.storage.from("store-media").list("products");
    assert.ok(list.error || (list.data ?? []).length === 0, "anon can list objects");
    const del = await a.storage.from("store-media").remove(["products/zztest.webp"]);
    assert.ok(del.error || (del.data ?? []).length === 0);
  });
  it("rejects non-WebP files and oversized files even for the service role (bucket limits)", async () => {
    const svg = await svc.storage.from("store-media").upload(`zztest/${Date.now()}.svg`, new Blob(["<svg onload=alert(1)/>"], { type: "image/svg+xml" }));
    assert.ok(svg.error, "svg accepted by the bucket");
    const html = await svc.storage.from("store-media").upload(`zztest/${Date.now()}.html`, new Blob(["<script>1</script>"], { type: "text/html" }));
    assert.ok(html.error, "html accepted by the bucket");
    const big = await svc.storage.from("store-media").upload(`zztest/${Date.now()}.webp`, new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/webp" }));
    assert.ok(big.error, "3 MiB file accepted (limit is 2 MiB)");
  });
});

describe("an editor (lowest staff role)", () => {
  it("cannot publish, archive or delete, and cannot read reservations or audit logs", async () => {
    const editor = await signedIn("editor");
    const pub = await editor.from("products").update({ status: "published" }).eq("id", draft.id).select();
    assert.ok(pub.error, "editor published a product");
    const arc = await editor.from("products").update({ status: "archived" }).eq("id", published.id).select();
    assert.ok(arc.error, "editor archived a product");
    const del = await editor.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", published.id).select();
    assert.ok(del.error, "editor soft-deleted a product");
    const purge = await editor.from("products").delete().eq("id", hidden.id).select();
    assert.ok(purge.error || (purge.data ?? []).length === 0, "editor purged a product");
    const res = await editor.from("reservations").select("id");
    assert.ok(res.error || (res.data ?? []).length === 0, "editor reads reservations");
    const audit = await editor.from("audit_logs").select("id");
    assert.ok(audit.error || (audit.data ?? []).length === 0, "editor reads audit logs");
    const cat = await editor.from("categories").update({ name: "x" }).eq("slug", "women").select();
    assert.ok(cat.error || (cat.data ?? []).length === 0, "editor edits categories");
    const confirm = await editor.rpc("confirm_prices_currency", { p_currency: "IQD" });
    assert.ok(confirm.error, "editor confirmed prices");
  });
  it("can edit product content and sees drafts/hidden products (staff view)", async () => {
    const editor = await signedIn("editor");
    const upd = await editor.from("products").update({ description: "وصف من المحرر" }).eq("id", draft.id).select("id");
    assert.equal(upd.error, null);
    assert.equal(upd.data?.length, 1);
    const seen = await editor.from("products").select("id").in("id", [draft.id, hidden.id]);
    assert.equal(seen.data?.length, 2);
  });
  it("cannot change their own role or read other staff profiles", async () => {
    const editor = await signedIn("editor");
    const { data: me } = await editor.auth.getUser();
    const self = await editor.from("profiles").update({ role: "admin" }).eq("id", me.user!.id).select();
    assert.ok(self.error || (self.data ?? []).length === 0, "editor self-promoted");
    const list = await editor.from("profiles").select("id");
    assert.equal(list.data?.length, 1, "editor can list all profiles");
  });
});

describe("admin", () => {
  it("can read reservations and the audit log", async () => {
    const admin = await signedIn("admin");
    const res = await admin.from("reservations").select("id").eq("id", reservationId);
    assert.equal(res.data?.length, 1);
    const audit = await admin.from("audit_logs").select("id").limit(1);
    assert.equal(audit.error, null);
    assert.ok((audit.data ?? []).length > 0);
  });
  it("cannot forge or delete audit logs (no insert/update/delete policy)", async () => {
    const admin = await signedIn("admin");
    const ins = await admin.from("audit_logs").insert({ action: "forged", entity_type: "x" });
    assert.ok(ins.error, "audit insert allowed");
    const del = await admin.from("audit_logs").delete().eq("action", "product.create").select();
    assert.ok(del.error || (del.data ?? []).length === 0, "audit delete allowed");
    const upd = await admin.from("audit_logs").update({ action: "x" }).eq("action", "product.create").select();
    assert.ok(upd.error || (upd.data ?? []).length === 0, "audit update allowed");
  });
  it("can change only status and admin_notes of a reservation (column grants)", async () => {
    const admin = await signedIn("admin");
    const bad = await admin.from("reservations").update({ customer_name: "مزوّر" }).eq("id", reservationId).select();
    assert.ok(bad.error, "admin rewrote customer data");
    const ok = await admin.from("reservations").update({ admin_notes: "ملاحظة" }).eq("id", reservationId).select("id");
    assert.equal(ok.error, null);
  });
});

describe("a manager", () => {
  it("can publish, hide, feature, soft-delete, manage categories and reservations – but not purge, read audit logs or confirm prices", async () => {
    const { client, userId } = await makeStaff(svc, "manager");
    try {
      const p = await makeProduct(svc, {}, 1);
      assert.equal((await client.from("products").update({ status: "published", featured: true }).eq("id", p.id).select("id")).error, null, "manager cannot publish");
      assert.equal((await client.from("products").update({ status: "hidden" }).eq("id", p.id).select("id")).error, null);
      assert.equal((await client.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", p.id).select("id")).error, null, "manager cannot soft-delete");
      const purge = await client.from("products").delete().eq("id", p.id).select("id");
      assert.ok(purge.error || (purge.data ?? []).length === 0, "manager purged a product");
      const res = await client.from("reservations").select("id").eq("id", reservationId);
      assert.equal(res.data?.length, 1, "manager cannot read reservations");
      const audit = await client.from("audit_logs").select("id");
      assert.ok(audit.error || (audit.data ?? []).length === 0, "manager reads audit logs");
      const price = await client.rpc("confirm_prices_currency", { p_currency: "IQD" });
      assert.ok(price.error, "manager confirmed prices");
      const { data: cat } = await svc.from("categories").insert({ slug: `zztest-${Date.now()}`, name: "ZZTEST قسم" }).select("id").single();
      const catUpd = await client.from("categories").update({ name: "ZZTEST قسم معدّل" }).eq("id", cat!.id).select("id");
      assert.equal(catUpd.data?.length, 1, "manager cannot edit categories");
      await svc.from("categories").delete().eq("id", cat!.id);
    } finally {
      await dropStaff(svc, userId);
    }
  });
});
