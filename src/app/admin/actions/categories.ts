"use server";

import { failResult, formToRecord, isUuid, okResult, withPermission } from "@/lib/actions";
import type { ActionResult } from "@/lib/actions";
import { arabicDbError } from "@/lib/db-errors";
import { invalidateCatalogFromAction } from "@/lib/revalidate";
import { createSessionClient } from "@/lib/supabase/server";
import { parseCategoryInput } from "@/lib/validation/category";

const BUCKET = "store-media";
const BAD_ID = failResult("معرّف غير صالح.");
const SLUG_TAKEN = { slug: "هذا الرابط المختصر مستخدم." };

export type CategoryFormState = ActionResult | null;

export async function createCategoryAction(_prev: CategoryFormState, form: FormData): Promise<CategoryFormState> {
  return withPermission("categories.manage", async () => {
    const parsed = parseCategoryInput(formToRecord(form));
    if (!parsed.ok) return failResult("يرجى تصحيح الحقول المظللة.", parsed.errors as Record<string, string>);
    const supabase = await createSessionClient();
    const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const { error } = await supabase.from("categories").insert({ ...parsed.value, sort_order: (last?.[0]?.sort_order ?? 0) + 10 });
    if (error) return failResult(arabicDbError(error), error.code === "23505" ? SLUG_TAKEN : undefined);
    invalidateCatalogFromAction();
    return okResult("تمت إضافة القسم.");
  });
}

export async function updateCategoryAction(id: string, _prev: CategoryFormState, form: FormData): Promise<CategoryFormState> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const parsed = parseCategoryInput(formToRecord(form));
    if (!parsed.ok) return failResult("يرجى تصحيح الحقول المظللة.", parsed.errors as Record<string, string>);
    const supabase = await createSessionClient();
    const { error } = await supabase.from("categories").update(parsed.value).eq("id", id);
    if (error) return failResult(arabicDbError(error), error.code === "23505" ? SLUG_TAKEN : undefined);
    invalidateCatalogFromAction();
    return okResult("تم حفظ القسم.");
  });
}

export async function setCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.from("categories").update({ is_active: Boolean(active) }).eq("id", id);
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult(active ? "تم تفعيل القسم." : "تم تعطيل القسم. لن يظهر هو ومنتجاته في الموقع.");
  });
}

/** `orderedIds` is the complete new order; sort_order is rewritten in steps of 10 so inserts stay easy. */
export async function reorderCategoriesAction(orderedIds: string[]): Promise<ActionResult> {
  if (!Array.isArray(orderedIds) || orderedIds.length > 100 || !orderedIds.every(isUuid)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const supabase = await createSessionClient();
    for (const [i, id] of orderedIds.entries()) {
      const { error } = await supabase.from("categories").update({ sort_order: (i + 1) * 10 }).eq("id", id);
      if (error) return failResult(arabicDbError(error));
    }
    invalidateCatalogFromAction();
    return okResult("تم حفظ ترتيب الأقسام.");
  });
}

/**
 * A category that still has products (including trashed ones) cannot be deleted – move or remove them first.
 * The database enforces the same rule with a RESTRICT foreign key.
 */
export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const supabase = await createSessionClient();
    const { count: products } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
    if ((products ?? 0) > 0) return failResult(`لا يمكن حذف القسم لأنه يحتوي على ${products} منتج. انقل المنتجات إلى قسم آخر أولاً (أو عطّل القسم بدل حذفه).`);
    const { count: subs } = await supabase.from("subcategories").select("id", { count: "exact", head: true }).eq("category_id", id);
    if ((subs ?? 0) > 0) return failResult("احذف الأقسام الفرعية أولاً.");
    const { data: category } = await supabase.from("categories").select("image_path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return failResult(arabicDbError(error));
    if (category?.image_path) await supabase.storage.from(BUCKET).remove([category.image_path]);
    invalidateCatalogFromAction();
    return okResult("تم حذف القسم.");
  });
}

// ---------------------------------------------------------------- subcategories
export async function createSubcategoryAction(categoryId: string, _prev: CategoryFormState, form: FormData): Promise<CategoryFormState> {
  if (!isUuid(categoryId)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const parsed = parseCategoryInput(formToRecord(form), { prefix: "s" });
    if (!parsed.ok) return failResult("يرجى تصحيح الحقول المظللة.", parsed.errors as Record<string, string>);
    const supabase = await createSessionClient();
    const { data: last } = await supabase.from("subcategories").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1);
    const { error } = await supabase
      .from("subcategories")
      .insert({ category_id: categoryId, name: parsed.value.name, slug: parsed.value.slug, is_active: parsed.value.is_active, sort_order: (last?.[0]?.sort_order ?? 0) + 10 });
    if (error) return failResult(arabicDbError(error), error.code === "23505" ? SLUG_TAKEN : undefined);
    invalidateCatalogFromAction();
    return okResult("تمت إضافة القسم الفرعي.");
  });
}

export async function updateSubcategoryAction(id: string, name: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id) || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) return failResult("الاسم مطلوب (2 – 80 حرفاً).");
  return withPermission("categories.manage", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.from("subcategories").update({ name: name.trim(), is_active: Boolean(active) }).eq("id", id);
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    return okResult("تم حفظ القسم الفرعي.");
  });
}

export async function deleteSubcategoryAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return BAD_ID;
  return withPermission("categories.manage", async () => {
    const supabase = await createSessionClient();
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("subcategory_id", id);
    if ((count ?? 0) > 0) return failResult(`لا يمكن حذف القسم الفرعي لأنه يحتوي على ${count} منتج.`);
    const { data: sub } = await supabase.from("subcategories").select("image_path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("subcategories").delete().eq("id", id);
    if (error) return failResult(arabicDbError(error));
    if (sub?.image_path) await supabase.storage.from(BUCKET).remove([sub.image_path]);
    invalidateCatalogFromAction();
    return okResult("تم حذف القسم الفرعي.");
  });
}
