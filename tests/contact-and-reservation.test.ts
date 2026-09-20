import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReservationMessage, normalizeIraqiPhone, validateReservation } from "../src/lib/reservation";
import { productInquiryMessage, toInternationalDigits, whatsappUrl } from "../src/lib/whatsapp";
import { formatAge, formatPrice } from "../src/lib/format";
import { site, telHref, viberHref } from "../src/lib/site";

describe("contact links use the owner-provided number 07811404047", () => {
  it("WhatsApp / tel / Viber all point to +964 781 140 4047", () => {
    assert.equal(toInternationalDigits("07811404047"), "9647811404047");
    assert.equal(site.phone.wa, "9647811404047");
    assert.equal(telHref, "tel:+9647811404047");
    assert.equal(viberHref, "viber://chat?number=%2B9647811404047");
    assert.ok(whatsappUrl(site.phone.wa).startsWith("https://wa.me/9647811404047"));
  });

  it("product inquiry text matches the required wording and is URL-encoded", () => {
    const msg = productInquiryMessage("فستان نسائي");
    assert.equal(msg, "السلام عليكم، أود الاستفسار/حجز المنتج: فستان نسائي");
    assert.equal(decodeURIComponent(whatsappUrl(site.phone.wa, msg).split("?text=")[1]), msg);
  });

  it("official links are exactly the ones supplied", () => {
    assert.equal(site.links.facebook, "https://www.facebook.com/amerabasha2/");
    assert.equal(site.links.maps, "https://maps.app.goo.gl/rw2rfbCTCGu8zMyi7");
    assert.equal(site.links.telegram, "https://t.me/ameera_bashaa");
  });
});

describe("Iraqi phone validation", () => {
  it("accepts local, +964, 00964 and Arabic-Indic digits", () => {
    for (const v of ["07811404047", "+9647811404047", "009647811404047", "0781 140 4047", "٠٧٧٠١٢٣٤٥٦٧"]) {
      assert.ok(normalizeIraqiPhone(v), v);
    }
    assert.equal(normalizeIraqiPhone("+9647811404047"), "07811404047");
  });
  it("rejects short / foreign numbers", () => {
    for (const v of ["", "0781140404", "12345", "+15551234567", "06811404047"]) assert.equal(normalizeIraqiPhone(v), null, v);
  });
});

describe("reservation form", () => {
  const valid = { customerName: "سارة", phone: "07701234567", governorate: "البصرة", district: "الجزائر", quantity: 2 };
  it("passes with valid data", () => assert.deepEqual(validateReservation(valid), {}));
  it("reports each invalid field", () => {
    const e = validateReservation({ customerName: "", phone: "1", governorate: "", district: "", quantity: 0 });
    assert.deepEqual(Object.keys(e).sort(), ["customerName", "district", "governorate", "phone", "quantity"]);
  });
  it("builds a minimal WhatsApp message: number, product, size, quantity, name – and nothing else", () => {
    const msg = buildReservationMessage({
      productId: "id-1", productName: "فستان نسائي", productUrl: "https://t.me/ameera_bashaa/26598",
      customerName: " سارة ", phone: "+9647701234567", governorate: "البصرة", district: "الجزائر", address: "قرب المدرسة",
      size: "M", quantity: 2, notes: "لون أسود", reservationNumber: "AB-20260920-0001",
    });
    assert.match(msg, /رقم الحجز: AB-20260920-0001/);
    assert.match(msg, /المنتج: فستان نسائي/);
    assert.match(msg, /المقاس: M/);
    assert.match(msg, /الكمية: 2/);
    assert.match(msg, /الاسم: سارة/);
    for (const leaked of ["07701234567", "البصرة", "الجزائر", "قرب المدرسة", "لون أسود", "t.me"]) assert.ok(!msg.includes(leaked), "should not repeat " + leaked);
  });
  it("omits the size line when no size was chosen", () => {
    const msg = buildReservationMessage({ productId: "x", productName: "حقيبة", customerName: "سارة", phone: "07701234567", governorate: "بابل", district: "الحلة", quantity: 1 });
    assert.doesNotMatch(msg, /المقاس/);
  });
});

describe("formatting", () => {
  it("formats prices without inventing anything", () => {
    assert.equal(formatPrice(26500), "26,500 د.ع");
    assert.equal(formatAge(6, 12), "6 – 12 سنة");
    assert.equal(formatAge(0.5, 5), "من 6 أشهر إلى 5 سنوات");
  });
});
