import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { signOutAction } from "@/app/admin/actions/auth";
import { LogoImage } from "@/components/layout/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { getAuthUserId, getStaff } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "غير مصرّح" };
export const dynamic = "force-dynamic";

/** Shown to a signed-in person who is not allowed to see something (not staff at all, or missing permission). */
export default async function AccessDeniedPage({ searchParams }: PageProps<"/admin/access-denied">) {
  const params = await searchParams;
  if (!(await getAuthUserId())) redirect("/admin/login");
  const staff = await getStaff();
  const notStaff = !staff || params.reason === "not-staff";

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-line-soft bg-surface p-8 text-center shadow-card">
        <LogoImage variant="mark" className="h-14" />
        <span className="grid size-14 place-items-center rounded-full bg-error-bg text-error">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </span>
        <h1 className="!text-2xl">غير مصرّح لك بالدخول</h1>
        <p className="text-sm leading-7 text-muted">
          {notStaff ? "هذا الحساب غير مضاف كموظف في لوحة التحكم. تواصل مع مدير النظام إن كنت تحتاج صلاحية." : "ليست لديك صلاحية الوصول إلى هذه الصفحة أو تنفيذ هذا الإجراء."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {!notStaff && <ButtonLink href="/admin">العودة إلى لوحة التحكم</ButtonLink>}
          <form action={signOutAction}>
            <button type="submit" className="inline-flex h-12 items-center rounded-md border border-line px-6 text-[0.9375rem] font-semibold hover:border-primary hover:bg-surface-warm">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
