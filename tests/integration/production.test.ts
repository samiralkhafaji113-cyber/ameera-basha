import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { anon, cleanup, dropStaff, makeProduct, makeStaff, service, signedIn, uid, uniquePhone } from "./helpers";

/** Production-hardening migration: privileged image deletion, reservation price snapshot, slug history + redirect lookup. */
const svc = service();

before(async () => cleanup(svc));
after(async () => cleanup(svc));

// same query the site uses (repository.resolveSlug): a plain GET through RLS as a visitor
const rpcSlug = async (slug: string) => {
  const { data } = await anon().from("product_slug_history").select("product:products(slug)").eq("slug", slug).maybeSingle();
  return ((data as { product?: { slug?: string } | null } | null)?.product?.slug ?? null) as string | null;
};

describe("image deletion is privileged (RLS + Storage policy)", () => {
  it("an editor can add images but not delete image rows or files", async () => {
    const editor = await signedIn("editor");
    const p = await makeProduct(svc, {}, 1);
    const { data: imgs } = await svc.from("product_images").select("id").eq("product_id", p.id);
    const del = await editor.from("product_images").delete().eq("id", imgs![0].id).select("id");
    assert.ok(del.error || (del.data ?? []).length === 0, "editor deleted an image row");
    assert.equal((await svc.from("product_images").select("id").eq("id", imgs![0].id)).data?.length, 1, "row disappeared");

    // storage: the editor may upload a valid WebP ...
    const webp = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#884" } }).webp().toBuffer();
    const path = `products/${p.id}/${randomUUID()}.webp`;
    const up = await editor.storage.from("store-media").upload(path, webp, { contentType: "image/webp" });
    assert.equal(up.error, null, up.error?.message);
    // ... but cannot remove it
    const rm = await editor.storage.from("store-media").remove([path]);
    assert.ok(rm.error || (rm.data ?? []).length === 0, "editor removed a storage object");
    assert.equal((await svc.storage.from("store-media").list(`products/${p.id}`)).data?.some((f) => path.endsWith(f.name)), true, "file disappeared");
    await svc.storage.from("store-media").remove([path]);
  });

  it("a manager / admin can delete images and files", async () => {
    const { client, userId } = await makeStaff(svc, "manager");
    try {
      const p = await makeProduct(svc, {}, 2);
      const { data: imgs } = await svc.from("product_images").select("id").eq("product_id", p.id);
      const del = await client.from("product_images").delete().eq("id", imgs![0].id).select("id");
      assert.equal(del.data?.length, 1, "manager cannot delete an image row");
      const webp = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#448" } }).webp().toBuffer();
      const path = `products/${p.id}/${randomUUID()}.webp`;
      assert.equal((await svc.storage.from("store-media").upload(path, webp, { contentType: "image/webp" })).error, null);
      const rm = await client.storage.from("store-media").remove([path]);
      assert.equal(rm.error, null);
      assert.equal(rm.data?.length, 1, "manager cannot remove a storage object");
    } finally {
      await dropStaff(svc, userId);
    }
    const admin = await signedIn("admin");
    const p2 = await makeProduct(svc, {}, 2);
    const { data: imgs2 } = await svc.from("product_images").select("id").eq("product_id", p2.id);
    assert.equal((await admin.from("product_images").delete().eq("id", imgs2![0].id).select("id")).data?.length, 1);
  });
});

describe("slug history (old links keep working)", () => {
  it("an old slug resolves to the current slug of a published product", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" });
    const next = `zztest-renamed-${uid()}`;
    assert.equal((await admin.from("products").update({ slug: next }).eq("id", p.id)).error, null);
    assert.equal(await rpcSlug(p.slug), next);
    // renamed again: both older slugs point at the newest one
    const third = `zztest-third-${uid()}`;
    await admin.from("products").update({ slug: third }).eq("id", p.id);
    assert.equal(await rpcSlug(p.slug), third);
    assert.equal(await rpcSlug(next), third);
  });

  it("reveals nothing for hidden, archived or unknown products", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ slug: `zztest-new-${uid()}` }).eq("id", p.id);
    await admin.from("products").update({ status: "hidden" }).eq("id", p.id);
    assert.equal(await rpcSlug(p.slug), null, "hidden product's new slug leaked through the redirect lookup");
    assert.equal(await rpcSlug("zztest-does-not-exist"), null);
  });

  it("forgets an old slug once another product takes it", async () => {
    const admin = await signedIn("admin");
    const a = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ slug: `zztest-moved-${uid()}` }).eq("id", a.id);
    const b = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ slug: a.slug }).eq("id", b.id); // b now owns a's former slug
    assert.equal(await rpcSlug(a.slug), null, "a live slug must never redirect elsewhere");
  });

  it("visitors can read history rows only for published products and can never write them", async () => {
    const admin = await signedIn("admin");
    const p = await makeProduct(svc, { status: "published" });
    await admin.from("products").update({ slug: `zztest-vis-${uid()}` }).eq("id", p.id);
    assert.equal((await anon().from("product_slug_history").select("slug").eq("slug", p.slug)).data?.length, 1);
    await admin.from("products").update({ status: "hidden" }).eq("id", p.id);
    assert.equal((await anon().from("product_slug_history").select("slug").eq("slug", p.slug)).data?.length, 0, "hidden product's history is visible");
    for (const client of [anon(), admin]) {
      const w = await client.from("product_slug_history").insert({ slug: `zztest-forged-${uid()}`, product_id: p.id });
      assert.ok(w.error, "history table is writable by a client");
    }
  });
});

describe("reservation price snapshot", () => {
  const reserve = async (productId: string) => {
    const { data, error } = await anon().rpc("create_reservation", {
      p_product_id: productId, p_customer_name: "اختبار", p_phone: uniquePhone(), p_governorate: "بابل", p_district: "الحلة",
    });
    assert.equal(error, null, error?.message);
    return (Array.isArray(data) ? data[0] : data).id as string;
  };
  it("stores price + currency only when the price was verified", async () => {
    const verified = await makeProduct(svc, { status: "published", price: 12500, currency: "IQD", price_verified: true });
    const unverified = await makeProduct(svc, { status: "published", price: 9000 });
    const a = await svc.from("reservations").select("price_snapshot, currency_snapshot").eq("id", await reserve(verified.id)).single();
    assert.deepEqual([Number(a.data?.price_snapshot), a.data?.currency_snapshot], [12500, "IQD"]);
    const b = await svc.from("reservations").select("price_snapshot, currency_snapshot").eq("id", await reserve(unverified.id)).single();
    assert.deepEqual([b.data?.price_snapshot, b.data?.currency_snapshot], [null, null], "an unverified price must never be recorded");
  });
  it("the snapshot survives a later price change", async () => {
    const p = await makeProduct(svc, { status: "published", price: 5000, currency: "IQD", price_verified: true });
    const id = await reserve(p.id);
    await svc.from("products").update({ price: 8000 }).eq("id", p.id);
    const row = await svc.from("reservations").select("price_snapshot").eq("id", id).single();
    assert.equal(Number(row.data?.price_snapshot), 5000);
  });
  it("customers still cannot edit the snapshot columns", async () => {
    const p = await makeProduct(svc, { status: "published" });
    const id = await reserve(p.id);
    const admin = await signedIn("admin");
    const r = await admin.from("reservations").update({ price_snapshot: 1 }).eq("id", id).select();
    assert.ok(r.error, "admin could rewrite the price snapshot");
  });
});
