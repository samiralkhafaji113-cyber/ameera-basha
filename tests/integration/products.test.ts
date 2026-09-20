import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { anon, cleanup, firstCategory, makeProduct, service, signedIn, uid } from "./helpers";

/** Products: create / update / hide / publish / archive / trash / image ordering / audit trail – through a real admin session. */
const svc = service();

before(async () => cleanup(svc));
after(async () => cleanup(svc));

async function newDraft(admin: Awaited<ReturnType<typeof signedIn>>, extra: Record<string, unknown> = {}) {
  const cat = await firstCategory(svc);
  const slug = `zztest-${uid()}`;
  const r = await admin.from("products").insert({ name: `ZZTEST ${slug}`, slug, category_id: cat.id, ...extra }).select("id, slug, status").single();
  assert.equal(r.error, null, r.error?.message);
  return r.data!;
}
const addImage = (c: Awaited<ReturnType<typeof signedIn>>, productId: string, order: number) => {
  const path = `products/${productId}/${randomUUID()}.webp`;
  return c.from("product_images").insert({ product_id: productId, storage_path: path, public_url: `http://127.0.0.1/${path}`, sort_order: order, width: 800, height: 1000 }).select("id, is_primary").single();
};

describe("product lifecycle (admin)", () => {
  it("creates a draft, stamps the creator and derives searchable text", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin, { description: "فستان أنيق" });
    assert.equal(p.status, "draft");
    const row = await svc.from("products").select("created_by, search_text, price_verified, currency").eq("id", p.id).single();
    assert.ok(row.data?.created_by, "created_by not stamped");
    assert.match(row.data!.search_text, /فستان/);
    assert.equal(row.data!.price_verified, false);
    assert.equal(row.data!.currency, null, "currency must never be assumed");
  });

  it("refuses to publish without images (insert and update) and to create directly as published", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin);
    const pub = await admin.from("products").update({ status: "published" }).eq("id", p.id);
    assert.equal(pub.error?.message, "cannot_publish_without_images");
    const cat = await firstCategory(svc);
    const direct = await admin.from("products").insert({ name: "ZZTEST direct", slug: `zztest-${uid()}`, category_id: cat.id, status: "published" });
    assert.equal(direct.error?.message, "cannot_publish_without_images");
  });

  it("publishes after an image is added; the first image becomes primary", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin);
    const img = await addImage(admin, p.id, 1);
    // the AFTER INSERT trigger flips the flag, so read it back instead of trusting RETURNING
    const stored = await admin.from("product_images").select("is_primary").eq("id", img.data!.id).single();
    assert.equal(stored.data?.is_primary, true);
    const pub = await admin.from("products").update({ status: "published" }).eq("id", p.id).select("status").single();
    assert.equal(pub.data?.status, "published");
    const visible = await anon().from("products").select("id").eq("id", p.id);
    assert.equal(visible.data?.length, 1, "published product not visible to visitors");
  });

  it("hide removes it from the public immediately, publish brings it back", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ status: "hidden" }).eq("id", p.id);
    assert.equal((await anon().from("products").select("id").eq("id", p.id)).data?.length, 0);
    await admin.from("products").update({ status: "published" }).eq("id", p.id);
    assert.equal((await anon().from("products").select("id").eq("id", p.id)).data?.length, 1);
  });

  it("archive hides it; restore-as-draft works; soft delete keeps data, restore brings it back hidden", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ status: "archived" }).eq("id", p.id);
    assert.equal((await anon().from("products").select("id").eq("id", p.id)).data?.length, 0);
    await admin.from("products").update({ status: "draft" }).eq("id", p.id);
    await admin.from("products").update({ deleted_at: new Date().toISOString(), status: "hidden" }).eq("id", p.id);
    const kept = await admin.from("products").select("id, deleted_at").eq("id", p.id).single();
    assert.ok(kept.data?.deleted_at, "soft delete did not keep the row");
    const imgs = await svc.from("product_images").select("id").eq("product_id", p.id);
    assert.equal(imgs.data?.length, 1, "images must survive a soft delete");
    await admin.from("products").update({ deleted_at: null }).eq("id", p.id);
    const back = await admin.from("products").select("status, deleted_at").eq("id", p.id).single();
    assert.equal(back.data?.deleted_at, null);
    assert.equal(back.data?.status, "hidden");
  });

  it("enforces unique slugs and the subcategory/category match", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin);
    const cat = await firstCategory(svc);
    const dup = await admin.from("products").insert({ name: "ZZTEST dup", slug: p.slug, category_id: cat.id });
    assert.equal(dup.error?.code, "23505");
    const wrongSub = await admin.from("products").update({ subcategory_id: cat.otherSubId }).eq("id", p.id);
    assert.equal(wrongSub.error?.message, "subcategory_mismatch");
  });

  it("does not allow a verified price without a currency", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin);
    const bad = await admin.from("products").update({ price: 5000, price_verified: true }).eq("id", p.id);
    assert.ok(bad.error, "verified price without currency accepted");
    const good = await admin.from("products").update({ price: 5000, currency: "IQD", price_verified: true }).eq("id", p.id);
    assert.equal(good.error, null);
  });

  it("only the admin can permanently delete", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, {}, 1);
    const del = await admin.from("products").delete().eq("id", p.id).select("id");
    assert.equal(del.data?.length, 1);
    const left = await svc.from("product_images").select("id").eq("product_id", p.id);
    assert.equal(left.data?.length, 0, "image rows must cascade");
  });
});

describe("product images", () => {
  it("reorders images with the RPC and rejects lists that omit or add ids", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, {}, 3);
    const { data } = await admin.from("product_images").select("id").eq("product_id", p.id).order("sort_order");
    const ids = data!.map((r) => r.id);
    const reversed = [...ids].reverse();
    const ok = await admin.rpc("reorder_product_images", { p_product_id: p.id, p_ids: reversed });
    assert.equal(ok.error, null, ok.error?.message);
    const after = await admin.from("product_images").select("id").eq("product_id", p.id).order("sort_order");
    assert.deepEqual(after.data!.map((r) => r.id), reversed);
    const missing = await admin.rpc("reorder_product_images", { p_product_id: p.id, p_ids: ids.slice(1) });
    assert.equal(missing.error?.message, "invalid_image_list");
    const foreign = await admin.rpc("reorder_product_images", { p_product_id: p.id, p_ids: [...ids.slice(1), randomUUID()] });
    assert.equal(foreign.error?.message, "invalid_image_list");
  });

  it("sets exactly one primary image and promotes another when the primary is deleted", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, {}, 3);
    const { data } = await admin.from("product_images").select("id, is_primary").eq("product_id", p.id).order("sort_order");
    assert.equal(data!.filter((i) => i.is_primary).length, 1);
    const third = data![2].id;
    assert.equal((await admin.rpc("set_primary_image", { p_image_id: third })).error, null);
    const now = await admin.from("product_images").select("id, is_primary").eq("product_id", p.id);
    assert.deepEqual(now.data!.filter((i) => i.is_primary).map((i) => i.id), [third]);
    await admin.from("product_images").delete().eq("id", third);
    const promoted = await admin.from("product_images").select("id, is_primary").eq("product_id", p.id);
    assert.equal(promoted.data!.filter((i) => i.is_primary).length, 1, "no primary after deleting the primary");
  });

  it("does not let the last image of a published product be deleted", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" }, 1);
    const { data } = await admin.from("product_images").select("id").eq("product_id", p.id);
    const del = await admin.from("product_images").delete().eq("id", data![0].id);
    assert.equal(del.error?.message, "last_image_of_published_product");
    await admin.from("products").update({ status: "hidden" }).eq("id", p.id);
    const ok = await admin.from("product_images").delete().eq("id", data![0].id);
    assert.equal(ok.error, null, "hidden product should allow deleting its last image");
  });
});

describe("audit trail", () => {
  it("records who did what for create / publish / hide / delete", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin);
    await addImage(admin, p.id, 1);
    await admin.from("products").update({ status: "published" }).eq("id", p.id);
    await admin.from("products").update({ status: "hidden" }).eq("id", p.id);
    await admin.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
    const { data } = await admin.from("audit_logs").select("action, user_id").eq("entity_id", p.id).order("created_at");
    const actions = data!.map((a) => a.action);
    for (const expected of ["product.create", "product_image.add", "product.publish", "product.hide", "product.delete"]) {
      assert.ok(actions.includes(expected), `missing audit action ${expected} (got ${actions.join(", ")})`);
    }
    assert.ok(data!.every((a) => a.user_id), "every staff action must carry a user id");
  });

  it("normalised Arabic search text lets 'فساتين' style variants match", async () => {
    const admin = await signedIn("admin");
    const p = await newDraft(admin, { name: "ZZTEST فُسْتَان إِنَاثِي", description: "طقم مدرسة" });
    const row = await svc.from("products").select("search_text").eq("id", p.id).single();
    assert.match(row.data!.search_text, /فستان/);
    assert.match(row.data!.search_text, /اناثي/, "hamza/tashkeel not normalised");
  });
});
