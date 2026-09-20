"use server";

import { arabicDbError } from "@/lib/db-errors";
import { normalizeIraqiPhone, validateReservation } from "@/lib/reservation";
import type { ReservationErrors } from "@/lib/reservation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export interface ReservationInput {
  productId: string;
  customerName: string;
  phone: string;
  governorate: string;
  district: string;
  address?: string;
  size?: string;
  quantity: number;
  notes?: string;
  /** Honeypot: real users never see or fill this field. */
  website?: string;
}

export type SubmitReservationResult =
  | { ok: true; reservationNumber: string; createdAt: string }
  | { ok: false; reason: "validation"; errors: ReservationErrors; message: string }
  | { ok: false; reason: "rejected" | "unavailable"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Public reservation endpoint. The reservation is validated again here and inside the database function
 * (`create_reservation`, SECURITY DEFINER) – the browser is never trusted. Runs as the anonymous role: it can
 * only call this one function, never read or change reservations directly.
 */
export async function submitReservationAction(input: ReservationInput): Promise<SubmitReservationResult> {
  const clean = {
    productId: text(input?.productId, 64),
    customerName: text(input?.customerName, 80),
    phone: text(input?.phone, 32),
    governorate: text(input?.governorate, 40),
    district: text(input?.district, 80),
    address: text(input?.address, 300),
    size: text(input?.size, 40),
    quantity: Number(input?.quantity),
    notes: text(input?.notes, 600),
  };

  // Bots fill hidden fields. Answer "success-shaped" nothing – just refuse quietly.
  if (text(input?.website, 200)) {
    return { ok: false, reason: "rejected", message: "تعذّر إرسال الطلب." };
  }

  const errors = validateReservation(clean);
  if (Object.keys(errors).length) {
    return { ok: false, reason: "validation", errors, message: "يرجى تصحيح الحقول المظللة." };
  }
  if (!UUID.test(clean.productId) || !isSupabaseConfigured()) {
    return { ok: false, reason: "unavailable", message: "نظام الحجز غير متاح حالياً. تواصل معنا عبر واتساب." };
  }

  const { data, error } = await createPublicClient({ cache: false }).rpc("create_reservation", {
    p_product_id: clean.productId,
    p_customer_name: clean.customerName,
    p_phone: normalizeIraqiPhone(clean.phone) ?? clean.phone,
    p_governorate: clean.governorate,
    p_district: clean.district,
    p_address: clean.address || null,
    p_size: clean.size || null,
    p_quantity: clean.quantity,
    p_notes: clean.notes || null,
  });

  if (error) {
    const message = arabicDbError(error);
    return { ok: false, reason: error.message === "rate_limited" ? "rejected" : "unavailable", message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reservation_number) {
    return { ok: false, reason: "unavailable", message: "تعذّر حفظ الحجز. حاول مرة أخرى." };
  }
  return { ok: true, reservationNumber: row.reservation_number as string, createdAt: row.created_at as string };
}
