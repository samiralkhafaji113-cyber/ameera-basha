/**
 * Database/RPC error codes → Arabic messages for the UI. The trigger/RPC messages are stable identifiers
 * (see supabase/migrations/…_logic.sql); anything unknown falls back to a generic message and is never shown raw.
 */
const MESSAGES: Record<string, string> = {
  // reservations
  invalid_name: "يرجى كتابة الاسم (حرفان على الأقل).",
  invalid_phone: "أدخل رقماً عراقياً صحيحاً مثل 07811404047.",
  invalid_governorate: "يرجى اختيار المحافظة.",
  invalid_district: "يرجى كتابة المنطقة أو الحي.",
  invalid_quantity: "الكمية يجب أن تكون بين 1 و 50.",
  invalid_address: "العنوان طويل جداً.",
  invalid_notes: "الملاحظات طويلة جداً.",
  invalid_size: "المقاس المختار غير متاح لهذا المنتج.",
  invalid_product: "هذا المنتج لم يعد متاحاً للحجز.",
  product_unavailable: "هذا المنتج غير متوفر حالياً.",
  rate_limited: "تم إرسال عدة طلبات خلال وقت قصير. حاول مرة أخرى بعد قليل أو تواصل معنا عبر واتساب.",
  invalid_status_transition: "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية.",
  // products / images
  cannot_publish_without_images: "لا يمكن نشر منتج بدون صورة واحدة على الأقل.",
  last_image_of_published_product: "لا يمكن حذف آخر صورة لمنتج منشور. أخفِ المنتج أولاً أو أضف صورة أخرى.",
  subcategory_mismatch: "القسم الفرعي لا يتبع القسم المختار.",
  forbidden_status_for_role: "ليست لديك صلاحية تنفيذ هذا الإجراء.",
  forbidden: "ليست لديك صلاحية تنفيذ هذا الإجراء.",
  not_found: "العنصر المطلوب غير موجود.",
  invalid_image_list: "قائمة الصور غير صالحة.",
  invalid_currency: "العملة غير صالحة.",
};

const GENERIC = "حدث خطأ غير متوقع. حاول مرة أخرى.";

export function arabicDbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return GENERIC;
  const message = error.message ?? "";
  if (MESSAGES[message]) return MESSAGES[message];
  const known = Object.keys(MESSAGES).find((k) => message.startsWith(k));
  if (known) return MESSAGES[known];
  if (error.code === "23505") return "هذه القيمة مستخدمة مسبقاً (مثل الرابط المختصر أو الاسم).";
  if (error.code === "23503") return "لا يمكن تنفيذ العملية لوجود بيانات مرتبطة.";
  if (error.code === "23514") return "إحدى القيم المدخلة غير صالحة.";
  if (error.code === "42501") return MESSAGES.forbidden;
  return GENERIC;
}
