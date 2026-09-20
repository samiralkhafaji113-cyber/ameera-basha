import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { can, isRole } from "./roles";
import type { Permission, Role } from "./roles";

export interface Staff {
  userId: string;
  email: string;
  role: Role;
  displayName: string | null;
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
  }
}

/**
 * The signed-in staff member, or null. Uses auth.getUser() (validated by the Auth server) and reads the
 * role from public.profiles – never from user_metadata, which a user can edit themselves.
 * Memoised per request.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", auth.user.id).maybeSingle();
  if (!profile || !isRole(profile.role)) return null;
  return { userId: auth.user.id, email: auth.user.email ?? "", role: profile.role, displayName: profile.display_name };
});

/** A signed-in Auth user (validated by the Auth server) – not necessarily staff. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
});

/**
 * For Server Components / pages.
 *  - not signed in                     → /admin/login
 *  - signed in but not staff           → /admin/access-denied  (a valid Auth user is not automatically an admin)
 *  - staff without this permission     → /admin/access-denied
 */
export async function requireStaffPage(permission: Permission = "products.read"): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect((await getAuthUserId()) ? "/admin/access-denied?reason=not-staff" : "/admin/login");
  if (!can(staff.role, permission)) redirect("/admin/access-denied?reason=forbidden");
  return staff;
}

/** For Server Actions / Route Handlers: throw so the caller can answer 401/403 (never trust the proxy alone). */
export async function requirePermission(permission: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new ForbiddenError("unauthenticated");
  if (!can(staff.role, permission)) throw new ForbiddenError("forbidden");
  return staff;
}
