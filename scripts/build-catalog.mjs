/**
 * Builds the product catalog from the store's own public Telegram channel dump
 * (data/source/telegram-posts.json, captured from https://t.me/s/ameera_bashaa).
 *
 * Nothing is invented: name / size / price / availability come only from the post text.
 * Anything not in the post is left undefined (the UI shows "السعر عند الاستفسار" etc.).
 *
 * Every product carries `source` ("telegram" | "facebook" | "instagram" | "tiktok") + `sourceUrl`. Only Telegram is
 * ingested today (its public channel page is machine-readable). No API integration exists for the other platforms –
 * to add products from them, append records with the same shape (source + sourceUrl + postedAt) to the generated
 * catalog or a new ingest script; the UI already renders any source.
 *
 * Usage:  node scripts/build-catalog.mjs [--no-images]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/source/telegram-posts.json"), "utf8"));
const SKIP_IMAGES = process.argv.includes("--no-images");
const MAX_IMAGES = 4;

const strip = (s) => s.replace(/&lrm;|[‎‏‪-‮⁦-⁩]/g, "").replace(/[ \t]+/g, " ").trim();
const NOISE = /^(ملاحظة|العنوان|📍|للحجز|للطلب|📩|متوفر|راسلونا|@|#|0\d{8,})/;
const AR_DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9 };
const num = (s) => Number(s.replace(/[٠-٩]/g, (d) => AR_DIGITS[d]));

// Exact-name normalisation (spelling only – never adds facts).
const NAME_FIX = {
  "مطاره اطفال": "مطارة أطفال",
  "حقيبه بناتي": "حقيبة بناتي",
  "حقيبه نسائية": "حقيبة نسائية",
  "حقيبة مدرسيه": "حقيبة مدرسية",
  "دشداشه نسائيه": "دشداشة نسائية",
  "تنسيقه نسائيه": "تنسيقة نسائية",
  "كيمونه نسائيه": "كيمونة نسائية",
  "دراعة نسائيه": "دراعة نسائية",
  "بجامه نسائيه": "بيجامة نسائية",
  "بجامه رياضيه": "بيجامة رياضية",
  "تراتشكوت نسائي": "ترانشكوت نسائي",
  "جمسوت نسائي (بناتي محير )": "جمسوت نسائي",
  "اجهزة كهربائية": "أجهزة كهربائية",
  "قسم القرطاسيه": "مستلزمات قرطاسية",
  "قسم المفروشات": "مفروشات",
  "قسم الحجابات": "حجابات",
  "قسم الاكسسوارات": "إكسسوارات",
  "رجعنا وفرنالكم القاط الولادي": "قاط ولادي",
  "اوفر اطفال (قديفه)": "أوفر أطفال (قديفة)",
  "تراك ولادي (قديفه)": "تراك ولادي (قديفة)",
  "كلاو اطفال": "كلاو أطفال",
  "صدريه متوسطه": "صدرية متوسطة",
  "صدريه مدرسيه": "صدرية مدرسية",
  "حقيبة مدرسيه كوريه": "حقيبة مدرسية كورية",
  "حقيبه مدرسيه": "حقيبة مدرسية",
  "ساعه نسائية": "ساعة نسائية",
  "دشداشه كشمير": "دشداشة كشمير",
  "مطاره استيل (حافظه للحراره والبرده)": "مطارة ستيل (حافظة للحرارة والبرودة)",
  "القرطاسيه": "مستلزمات قرطاسية",
  "القرطاسية": "مستلزمات قرطاسية",
  "المفروشات": "مفروشات",
  "الحجابات": "حجابات",
  "الاكسسوارات": "إكسسوارات",
  "الألعاب أطفال": "ألعاب أطفال",
};

const OVERRIDES = {
  26357: { name: "نفرين شتائي بوهيمي", description: "غطوة نفرين · من الخلف صوف · قياس كبير 220×240 · الوزن ثقيل · مع وجهين مخدة" },
  25887: { name: "نفرين صيفي ديباج", description: "غطوة نفرين · صيفي · ديباج · سادة · كشكش كيبور · قياس كبير 220×240 سم" },
  25923: { name: "سبلاش", description: "سبلاش كلتر وبدون · بأسعار مختلفة" },
};
// 26563: "شورت نسائي" photo shows intimate apparel – kept off a family-facing catalog
const EXCLUDE_IDS = new Set([26563]);
const CUTOFF = "2025-09-20"; // only posts from the last ~12 months (prices/stock go stale)

// stale promos + intimate apparel (kept off a family-facing catalog)
const EXCLUDE = /تخفيضات|اشتري قطعه|داخلي/;

function parse(p) {
  const raw = strip(p.text.replace(/⁨/g, ""));
  if (!raw || EXCLUDE.test(raw)) return null;
  const lines = raw.split("\n").map(strip).filter(Boolean);
  const content = lines.filter((l) => !NOISE.test(l));
  if (!content.length) return null;

  const priceLine = content.find((l) => /^السعر\s*:?\s*[\d٠-٩]+/.test(l));
  const sizeLine = content.find((l) => /^القياس/.test(l));
  const rest = content.filter((l) => l !== priceLine && l !== sizeLine);

  let section; // "قسم X" hint
  let nameLine = rest[0] ?? "";
  if (/^قسم\s/.test(nameLine)) {
    section = nameLine.replace(/^قسم\s*/, "");
    nameLine = rest[1] ?? rest[0];
  }
  const detail = rest.filter((l) => l !== rest[0] && l !== nameLine).join(" · ");
  const cleanName = nameLine
    .replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "")
    .replace(/^قسم\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = NAME_FIX[cleanName] ?? cleanName;

  let price;
  if (priceLine) {
    const m = priceLine.match(/([\d٠-٩]+)[.,]?([\d٠-٩]{3})?/);
    if (m) price = m[2] ? num(m[1]) * 1000 + num(m[2]) : num(m[1]);
  }
  const size = sizeLine
    ? strip(sizeLine.replace(/^القياس(?:ات)?\s*(?:من)?\s*/, ""))
        .replace(/(\d)_(\d)/g, "$1 إلى $2")
        .replace(/(^|\s)الى(?=\s)/g, "$1إلى")
        .replace(/سنه/g, "سنة")
    : undefined;
  return {
    name,
    section,
    detail,
    price,
    size,
    available: /متوفر[ةه]? الآن/.test(raw) ? true : undefined,
  };
}

// ---- classification ------------------------------------------------------
function classify(name, section = "") {
  const t = `${name} ${section}`;
  if (/حقيب[ةه] مدرسي/.test(t)) return ["stationery", "school-bags"];
  if (/صدري|قميص مدرسي/.test(t)) return ["school", "uniforms"];
  if (/لانچ|فايل|مطارات ماء/.test(t) && !/مطارة/.test(t)) return ["stationery", "general"];
  if (/دفتر/.test(t)) return ["stationery", "notebooks"];
  if (/محفظة أقلام|أقلام/.test(t)) return ["stationery", "pencil-cases"];
  if (/قرطاس/.test(t)) return ["stationery", "general"];
  if (/كوزمتك|غسول|سيروم|شامبو|سبلاش/.test(t)) return ["home", "cosmetics"];
  if (/ألعاب/.test(t)) return ["home", "toys"];
  if (/مفروشات|غطاء|غطوة/.test(t)) return ["home", "furnishing"];
  if (/كهربائ/.test(t)) return ["home", "electrical"];
  if (/مطار/.test(t)) return ["home", "misc"];
  if (/حجاب/.test(t)) return ["accessories", "hijab"];
  if (/حذاء|أحذية|احذية|بوت|سليبر/.test(t)) return ["accessories", "shoes"];
  if (/حقيب|جزدان|محفظ/.test(t)) return ["accessories", "bags"];
  if (/حزام|ساع|إكسسوار|اكسسوار|جوارب|جواريب/.test(t)) return ["accessories", "accessories"];
  if (/بنات/.test(t)) return ["kids", "girls"];
  if (/ولاد|أولاد/.test(t)) return ["kids", "boys"];
  if (/أطفال|اطفال/.test(t)) return ["kids", "general"];
  if (/فستان|دشداش|دراعة|جمسوت/.test(t)) return ["women", "dresses"];
  if (/قميص/.test(t)) return ["women", "shirts"];
  if (/روب|بيجام|بجام|كيمون/.test(t)) return ["women", "robes"];
  if (/كوت|ترانش|هودي|سويتر|جاكيت/.test(t)) return ["women", "outerwear"];
  if (/طقم|تنسيق|سوت|تراك/.test(t)) return ["women", "sets"];
  return ["women", "other"];
}

function parseAgeSize(size, category) {
  if (!size) return {};
  const out = { sizeLabel: size };
  const norm = size
    .replace(/سنتين/g, "2 سنة")
    .replace(/سته اشهر|ستة اشهر|ستة أشهر/g, "6 اشهر")
    .replace(/^سن[ةه](?=\s)/, "1 سنة");
  const nums = [...norm.matchAll(/[\d٠-٩]+/g)].map((m) => num(m[0]));
  const letters = [...size.matchAll(/\b(XXXL|3XL|2XL|XXL|XL|L|M|S)\b/gi)].map((m) => m[1].toUpperCase());
  const hasUnit = /سن(ه|ة|وات)|اشهر|أشهر/.test(size);
  const isFree = /فري/.test(size);
  const sizes = [];
  if (letters.length) sizes.push(...new Set(letters.map((l) => (l === "2XL" ? "XXL" : l === "3XL" ? "XXXL" : l))));
  if (isFree) sizes.push("FREE");
  if (sizes.length) out.sizes = sizes;
  if (nums.length && !letters.length && !isFree) {
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const months = /اشهر|أشهر/.test(size);
    const ageLike = hasUnit || (category === "kids" && hi <= 18);
    if (ageLike) {
      const minYears = months && nums.length > 1 ? nums[0] / 12 : lo;
      const maxYears = months && nums.length > 1 ? nums[nums.length - 1] : hi;
      out.ageRange = { minYears: Math.round(minYears * 10) / 10, maxYears };
    } else if (hi - lo <= 20) {
      out.numericSizes = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
    }
  }
  return out;
}

// ---- assemble ------------------------------------------------------------
const items = [];
for (const p of posts) {
  const parsed = parse(p);
  if (!parsed || !p.photos.length) continue;
  if (p.time < CUTOFF || EXCLUDE_IDS.has(p.id)) continue;
  Object.assign(parsed, OVERRIDES[p.id] ?? {});
  let [category, subcategory] = classify(parsed.name, parsed.section);
  const ageProbe = parseAgeSize(parsed.size, category === "women" ? "kids" : category);
  if (category === "women" && !/نسائ/.test(parsed.name) && ageProbe.ageRange && ageProbe.ageRange.maxYears <= 16) [category, subcategory] = ["kids", "general"];
  items.push({ post: p, parsed, category, subcategory });
}

// merge identical repeated posts (same name+size+price) → newest id, union of photos
const merged = new Map();
for (const it of items.sort((a, b) => b.post.id - a.post.id)) {
  const key = [it.parsed.name, it.parsed.size ?? "", it.parsed.price ?? ""].join("|");
  const cur = merged.get(key);
  if (!cur) merged.set(key, { ...it, photos: [...it.post.photos] });
  else cur.photos.push(...it.post.photos);
}

const products = [...merged.values()].map((it) => {
  const { post, parsed } = it;
  return {
    id: `tg-${post.id}`,
    slug: String(post.id),
    name: parsed.name,
    category: it.category,
    subcategory: it.subcategory,
    ...(parsed.detail ? { description: parsed.detail } : {}),
    ...(parsed.price ? { price: parsed.price, currency: "IQD" } : {}),
    ...(parsed.available ? { available: true } : {}),
    ...parseAgeSize(parsed.size, it.category),
    source: "telegram",
    postedAt: post.time,
    sourceUrl: `https://t.me/ameera_bashaa/${post.id}`,
    _photos: it.photos.slice(0, MAX_IMAGES),
  };
});

// featured: editorial pick – one strong, well-photographed item per section (ids are Telegram post ids)
const FEATURED_IDS = new Set([26598, 26793, 26785, 26382, 26514, 26771, 26807, 26622]);
for (const p of products) if (FEATURED_IDS.has(Number(p.slug))) p.featured = true;

// ---- images --------------------------------------------------------------
async function fetchBuf(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

async function processImages() {
  const jobs = [];
  for (const p of products) p._photos.forEach((u, i) => jobs.push({ p, u, i }));
  let done = 0;
  let failed = 0;
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const { p, u, i } = queue.shift();
      const dir = path.join(ROOT, "public/products", p.slug);
      const file = path.join(dir, `${i + 1}.webp`);
      fs.mkdirSync(dir, { recursive: true });
      let meta;
      if (fs.existsSync(file)) meta = await sharp(file).metadata();
      else {
        const buf = await fetchBuf(u);
        if (!buf) {
          failed++;
          continue;
        }
        const out = await sharp(buf)
          .rotate()
          .resize({ width: 800, height: 1000, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 74, effort: 5 })
          .toBuffer({ resolveWithObject: true });
        fs.writeFileSync(file, out.data);
        meta = out.info;
      }
      (p.images ??= [])[i] = { src: `/products/${p.slug}/${i + 1}.webp`, width: meta.width, height: meta.height };
      if (++done % 50 === 0) console.log(`images ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`images done ${done}, failed ${failed}`);
}

if (!SKIP_IMAGES) await processImages();
for (const p of products) {
  p.images = (p.images ?? []).filter(Boolean);
  delete p._photos;
}
const final = products.filter((p) => SKIP_IMAGES || p.images.length);
fs.writeFileSync(path.join(ROOT, "src/data/catalog.generated.json"), JSON.stringify(final, null, 1));

const by = {};
for (const p of final) by[`${p.category}/${p.subcategory}`] = (by[`${p.category}/${p.subcategory}`] ?? 0) + 1;
console.log(
  "products", final.length,
  "withPrice", final.filter((p) => p.price).length,
  "withAge", final.filter((p) => p.ageRange).length,
  "withSizes", final.filter((p) => p.sizes || p.numericSizes).length,
);
console.log(by);
if (SKIP_IMAGES) for (const p of final) console.log(p.slug, `${p.category}/${p.subcategory}`, "|", p.name, "|", p.sizeLabel ?? "-", "|", p.price ?? "-", "|", p.ageRange ? JSON.stringify(p.ageRange) : "");
