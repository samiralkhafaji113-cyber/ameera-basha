/**
 * Upload validation that does NOT trust the browser: the declared MIME type / file name are ignored and the
 * real format is decided from the file's magic bytes. Pure → unit-tested. Dimension checks happen after decoding
 * (src/lib/media/process-image.ts) because they need the image header.
 */
export const IMAGE_LIMITS = {
  /** Raw upload size cap (phones produce 3–8 MB JPEGs; the result is re-encoded to a few hundred KB). */
  maxBytes: 8 * 1024 * 1024,
  minSide: 200,
  maxSide: 8000,
  /** Decompression-bomb guard. */
  maxPixels: 40_000_000,
  maxImagesPerProduct: 12,
} as const;

export type ImageKind = "jpeg" | "png" | "webp" | "avif";

/** Detect the real format from the first bytes. Anything else (SVG, GIF, HTML, PDF, executables…) → null. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "png";
  const tag = (from: number) => String.fromCharCode(at(from), at(from + 1), at(from + 2), at(from + 3));
  if (tag(0) === "RIFF" && tag(8) === "WEBP") return "webp";
  if (tag(4) === "ftyp" && (tag(8) === "avif" || tag(8) === "avis")) return "avif";
  return null;
}

export type UploadCheck = { ok: true; kind: ImageKind } | { ok: false; message: string };

export function checkUpload(size: number, head: Uint8Array): UploadCheck {
  if (size <= 0) return { ok: false, message: "الملف فارغ." };
  if (size > IMAGE_LIMITS.maxBytes) return { ok: false, message: "حجم الصورة كبير جداً (الحد الأقصى 8 ميغابايت)." };
  const kind = sniffImage(head);
  if (!kind) return { ok: false, message: "نوع الملف غير مسموح. ارفع صورة JPG أو PNG أو WebP أو AVIF." };
  return { ok: true, kind };
}

export function checkDimensions(width: number, height: number): { ok: true } | { ok: false; message: string } {
  if (!width || !height) return { ok: false, message: "تعذّر قراءة أبعاد الصورة." };
  if (Math.min(width, height) < IMAGE_LIMITS.minSide) return { ok: false, message: `الصورة صغيرة جداً (الحد الأدنى ${IMAGE_LIMITS.minSide}px).` };
  if (Math.max(width, height) > IMAGE_LIMITS.maxSide || width * height > IMAGE_LIMITS.maxPixels) return { ok: false, message: "أبعاد الصورة كبيرة جداً." };
  return { ok: true };
}
