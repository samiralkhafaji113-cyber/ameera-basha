import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/admin/AdminUi";
import { ChangePasswordPanel, ConfirmPricesPanel } from "@/components/admin/SettingsPanels";
import { requireStaffPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "الإعدادات" };

const ROLE = { admin: "مدير النظام", manager: "مدير", editor: "محرر" } as const;

export default async function SettingsPage() {
  const staff = await requireStaffPage("products.read");
  let unverified = 0;
  if (can(staff.role, "settings.manage")) {
    const supabase = await createSessionClient();
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).not("price", "is", null).eq("price_verified", false);
    unverified = count ?? 0;
  }
  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="flex flex-col gap-6">
        <Card title="حسابي">
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="font-semibold text-muted">البريد الإلكتروني</dt>
            <dd dir="ltr" className="text-end sm:text-start">
              {staff.email}
            </dd>
            <dt className="font-semibold text-muted">الصلاحية</dt>
            <dd>{ROLE[staff.role]}</dd>
          </dl>
        </Card>
        <ChangePasswordPanel />
        {can(staff.role, "settings.manage") && <ConfirmPricesPanel unverified={unverified} />}
      </div>
    </>
  );
}
