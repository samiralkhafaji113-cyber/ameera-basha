"use server";

import { revalidatePath } from "next/cache";
import { failResult, isUuid, okResult, withPermission } from "@/lib/actions";
import type { ActionResult } from "@/lib/actions";
import { arabicDbError } from "@/lib/db-errors";
import { STATUS_LABEL, canTransition, isReservationStatus } from "@/lib/reservation-status";
import { createSessionClient } from "@/lib/supabase/server";

export async function setReservationStatusAction(id: string, status: string): Promise<ActionResult> {
  if (!isUuid(id) || !isReservationStatus(status)) return failResult("طلب غير صالح.");
  return withPermission("reservations.manage", async () => {
    const supabase = await createSessionClient();
    const { data: current } = await supabase.from("reservations").select("status").eq("id", id).maybeSingle();
    if (!current) return failResult("الحجز غير موجود.");
    // Friendly early check; the trigger in the database is the authority.
    if (isReservationStatus(current.status) && !canTransition(current.status, status)) {
      return failResult(`لا يمكن الانتقال من «${STATUS_LABEL[current.status]}» إلى «${STATUS_LABEL[status]}».`);
    }
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) return failResult(arabicDbError(error));
    revalidatePath("/admin", "layout");
    return okResult(`تم تحديث الحالة إلى «${STATUS_LABEL[status]}».`);
  });
}

export async function saveReservationNotesAction(id: string, notes: string): Promise<ActionResult> {
  if (!isUuid(id) || typeof notes !== "string" || notes.length > 1000) return failResult("الملاحظات طويلة جداً (الحد 1000 حرف).");
  return withPermission("reservations.manage", async () => {
    const supabase = await createSessionClient();
    const { error } = await supabase.from("reservations").update({ admin_notes: notes.trim() || null }).eq("id", id);
    if (error) return failResult(arabicDbError(error));
    revalidatePath(`/admin/reservations/${id}`);
    return okResult("تم حفظ الملاحظات.");
  });
}
