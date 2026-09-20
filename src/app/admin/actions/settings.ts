"use server";

import { failResult, okResult, withPermission } from "@/lib/actions";
import type { ActionResult } from "@/lib/actions";
import { arabicDbError } from "@/lib/db-errors";
import { invalidateCatalogFromAction } from "@/lib/revalidate";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * The 72 imported prices come from Telegram posts without a stated currency, so they are stored unverified and the
 * site shows «السعر عند الاستفسار». Once the owner confirms the currency, one click makes those prices public.
 * Admin-only (enforced here, in the RPC and by RLS).
 */
export async function confirmPricesCurrencyAction(currency: string): Promise<ActionResult<{ updated: number }>> {
  if (currency !== "IQD" && currency !== "USD") return failResult("العملة غير صالحة.");
  return withPermission("settings.manage", async () => {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc("confirm_prices_currency", { p_currency: currency });
    if (error) return failResult(arabicDbError(error));
    invalidateCatalogFromAction();
    const updated = typeof data === "number" ? data : 0;
    return okResult(updated ? `تم تأكيد أسعار ${updated} منتج بالعملة ${currency}.` : "لا توجد أسعار غير مؤكدة.", { updated });
  });
}

export async function changePasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult | null> {
  return withPermission("products.read", async () => {
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return failResult("كلمة المرور: 10 أحرف على الأقل وتحتوي حرفاً كبيراً وصغيراً ورقماً.", { password: "كلمة مرور ضعيفة." });
    }
    if (password !== confirm) return failResult("تأكيد كلمة المرور غير مطابق.", { confirm: "غير مطابق." });
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return failResult("تعذّر تغيير كلمة المرور. حاول مرة أخرى.");
    return okResult("تم تغيير كلمة المرور.");
  });
}
