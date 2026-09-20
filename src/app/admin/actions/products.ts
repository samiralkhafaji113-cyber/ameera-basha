"use server";

import { redirect } from "next/navigation";
import { failResult, formToRecord, isUuid, okResult, withPermission } from "@/lib/actions";
import type { ActionResult } from "@/lib/actions";
import { can } from "@/lib/auth/roles";
import { arabicDbError } from "@/lib/db-errors";
import { invalidateCatalogFromAction } from "@/lib/revalidate";
import { createSessionClient } from "@/lib/supabase/server";
import { PRODUCT_STATUSES, parseProductInput } from "@/lib/validation/product";
import type { ProductStatus } from "@/lib/validation/product";

const BUCKET = "store-media";
const BAD_ID = failResult("معرّف غير صالح.");

export type ProductFormState = ActionResult | null;

// ---------------------------------------------------------------- create / update
export async function createProductAction(_prev: ProductFormState, form: FormData): Promise<ProductFormState> {
  let createdId: string | undefined;
  const result = await withPermission("products.write", async () => {
    const parsed = parseProductInput(formToRecord(form));
    if (!parsed.ok) return failResult("يرجى تصحيح الحقول المظللة.", parsed.errors as Record<string, string>);
    const supabase = await createSessionClient();
    // Always created as a draft: publishing needs at least one image (enforced again by a DB trigger).
    const { data, error } = await supabase.from("products").insert({ ...parsed.value, status: "draft" }).select("id").single();
    if (error || !data) return failResult(arabicDbError(error), error?.code === "23505" ? { slug: "هذا الرابط المختصر مستخدم لمنتج آخر." } : undefined);
    createdId = data.id;
    return okResult("تم إنشاء المنتج كمسودة. أضف الصور ثم انشره.");
  });
  if (result.ok && createdId) redirect(`/admin/products/${createdId}/edit?created=1`);
  return result;
}

export async function updateProductAction(id: string, _prev: ProductFormState, form: FormData): Promise<ProductFormState> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("products.write", async (staff) => {
    const parsed = parseProductInput(formToRecord(form));
    if (!parsed.ok) return failResult("يرجى تصحيح الحقول المظللة.", parsed.errors as Record<string, string>);
    const patch: Record<string, unknown> = { ...parsed.value };
    // Featuring a product is a publishing decision; editors keep whatever value it already has.
    if (!can(staff.role, "products.publish")) delete patch.featured;
    const supabase = await createSessionClient();
    const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) return failResult(arabicDbError(error), error.code === "23505" ? { slug: "هذا الرابط المختصر مستخدم لمنتج آخر." } : undefined);
    if (!data) return failResult("المنتج غير موجود.");
    invalidateCatalogFromAction();
    return okResult("تم حفظ التعديلات.");
  });
}

// ---------------------------------------------------------------- status / visibility
export async function setProductStatusAction(id: string, status: ProductStatus): Promise<ActionResult> {
  if (!isUuid(id) || !(PRODUCT_STATUSES as readonly string[]).includes(status)) return BAD_ID;
  return withPermission("products.publish", async () => {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.from("products").update({ status }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
    if (error) return failResult(arabicDbError(error));
    if (!data) return failResult("المنتج غير موجود أو موجود في سلة المحذوفات.");
    invalidateCatalogFromAction();
    const label = { published: "تم نشر المنتج.", hidden: "تم إخفاء المنتج عن الموقع.", archived: "تمت أرشفة المنتج.", draft: "أُعيد المنتج كمسودة." }[status];
    return okResult(label);
  });
}

export async function setFeaturedAction(id: string, featured: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("products.publish", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.from("products").update({ featured: Boolean(featured) }).eq("id", id);
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult(featured ? "أُضيف المنتج إلى المنتجات المميزة." : "أُزيل المنتج من المنتجات المميزة.");
  });
}

// ---------------------------------------------------------------- soft delete / restore / purge
/** Soft delete: the product leaves the site and lists, but its data and images are kept and can be restored. */
export async function trashProductAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("products.delete", async () => {
    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), status: "hidden", featured: false })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failResult(arabicDbError(error));
    if (!data) return failResult("المنتج غير موجود.");
    invalidateCatalogFromAction();
    return okResult("نُقل المنتج إلى المحذوفات. يمكنك استعادته لاحقاً.");
  });
}

export async function restoreProductAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("products.delete", async () => {
    const supabase = await createSessionClient();
    // Restored products come back hidden – publishing again is a separate, explicit decision.
    const { data, error } = await supabase.from("products").update({ deleted_at: null, status: "hidden" }).eq("id", id).not("deleted_at", "is", null).select("id").maybeSingle();
    if (error) return failResult(arabicDbError(error));
    if (!data) return failResult("المنتج غير موجود في المحذوفات.");
    invalidateCatalogFromAction();
    return okResult("تمت استعادة المنتج (مخفي). يمكنك نشره عند الجاهزية.");
  });
}

/** Permanent delete (admin only, only from the trash): removes the images' files from Storage first, then the row. */
export async function purgeProductAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("products.purge", async () => {
    const supabase = await createSessionClient();
    const { data: product } = await supabase.from("products").select("id, deleted_at").eq("id", id).maybeSingle();
    if (!product) return failResult("المنتج غير موجود.");
    if (!product.deleted_at) return failResult("يجب نقل المنتج إلى المحذوفات أولاً.");
    const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
    const paths = (images ?? []).map((i) => i.storage_path);
    if (paths.length) {
      const removed = await supabase.storage.from(BUCKET).remove(paths);
      if (removed.error) return failResult("تعذّر حذف ملفات الصور. لم يُحذف المنتج.");
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult("تم حذف المنتج وصوره نهائياً.");
  });
}

// ---------------------------------------------------------------- images
// Deleting a photo (row + file) is a privileged action: admin / manager only (storage + table RLS enforce the same).
export async function deleteImageAction(imageId: string): Promise<ActionResult> {
  if (!isUuid(imageId)) return BAD_ID;
  return withPermission("products.delete", async () => {
    const supabase = await createSessionClient();
    const { data: image } = await supabase.from("product_images").select("storage_path").eq("id", imageId).maybeSingle();
    if (!image) return failResult("الصورة غير موجودة.");
    // Row first: the DB refuses to remove the last image of a published product.
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return failResult(arabicDbError(error));
    await supabase.storage.from(BUCKET).remove([image.storage_path]);
    invalidateCatalogFromAction();
    return okResult("تم حذف الصورة.");
  });
}

export async function setPrimaryImageAction(imageId: string): Promise<ActionResult> {
  if (!isUuid(imageId)) return BAD_ID;
  return withPermission("products.write", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("set_primary_image", { p_image_id: imageId });
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult("تم تعيين الصورة الرئيسية.");
  });
}

export async function reorderImagesAction(productId: string, orderedIds: string[]): Promise<ActionResult> {
  if (!isUuid(productId) || !Array.isArray(orderedIds) || orderedIds.length > 50 || !orderedIds.every(isUuid)) return BAD_ID;
  return withPermission("products.write", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("reorder_product_images", { p_product_id: productId, p_ids: orderedIds });
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult("تم حفظ ترتيب الصور.");
  });
}

export async function updateImageAltAction(imageId: string, alt: string): Promise<ActionResult> {
  if (!isUuid(imageId) || typeof alt !== "string") return BAD_ID;
  return withPermission("products.write", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.from("product_images").update({ alt_text: alt.trim().slice(0, 200) || null }).eq("id", imageId);
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult("تم حفظ النص البديل.");
  });
}
