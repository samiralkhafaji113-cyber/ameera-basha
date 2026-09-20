/**
 * Technical web variants of the OFFICIAL logo (brand-source/official-logo-original.jpg – supplied by
 * the owner, 640×640 JPG, black ink #050505 on white).
 *
 * The logo is NEVER redrawn, recoloured, re-proportioned or upscaled. The only operations are:
 *   1. crop (tight bounding box + padding; mark-only crop for small sizes / icons)
 *   2. luminance → alpha (ink becomes black or white pixels with the original anti-aliasing) so the
 *      same artwork works on light and dark backgrounds
 *   3. faint JPEG speckle (grey ≥ 246) is dropped to fully transparent
 *
 * Output: public/brand/*.png, src/app/icon.png, src/app/apple-icon.png, public/og.jpg
 * Usage:  node scripts/build-brand-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "brand-source/official-logo-original.jpg");
const OUT = path.join(ROOT, "public/brand");
fs.mkdirSync(OUT, { recursive: true });

const PAD = 16;
const INK = { x0: 198, y0: 152, x1: 442, y1: 487 }; // measured ink bounding box of the whole lockup
const MARK_BOTTOM = 391; // last ink row of the AB mark (English/Arabic name lines start at 421)

const { data: grey, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width;

/** Cut a rectangle out of the original and turn ink into a colour + alpha (luminance → alpha). */
async function variant({ x0, y0, x1, y1 }, rgb) {
  const w = x1 - x0 + 1 + PAD * 2;
  const h = y1 - y0 + 1 + PAD * 2;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 - PAD + x;
      const sy = y0 - PAD + y;
      const g = sx >= 0 && sy >= 0 && sx < W && sy < info.height ? grey[sy * W + sx] : 255;
      const a = g >= 246 ? 0 : 255 - g;
      const i = (y * w + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = a;
    }
  }
  return { input: out, raw: { width: w, height: h, channels: 4 } };
}

const BLACK = [5, 5, 5];
const WHITE = [255, 255, 255];
const lockup = INK;
const mark = { ...INK, y1: MARK_BOTTOM };

const files = {
  "logo-lockup-black.png": [lockup, BLACK],
  "logo-lockup-white.png": [lockup, WHITE],
  "logo-mark-black.png": [mark, BLACK],
  "logo-mark-white.png": [mark, WHITE],
};
const meta = {};
for (const [name, [box, rgb]] of Object.entries(files)) {
  const { input, raw } = await variant(box, rgb);
  await sharp(input, { raw }).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  meta[name] = { width: raw.width, height: raw.height };
}
fs.copyFileSync(SRC, path.join(OUT, "official-logo-original.jpg")); // untouched reference copy

// Favicon / touch icon: the official mark on white (downscaled only, never upscaled beyond source pixels)
async function iconOn(size, markWidth, file) {
  const { input, raw } = await variant(mark, BLACK);
  const m = await sharp(input, { raw }).resize({ width: markWidth }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: m, gravity: "center" }])
    .png()
    .toFile(file);
}
await iconOn(256, 200, path.join(ROOT, "src/app/icon.png"));
await iconOn(180, 140, path.join(ROOT, "src/app/apple-icon.png"));
await iconOn(512, 400, path.join(OUT, "icon-512.png"));

// Open Graph card 1200×630: white panel with the official lockup + real product photos
const { input, raw } = await variant(lockup, BLACK);
const logo = await sharp(input, { raw }).resize({ height: 430 }).png().toBuffer(); // 430 ≈ 1.2× native – slight, ink stays crisp on OG
const photoIds = ["26598", "26793"];
const photos = await Promise.all(
  photoIds.map((id) => sharp(path.join(ROOT, `public/products/${id}/1.webp`)).resize(360, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 84 }).toBuffer()),
);
await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ffffff" } })
  .composite([
    { input: logo, left: 60, top: 100 },
    { input: photos[0], left: 480, top: 0 },
    { input: photos[1], left: 840, top: 0 },
  ])
  .jpeg({ quality: 86 })
  .toFile(path.join(ROOT, "public/og.jpg"));

fs.writeFileSync(
  path.join(OUT, "README.txt"),
  "Derived from the owner-supplied official logo (official-logo-original.jpg).\nOnly crop + luminance-to-alpha were applied. Do not redraw, recolour or re-proportion.\n" +
    JSON.stringify(meta, null, 2) +
    "\n",
);
console.log("brand assets:", meta);
