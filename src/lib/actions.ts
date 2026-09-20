import "server-only";
import { ForbiddenError, requirePermission } from "@/lib/auth/guard";
import type { Staff } from "@/lib/auth/guard";
import type { Permission } from "@/lib/auth/roles";

/** Shape returned by every admin Server Action (serialisable → usable with useActionState). */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; errors?: Record<string, string> };

export const okResult = <T = undefined>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });
export const failResult = (message: string, errors?: Record<string, string>): ActionResult<never> => ({ ok: false, message, errors });

/**
 * Every mutating action starts here. It re-checks the session and the role on the server –
 * hiding a button in the UI is never treated as authorisation.
 */
export async function withPermission<T>(
  permission: Permission,
  run: (staff: Staff) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let staff: Staff;
  try {
    staff = await requirePermission(permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return failResult(e.message === "unauthenticated" ? "انتهت الجلسة. سجّل الدخول من جديد." : "ليست لديك صلاحية تنفيذ هذا الإجراء.");
    throw e;
  }
  return run(staff);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** FormData → plain record (multi-value keys become arrays). */
export function formToRecord(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const all = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}
