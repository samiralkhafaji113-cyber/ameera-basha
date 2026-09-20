/**
 * Reservation flow
 * ----------------
 * 1. The form is validated here (shared by the browser for fast feedback AND by the server action, which is the real gate).
 * 2. The server action stores the reservation in the database (RPC `create_reservation`) and returns its number.
 * 3. Only then can the customer open WhatsApp with a prepared message. Nothing is ever sent automatically –
 *    the customer taps «Send» inside WhatsApp themselves.
 */
export interface ReservationRequest {
  productId: string;
  productName: string;
  productUrl?: string;
  customerName: string;
  phone: string;
  governorate: string;
  district: string;
  address?: string;
  size?: string;
  quantity: number;
  notes?: string;
  /** Set once the reservation is saved – included in the WhatsApp message. */
  reservationNumber?: string;
}

export const IRAQI_GOVERNORATES = [
  "بغداد", "بابل", "البصرة", "نينوى", "أربيل", "السليمانية", "دهوك", "كركوك", "الأنبار", "ديالى",
  "صلاح الدين", "واسط", "ميسان", "ذي قار", "المثنى", "القادسية", "النجف", "كربلاء", "حلبجة",
] as const;

export type ReservationField = "customerName" | "phone" | "governorate" | "district" | "quantity";
export type ReservationErrors = Partial<Record<ReservationField, string>>;

/** Accepts 07xxxxxxxxx, +9647xxxxxxxxx, 009647xxxxxxxxx (spaces/dashes ignored, Arabic digits ok). */
export function normalizeIraqiPhone(input: string): string | null {
  const ascii = input.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s\-()]/g, "");
  const local = ascii.replace(/^(\+|00)?964/, "0");
  return /^07\d{9}$/.test(local) ? local : null;
}

export function validateReservation(input: {
  customerName: string;
  phone: string;
  governorate: string;
  district: string;
  quantity: number;
}): ReservationErrors {
  const errors: ReservationErrors = {};
  if (input.customerName.trim().length < 2) errors.customerName = "يرجى كتابة الاسم (حرفان على الأقل).";
  if (!normalizeIraqiPhone(input.phone)) errors.phone = "أدخل رقماً عراقياً صحيحاً مثل 07811404047.";
  if (!input.governorate) errors.governorate = "يرجى اختيار المحافظة.";
  if (input.district.trim().length < 2) errors.district = "يرجى كتابة المنطقة أو الحي.";
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
    errors.quantity = "الكمية يجب أن تكون بين 1 و 50.";
  }
  return errors;
}

/**
 * The prepared WhatsApp text carries only what the store needs to recognise the request: number, product, size,
 * quantity and the customer's name. Phone, address and notes are already stored in the reservation (admin panel) –
 * they are deliberately NOT repeated in a chat message.
 */
export function buildReservationMessage(r: ReservationRequest): string {
  const lines = [
    "السلام عليكم، أود حجز القطعة التالية:",
    r.reservationNumber ? `رقم الحجز: ${r.reservationNumber}` : "",
    `المنتج: ${r.productName}`,
    r.size ? `المقاس: ${r.size}` : "",
    `الكمية: ${r.quantity}`,
    `الاسم: ${r.customerName.trim()}`,
  ];
  return lines.filter(Boolean).join("\n");
}

