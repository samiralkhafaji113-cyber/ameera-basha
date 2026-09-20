import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { anon, cleanup, makeProduct, service, signedIn, uniquePhone } from "./helpers";

/** Reservations: creation through the RPC, server-side validation, status machine, search/filters, snapshots. */
const svc = service();
let product: { id: string; slug: string; name: string };
let hiddenProduct: { id: string; slug: string; name: string };
let unavailableProduct: { id: string; slug: string; name: string };

const valid = () => ({
  p_product_id: product.id,
  p_customer_name: "سارة أحمد",
  p_phone: uniquePhone(),
  p_governorate: "بابل",
  p_district: "الجزائر",
  p_address: "قرب المدرسة",
  p_size: "M",
  p_quantity: 2,
  p_notes: "ملاحظة",
});
const create = (over: Record<string, unknown> = {}) => anon().rpc("create_reservation", { ...valid(), ...over });
const one = (data: unknown) => (Array.isArray(data) ? data[0] : data) as { id: string; reservation_number: string; status: string };

before(async () => {
  await cleanup(svc);
  product = await makeProduct(svc, { status: "published", numeric_sizes: ["38", "40"] });
  hiddenProduct = await makeProduct(svc, { status: "hidden" });
  unavailableProduct = await makeProduct(svc, { status: "published", available: false });
});
after(async () => cleanup(svc));

describe("creating a reservation (public)", () => {
  it("saves it, returns AB-YYYYMMDD-NNNN and stores a product snapshot", async () => {
    const { data, error } = await create();
    assert.equal(error, null, error?.message);
    const r = one(data);
    assert.match(r.reservation_number, /^AB-\d{8}-\d{4}$/);
    assert.equal(r.status, "pending");
    const row = await svc.from("reservations").select("product_name_snapshot, quantity, size, phone").eq("id", r.id).single();
    assert.equal(row.data?.product_name_snapshot, product.name);
    assert.equal(row.data?.quantity, 2);
  });

  it("numbers are unique and increase within a day", async () => {
    const a = one((await create()).data).reservation_number;
    const b = one((await create()).data).reservation_number;
    assert.notEqual(a, b);
    assert.ok(b > a, `${b} should sort after ${a}`);
  });

  it("normalises phone formats (+964, spaces, Arabic digits) to 07xxxxxxxxx", async () => {
    const local = uniquePhone();
    const intl = `+964 ${local.slice(1, 4)} ${local.slice(4)}`;
    const r = one((await create({ p_phone: intl })).data);
    const row = await svc.from("reservations").select("phone").eq("id", r.id).single();
    assert.equal(row.data?.phone, local);
  });

  it("keeps the product name after the product is renamed or deleted", async () => {
    const p = await makeProduct(svc, { status: "published" });
    const r = one((await create({ p_product_id: p.id })).data);
    await svc.from("products").update({ name: "ZZTEST اسم جديد" }).eq("id", p.id);
    await svc.from("products").delete().eq("id", p.id);
    const row = await svc.from("reservations").select("product_name_snapshot, product_id").eq("id", r.id).single();
    assert.equal(row.data?.product_name_snapshot, p.name, "snapshot must be taken at reservation time");
    assert.equal(row.data?.product_id, null);
  });
});

describe("server-side validation of reservations", () => {
  const rejects = async (over: Record<string, unknown>, code: string) => {
    const { error } = await create(over);
    assert.equal(error?.message, code);
  };
  it("rejects a bad name, phone, governorate, district and quantity", async () => {
    await rejects({ p_customer_name: "س" }, "invalid_name");
    await rejects({ p_customer_name: "x".repeat(81) }, "invalid_name");
    await rejects({ p_phone: "12345" }, "invalid_phone");
    await rejects({ p_phone: "+15551234567" }, "invalid_phone");
    await rejects({ p_governorate: "المريخ" }, "invalid_governorate");
    await rejects({ p_district: "" }, "invalid_district");
    await rejects({ p_quantity: 0 }, "invalid_quantity");
    await rejects({ p_quantity: -3 }, "invalid_quantity");
    await rejects({ p_quantity: 51 }, "invalid_quantity");
  });
  it("rejects oversize free text", async () => {
    await rejects({ p_notes: "x".repeat(601) }, "invalid_notes");
    await rejects({ p_address: "x".repeat(301) }, "invalid_address");
  });
  it("rejects hidden, draft, missing and unavailable products", async () => {
    await rejects({ p_product_id: hiddenProduct.id }, "invalid_product");
    await rejects({ p_product_id: "00000000-0000-0000-0000-000000000000" }, "invalid_product");
    await rejects({ p_product_id: unavailableProduct.id }, "product_unavailable");
  });
  it("accepts only a size the product actually offers", async () => {
    await rejects({ p_size: "XXXL" }, "invalid_size");
    assert.equal((await create({ p_size: "40" })).error, null, "numeric size should be accepted");
    assert.equal((await create({ p_size: null })).error, null, "size is optional");
  });
  it("rate-limits repeated requests from the same phone", async () => {
    const phone = uniquePhone();
    for (let i = 0; i < 5; i++) assert.equal((await create({ p_phone: phone })).error, null);
    const sixth = await create({ p_phone: phone });
    assert.equal(sixth.error?.message, "rate_limited");
  });
});

describe("status transitions (admin)", () => {
  it("Pending → Contacted → Confirmed → Completed", async () => {
    const admin = await signedIn("admin");
    const r = one((await create()).data);
    for (const to of ["contacted", "confirmed", "completed"]) {
      const res = await admin.from("reservations").update({ status: to }).eq("id", r.id).select("status, status_changed_at, handled_by").single();
      assert.equal(res.error, null, `${to}: ${res.error?.message}`);
      assert.equal(res.data?.status, to);
      assert.ok(res.data?.status_changed_at && res.data?.handled_by, "who/when not recorded");
    }
  });
  it("rejects skipping steps and leaving a completed reservation", async () => {
    const admin = await signedIn("admin");
    const r = one((await create()).data);
    const skip = await admin.from("reservations").update({ status: "completed" }).eq("id", r.id);
    assert.equal(skip.error?.message, "invalid_status_transition");
    await admin.from("reservations").update({ status: "confirmed" }).eq("id", r.id);
    await admin.from("reservations").update({ status: "completed" }).eq("id", r.id);
    const back = await admin.from("reservations").update({ status: "pending" }).eq("id", r.id);
    assert.equal(back.error?.message, "invalid_status_transition");
  });
  it("cancelled reservations can be re-opened", async () => {
    const admin = await signedIn("admin");
    const r = one((await create()).data);
    await admin.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
    const reopen = await admin.from("reservations").update({ status: "pending" }).eq("id", r.id);
    assert.equal(reopen.error, null);
  });
  it("writes status changes to the audit log", async () => {
    const admin = await signedIn("admin");
    const r = one((await create()).data);
    await admin.from("reservations").update({ status: "contacted" }).eq("id", r.id);
    const { data } = await admin.from("audit_logs").select("action, metadata").eq("entity_id", r.id).order("created_at");
    const actions = data!.map((a) => a.action);
    assert.ok(actions.includes("reservation.create"));
    const change = data!.find((a) => a.action === "reservation.status");
    assert.deepEqual([change?.metadata.from, change?.metadata.to], ["pending", "contacted"]);
  });
});

describe("search and filters (admin)", () => {
  it("finds a reservation by number, name, phone and product name; filters by status and governorate", async () => {
    const admin = await signedIn("admin");
    const phone = uniquePhone();
    const r = one((await create({ p_phone: phone, p_customer_name: "زينب الاختبار", p_governorate: "النجف" })).data);
    const q = (or: string) => admin.from("reservations").select("id").or(or);
    assert.equal((await q(`reservation_number.ilike.%${r.reservation_number}%`)).data?.length, 1);
    assert.ok(((await q("customer_name.ilike.%زينب الاختبار%")).data ?? []).some((x) => x.id === r.id));
    assert.equal((await q(`phone.eq.${phone}`)).data?.length, 1);
    assert.ok(((await q(`product_name_snapshot.ilike.%${product.slug}%`)).data ?? []).some((x) => x.id === r.id));
    const byGov = await admin.from("reservations").select("id").eq("governorate", "النجف").eq("id", r.id);
    assert.equal(byGov.data?.length, 1);
    const byStatus = await admin.from("reservations").select("id").eq("status", "completed").eq("id", r.id);
    assert.equal(byStatus.data?.length, 0);
    const since = await admin.from("reservations").select("id").gte("created_at", new Date(Date.now() - 60_000).toISOString()).eq("id", r.id);
    assert.equal(since.data?.length, 1);
  });
  it("paginates with a stable order", async () => {
    const admin = await signedIn("admin");
    const page1 = await admin.from("reservations").select("id", { count: "exact" }).order("created_at", { ascending: false }).range(0, 4);
    const page2 = await admin.from("reservations").select("id").order("created_at", { ascending: false }).range(5, 9);
    assert.ok((page1.count ?? 0) >= 5);
    const overlap = new Set(page1.data!.map((x) => x.id));
    assert.ok(page2.data!.every((x) => !overlap.has(x.id)));
  });
});
