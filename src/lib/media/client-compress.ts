/**
 * Browser-side preparation of a photo before it is uploaded to /api/admin/media.
 *
 * Why: serverless hosting (Vercel) rejects request bodies above ~4.5 MB, while phone photos are commonly 3–10 MB.
 * The photo is downscaled and re-encoded (WebP) in the browser so a normal upload is a few hundred KB. The SERVER still
 * validates everything again (magic bytes, size, dimensions) and re-encodes – this step is only about transport size.
 * If the browser cannot decode the file (e.g. AVIF on some browsers) the original is sent unchanged.
 */
export const UPLOAD_MAX_SIDE = 2400;
/** Files at or below this size are sent as they are (unless one side is larger than UPLOAD_MAX_SIDE). */
export const UPLOAD_PASSTHROUGH_BYTES = 1_500_000;

/** Pure: target size that fits inside `max` on the longest side, never upscaling. */
export function planResize(width: number, height: number, max = UPLOAD_MAX_SIDE): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height, scaled: false };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k), scaled: true };
}

export async function prepareForUpload(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const plan = planResize(bitmap.width, bitmap.height);
    if (!plan.scaled && file.size <= UPLOAD_PASSTHROUGH_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp") return file;
    // only use the re-encoded copy when it actually helps
    if (blob.size >= file.size && !plan.scaled) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Human message for a failed upload response (Vercel answers 413 with a non-JSON body). */
export async function uploadErrorMessage(res: Response): Promise<string> {
  if (res.status === 413) return "حجم الصورة كبير جداً. جرّب صورة أصغر.";
  try {
    const json = (await res.json()) as { message?: string };
    if (json.message) return json.message;
  } catch {
    /* non-JSON error page */
  }
  return "فشل الرفع.";
}
