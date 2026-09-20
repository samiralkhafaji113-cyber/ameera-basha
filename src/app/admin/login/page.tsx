import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoImage } from "@/components/layout/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getStaff } from "@/lib/auth/guard";
import { safeNext } from "@/lib/auth/next";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "تسجيل الدخول" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNext(params.next) : undefined;
  if (await getStaff()) redirect(next ?? "/admin"); // already signed in as staff

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-line-soft bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoImage variant="mark" className="h-16" />
          <h1 className="!text-2xl">لوحة التحكم</h1>
          <p className="text-sm text-muted">مجمع أميرة باشا – دخول الموظفين فقط</p>
        </div>
        {isSupabaseConfigured() ? (
          <LoginForm next={next} />
        ) : (
          <p role="alert" className="rounded-md border border-warning/30 bg-warning-bg p-3 text-sm font-semibold text-warning">
            الخادم غير مهيأ: أضف إعدادات Supabase إلى ملف البيئة (انظر README).
          </p>
        )}
      </div>
    </main>
  );
}
