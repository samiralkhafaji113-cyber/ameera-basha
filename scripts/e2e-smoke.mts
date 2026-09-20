/**
 * Full end-to-end smoke test in a REAL browser (puppeteer-core drives Chrome/Edge that is already installed).
 * Works against local, preview and production. It creates a clearly-labelled TEST product + TEST reservation,
 * exercises the whole flow, then removes the product again.
 *
 *   E2E_BASE_URL=https://your-domain.com E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run smoke:e2e
 *   (if the e-mail/password variables are not set the script asks for them; the password is typed hidden and never printed)
 *
 * Steps (Phase 32 + 33): public pages · admin login · create product · upload image · publish · public visibility ·
 * reservation · reservation in admin · status change · hide · disappears publicly · trash + purge · cleanup check.
 *
 * Uses ONLY test data ("TEST-E2E-…" product, "TEST E2E" customer). No real customer data. The test reservation cannot be
 * deleted from the admin UI by design: it is marked "cancelled" with an internal note, and can be purged with
 * `npm run prod:cleanup-test-data` (operator).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import sharp from "sharp";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const STAMP = Date.now().toString(36);
const NAME = `TEST-E2E-${STAMP}`;
const CUSTOMER = "TEST E2E (delete me)";
const PHONE = `0770${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

const BROWSERS = [
  process.env.E2E_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p): p is string => Boolean(p) && fs.existsSync(p as string));
if (!BROWSERS.length) throw new Error("No Chrome/Edge found. Set E2E_BROWSER to the browser executable.");

async function ask(prompt: string, hidden: boolean): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  process.stdout.write(prompt);
  return new Promise((res) => rl.question("", (v) => { rl.close(); if (hidden) process.stdout.write("\n"); res(v); }));
}
const email = process.env.E2E_ADMIN_EMAIL || (await ask("Admin e-mail: ", false));
const password = process.env.E2E_ADMIN_PASSWORD || (await ask("Admin password (hidden): ", true));
if (!email || !password) throw new Error("admin credentials are required");

const results: { step: string; ok: boolean; note?: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const note = await fn();
    results.push({ step: name, ok: true, note: note || undefined });
    console.log(`PASS  ${name}${note ? ` – ${note}` : ""}`);
  } catch (e) {
    const note = e instanceof Error ? e.message : String(e);
    results.push({ step: name, ok: false, note });
    console.log(`FAIL  ${name} – ${note}`);
    throw e;
  }
}
const must = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

async function waitFor<T>(fn: () => Promise<T | null | false | undefined>, what: string, ms = 20000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${what}`);
}
async function setValue(page: Page, selector: string, value: string) {
  await page.$eval(selector, (el, v) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }, value);
}
async function clickButton(page: Page, text: string, scope = "body") {
  const ok = await page.evaluate((t, sc) => {
    const root = document.querySelector(sc) ?? document.body;
    const b = [...root.querySelectorAll("button, a")].find((x) => x.textContent?.trim() === t && (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
    b?.click();
    return Boolean(b);
  }, text, scope);
  must(ok, `button "${text}" not found`);
}
const status = async (url: string) => (await fetch(url, { redirect: "manual", cache: "no-store" })).status;
const html = async (url: string) => (await fetch(url, { cache: "no-store" })).text();

const png = path.join(os.tmpdir(), `e2e-${STAMP}.png`);
await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 120, g: 80, b: 60 } } }).png().toFile(png);

const browser = await puppeteer.launch({ executablePath: BROWSERS[0], headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.setDefaultTimeout(20000);
let slug = "";
let productId = "";
let reservationNumber = "";

try {
  await step("Public: home, products, product page, health", async () => {
    must((await status(`${BASE}/`)) === 200, "home not 200");
    must((await status(`${BASE}/products`)) === 200, "products not 200");
    const h = await (await fetch(`${BASE}/api/health`, { cache: "no-store" })).json();
    must(h.status === "ok" && h.database === true, `health: ${JSON.stringify(h)}`);
    const first = (await html(`${BASE}/sitemap.xml`)).match(/\/products\/([^<]+)</)?.[1];
    must(first, "sitemap has no product");
    must((await status(`${BASE}/products/${first}`)) === 200, "a listed product page is not 200");
    return `database reachable, ${h.published} published products`;
  });

  await step("Public: search + filter work", async () => {
    await page.goto(`${BASE}/products`, { waitUntil: "networkidle2" });
    await page.type("#product-search", "فستان");
    const n = await waitFor(async () => {
      const t = await page.$eval('main [role="status"]', (e) => e.textContent ?? "").catch(() => "");
      if (t.includes("واحد")) return 1; // «منتج واحد»
      const m = /(\d+)/.exec(t);
      return m ? Number(m[1]) : null;
    }, "result count");
    must(n > 0, "search returned nothing");
    return `"فستان" → ${n} results`;
  });

  await step("1. Admin login", async () => {
    await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle2" });
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await Promise.all([page.waitForFunction(() => location.pathname === "/admin", { timeout: 25000 }), page.keyboard.press("Enter")]);
    await page.waitForSelector("h1");
    must((await page.$eval("h1", (e) => e.textContent)) === "لوحة التحكم", "dashboard did not load");
  });

  await step("2. Create test product (draft)", async () => {
    await page.goto(`${BASE}/admin/products/new`, { waitUntil: "networkidle2" });
    await setValue(page, 'input[name="name"]', NAME);
    const cat = await page.$eval('select[name="category_id"]', (s) => (s as HTMLSelectElement).options[1]?.value ?? "");
    await setValue(page, 'select[name="category_id"]', cat);
    await page.evaluate(() => (document.querySelector('form[class*="flex-col"]') as HTMLFormElement).requestSubmit());
    await page.waitForFunction(() => /\/admin\/products\/[0-9a-f-]{36}\/edit/.test(location.pathname), { timeout: 25000 });
    productId = page.url().match(/products\/([0-9a-f-]{36})/)![1];
    slug = await page.$eval('input[name="slug"]', (e) => (e as HTMLInputElement).value);
    must(slug, "no slug generated");
    return `draft ${slug}`;
  });

  await step("3. Upload test image", async () => {
    const input = await page.$('[data-testid="image-input"]');
    if (!input) throw new Error("upload input missing");
    await (input as unknown as { uploadFile(...paths: string[]): Promise<void> }).uploadFile(png);
    await waitFor(async () => (await page.$$("ul li[draggable]")).length === 1, "uploaded image");
  });

  await step("4. Publish", async () => {
    await clickButton(page, "نشر");
    await waitFor(async () => (await page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.textContent?.trim() === "منشور"))), "published badge");
  });

  await step("5. Product appears publicly", async () => {
    const ok = await waitFor(async () => (await status(`${BASE}/products/${slug}`)) === 200, "public product page", 30000);
    must(ok, "not public");
    must((await html(`${BASE}/products`)).includes(NAME), "not listed on /products");
    must((await html(`${BASE}/sitemap.xml`)).includes(`/products/${slug}`), "not in sitemap");
  });

  await step("6. Create reservation (public flow)", async () => {
    const guest = await browser.createBrowserContext();
    const p = await guest.newPage();
    await p.goto(`${BASE}/products/${slug}`, { waitUntil: "networkidle2" });
    await clickButton(p, "احجز القطعة");
    await p.waitForSelector("#reservation-form");
    await setValue(p, 'input[name="name"]', CUSTOMER);
    await setValue(p, 'input[name="tel"]', PHONE);
    await setValue(p, 'select[name="governorate"]', "بابل");
    await setValue(p, 'input[name="district"]', "TEST");
    await p.evaluate(() => (document.querySelector("#reservation-form") as HTMLFormElement).requestSubmit());
    reservationNumber = await waitFor(async () => p.$eval("dialog[open] bdi", (e) => e.textContent ?? "").catch(() => ""), "reservation number");
    must(/^AB-\d{8}-\d{4}$/.test(reservationNumber), `unexpected number ${reservationNumber}`);
    const wa = await p.$$eval("dialog[open] a", (as) => as.map((a) => (a as HTMLAnchorElement).href).find((h) => h.includes("wa.me")) ?? "");
    must(wa.startsWith("https://wa.me/9647811404047?text="), "WhatsApp link wrong");
    must(decodeURIComponent(wa).includes(reservationNumber), "WhatsApp text lacks the reservation number");
    await guest.close();
    return reservationNumber;
  });

  await step("7. Reservation visible in admin", async () => {
    await page.goto(`${BASE}/admin/reservations?q=${encodeURIComponent(reservationNumber)}`, { waitUntil: "networkidle2" });
    must((await page.content()).includes(reservationNumber), "reservation not listed");
  });

  await step("8. Change reservation status (contacted → cancelled + note)", async () => {
    await page.evaluate(() => (document.querySelector('a[href^="/admin/reservations/"]') as HTMLElement).click());
    await page.waitForFunction(() => /\/admin\/reservations\/[0-9a-f-]{36}/.test(location.pathname));
    await clickButton(page, "تم التواصل");
    await waitFor(async () => page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.textContent?.trim() === "تم التواصل")), "contacted badge");
    await clickButton(page, "إلغاء الحجز");
    await sleep(600);
    await page.evaluate(() => { const b = [...document.querySelectorAll("dialog[open] button")].find((x) => x.textContent?.trim() === "إلغاء الحجز") as HTMLElement; b?.click(); });
    await waitFor(async () => page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.textContent?.trim() === "ملغي")), "cancelled badge");
    await setValue(page, "#admin-notes", "اختبار آلي – آمن للحذف");
    await clickButton(page, "حفظ الملاحظات");
    await sleep(1500);
  });

  await step("9. Hide product", async () => {
    await page.goto(`${BASE}/admin/products/${productId}/edit`, { waitUntil: "networkidle2" });
    await clickButton(page, "إخفاء");
    await waitFor(async () => page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.textContent?.trim() === "مخفي")), "hidden badge");
  });

  await step("10. Product disappears publicly", async () => {
    await waitFor(async () => (await status(`${BASE}/products/${slug}`)) === 404, "404 for hidden product", 30000);
    must(!(await html(`${BASE}/products`)).includes(NAME), "still listed");
    must(!(await html(`${BASE}/sitemap.xml`)).includes(`/products/${slug}`), "still in sitemap");
  });

  await step("11. Delete test product (trash → permanent delete)", async () => {
    await clickButton(page, "حذف");
    await sleep(500);
    await page.evaluate(() => { const b = [...document.querySelectorAll("dialog[open] button")].find((x) => x.textContent?.includes("نقل إلى المحذوفات")) as HTMLElement; b?.click(); });
    await waitFor(async () => page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.textContent?.trim() === "محذوف")), "trashed badge");
    await clickButton(page, "حذف نهائي");
    await sleep(500);
    await page.evaluate(() => { const b = [...document.querySelectorAll("dialog[open] button")].find((x) => x.textContent?.includes("احذف نهائياً")) as HTMLElement; b?.click(); });
    await sleep(3500);
  });

  await step("12. Cleanup verified (no test product left anywhere)", async () => {
    await page.goto(`${BASE}/admin/products?q=${NAME}`, { waitUntil: "networkidle2" });
    must((await page.content()).includes("لا توجد منتجات"), "active list still has the test product");
    await page.goto(`${BASE}/admin/products?status=trash&q=${NAME}`, { waitUntil: "networkidle2" });
    must((await page.content()).includes("لا توجد منتجات"), "trash still has the test product");
    must((await status(`${BASE}/products/${slug}`)) === 404, "public page exists");
    return `test reservation ${reservationNumber} kept as cancelled (customer records are not deletable from the UI)`;
  });
} catch {
  /* the failing step was already reported */
} finally {
  await browser.close();
  fs.rmSync(png, { force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? "FAILED" : "ALL PASSED"}: ${results.filter((r) => r.ok).length}/${results.length} steps on ${BASE}`);
if (failed.length) console.log("If a TEST product was left behind, delete it from Admin → المنتجات (search TEST-E2E).");
process.exit(failed.length ? 1 : 0);
