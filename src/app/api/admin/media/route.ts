import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/auth/guard";
import { processImage } from "@/lib/media/process-image";
import { invalidateCatalogFromRoute } from "@/lib/revalidate";
import { createSessionClient } from "@/lib/supabase/server";
import { IMAGE_LIMITS, checkUpload } from "@/lib/validation/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "store-media";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (message: string, status: number) => NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });

/** Same-origin only: the admin UI is the only legitimate caller (defence in depth on top of SameSite cookies). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/media  (multipart: file, target = product | category | subcategory, id = uuid, alt?)
 *
 * Why a Route Handler and not a Server Action: Server Actions cap request bodies at 1 MB by default and this
 * endpoint receives photos. Everything is validated here – the browser is never trusted:
 *   session → role → origin → size → magic bytes → decode/dimensions → re-encode to WebP (metadata stripped)
 * The file is stored with the *user's* session, so Storage RLS (staff only) applies as a second gate.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("طلب غير مسموح.", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("تعذّر قراءة الطلب.", 400);
  }
  const target = String(form.get("target") ?? "product");
  const id = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!["product", "category", "subcategory"].includes(target) || !UUID.test(id)) return fail("طلب غير صالح.", 400);
  if (!(file instanceof File)) return fail("لم يتم إرفاق ملف.", 400);

  try {
    await requirePermission(target === "product" ? "products.write" : "categories.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return fail(e.message === "unauthenticated" ? "يجب تسجيل الدخول." : "ليست لديك صلاحية.", e.message === "unauthenticated" ? 401 : 403);
    throw e;
  }

  // Cheap checks first, before reading the body into memory.
  if (file.size > IMAGE_LIMITS.maxBytes) return fail("حجم الصورة كبير جداً (الحد الأقصى 8 ميغابايت).", 413);
  const raw = Buffer.from(await file.arrayBuffer());
  const check = checkUpload(raw.length, raw.subarray(0, 16));
  if (!check.ok) return fail(check.message, 415);

  const supabase = await createSessionClient();

  // Per-product image cap
  if (target === "product") {
    const { count, error } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (error) return fail("تعذّر التحقق من المنتج.", 400);
    if ((count ?? 0) >= IMAGE_LIMITS.maxImagesPerProduct) return fail(`الحد الأقصى ${IMAGE_LIMITS.maxImagesPerProduct} صورة لكل منتج.`, 409);
  }

  const processed = await processImage(raw);
  if (!processed.ok) return fail(processed.message, 422);
  const { buffer, width, height } = processed.image;

  const folder = target === "product" ? "products" : target === "category" ? "categories" : "subcategories";
  const path = `${folder}/${id}/${randomUUID()}.webp`;

  const upload = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (upload.error) return fail("تعذّر رفع الصورة.", 500);
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  if (target === "product") {
    const { data: product } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
    if (!product) {
      await supabase.storage.from(BUCKET).remove([path]);
      return fail("المنتج غير موجود.", 404);
    }
    const alt = String(form.get("alt") ?? "").trim().slice(0, 200) || product.name;
    const { data: last } = await supabase.from("product_images").select("sort_order").eq("product_id", id).order("sort_order", { ascending: false }).limit(1);
    const { data: row, error } = await supabase
      .from("product_images")
      .insert({ product_id: id, storage_path: path, public_url: publicUrl, alt_text: alt, width, height, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
      .select("id, public_url, alt_text, width, height, sort_order, is_primary")
      .single();
    if (error || !row) {
      await supabase.storage.from(BUCKET).remove([path]); // never leave an orphan file
      return fail("تعذّر حفظ بيانات الصورة.", 500);
    }
    invalidateCatalogFromRoute();
    return NextResponse.json({ ok: true, image: { ...row, storage_path: path } }, { headers: { "Cache-Control": "no-store" } });
  }

  // category / subcategory cover
  const table = target === "category" ? "categories" : "subcategories";
  const { data: old } = await supabase.from(table).select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from(table).update({ image_path: path, image_url: publicUrl }).eq("id", id);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return fail("تعذّر حفظ صورة القسم.", 500);
  }
  if (old?.image_path) await supabase.storage.from(BUCKET).remove([old.image_path]);
  invalidateCatalogFromRoute();
  return NextResponse.json({ ok: true, image: { public_url: publicUrl, storage_path: path, width, height } }, { headers: { "Cache-Control": "no-store" } });
}
