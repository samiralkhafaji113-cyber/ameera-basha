/** Human-readable Arabic text for audit_logs rows (pure → unit-tested). */
const ACTIONS: Record<string, string> = {
  "product.create": "أضاف منتجاً",
  "product.update": "عدّل منتجاً",
  "product.publish": "نشر منتجاً",
  "product.hide": "أخفى منتجاً",
  "product.archive": "أرشف منتجاً",
  "product.unpublish": "أعاد منتجاً كمسودة",
  "product.delete": "نقل منتجاً إلى المحذوفات",
  "product.restore": "استعاد منتجاً",
  "product.purge": "حذف منتجاً نهائياً",
  "product_image.add": "أضاف صورة لمنتج",
  "product_image.remove": "حذف صورة من منتج",
  "product_image.update": "عدّل صورة منتج",
  "reservation.create": "حجز جديد من الموقع",
  "reservation.status": "غيّر حالة حجز",
  "reservation.update": "عدّل ملاحظات حجز",
  "category.insert": "أضاف قسماً",
  "category.update": "عدّل قسماً",
  "category.delete": "حذف قسماً",
  "subcategory.insert": "أضاف قسماً فرعياً",
  "subcategory.update": "عدّل قسماً فرعياً",
  "subcategory.delete": "حذف قسماً فرعياً",
};

const RESERVATION_STATUS: Record<string, string> = {
  pending: "جديد",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "مكتمل",
  rejected: "مرفوض",
};

export const auditActionLabel = (action: string): string => ACTIONS[action] ?? action;

export function auditDetail(action: string, metadata: Record<string, unknown> | null | undefined): string {
  const m = metadata ?? {};
  const text = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
  if (action === "reservation.status") {
    return `${text("reservation_number")}: من ${RESERVATION_STATUS[text("from")] ?? text("from")} إلى ${RESERVATION_STATUS[text("to")] ?? text("to")}`;
  }
  if (action.startsWith("reservation.")) return [text("reservation_number"), text("product")].filter(Boolean).join(" · ");
  return text("name");
}
