import "server-only";
import sharp from "sharp";
import { IMAGE_LIMITS, checkDimensions } from "@/lib/validation/image";

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/** Longest side of the stored master; next/image derives the responsive AVIF/WebP sizes from it. */
export const MASTER_MAX_SIDE = 1400;

/**
 * Decode → fix EXIF rotation → downscale (never upscale) → strip all metadata (GPS, camera…) → WebP.
 * The output is always a fresh WebP encoded by us, so nothing from the original file (scripts, polyglots,
 * embedded payloads) survives. `limitInputPixels` guards against decompression bombs.
 */
export async function processImage(input: Buffer): Promise<{ ok: true; image: ProcessedImage } | { ok: false; message: string }> {
  try {
    const source = sharp(input, { limitInputPixels: IMAGE_LIMITS.maxPixels, failOn: "error" });
    const meta = await source.metadata();
    const dims = checkDimensions(meta.width ?? 0, meta.height ?? 0);
    if (!dims.ok) return dims;

    const { data, info } = await source
      .rotate() // honour EXIF orientation, then metadata is dropped below
      .resize({ width: MASTER_MAX_SIDE, height: MASTER_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, image: { buffer: data, width: info.width, height: info.height } };
  } catch {
    return { ok: false, message: "الملف ليس صورة صالحة أو تعذّرت معالجته." };
  }
}
