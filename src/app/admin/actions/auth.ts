"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";
import { isRole } from "@/lib/auth/roles";
import { createSessionClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface LoginState {
  error?: string;
  /** Echoed back so a failed attempt does not clear the e-mail field (React resets uncontrolled forms after an action). */
  email?: string;
}

const GENERIC = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

export async function signInAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) return { error: "الخادم غير مهيأ. راجع إعدادات البيئة." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > 254 || password.length > 200) return { error: GENERIC, email };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // Same message for "wrong email" and "wrong password" (no account enumeration). GoTrue rate-limits repeated attempts.
  if (error || !data.user) return { error: error?.status === 429 ? "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة." : GENERIC, email };

  // A valid Auth user is not necessarily staff: require a profile with a known role.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || !isRole(profile.role)) {
    await supabase.auth.signOut();
    return { error: "هذا الحساب غير مصرّح له بالدخول إلى لوحة التحكم.", email };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
