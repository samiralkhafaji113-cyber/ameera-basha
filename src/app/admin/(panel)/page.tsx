import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CircleAlert, Eye, EyeOff, Package, Star } from "lucide-react";
import { AutoRefresh } from "@/components/admin/AdminClient";
import { AdminEmpty, Card, PageHeader, ReservationStatusBadge, formatDateTime } from "@/components/admin/AdminUi";
import { ButtonLink } from "@/components/ui/Button";
import { requireStaffPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { auditActionLabel, auditDetail } from "@/lib/audit-labels";
import type { ReservationStatus } from "@/lib/reservation-status";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { absolute: "لوحة التحكم" } };

interface Stats {
  products_total: number;
  products_published: number;
  products_hidden: number;
  products_draft: number;
  products_featured: number;
  products_trashed: number;
  reservations_pending: number;
  reservations_active: number;
  reservations_completed: number;
}

function Stat({ label, value, href, icon, tone }: { label: string; value: number; href?: string; icon?: React.ReactNode; tone?: "accent" }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-semibold text-muted">
        {icon}
        {label}
      </span>
      <span className={tone === "accent" ? "text-3xl font-bold tabular-nums text-accent-text" : "text-3xl font-bold tabular-nums"}>{value}</span>
    </>
  );
  const cls = "flex flex-col gap-1 rounded-lg border border-line-soft bg-surface p-4 shadow-card";
  return href ? (
    <Link href={href} className={`${cls} transition-[border-color,box-shadow] hover:border-line hover:shadow-card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function DashboardPage() {
  const staff = await requireStaffPage("products.read");
  const supabase = await createSessionClient();
  const canReservations = can(staff.role, "reservations.manage");
  const canAudit = can(staff.role, "audit.read");

  const [statsRes, latestRes, auditRes, unverifiedRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    canReservations
      ? supabase.from("reservations").select("id, reservation_number, customer_name, product_name_snapshot, status, created_at").order("created_at", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] as never[] }),
    canAudit ? supabase.from("audit_logs").select("id, user_id, action, metadata, created_at").order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] as never[] }),
    supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).not("price", "is", null).eq("price_verified", false),
  ]);

  const stats = (statsRes.data ?? {}) as Partial<Stats>;
  const n = (k: keyof Stats) => Number(stats[k] ?? 0);
  const latest = (latestRes.data ?? []) as { id: string; reservation_number: string; customer_name: string; product_name_snapshot: string; status: ReservationStatus; created_at: string }[];
  const audit = (auditRes.data ?? []) as { id: string; user_id: string | null; action: string; metadata: Record<string, unknown>; created_at: string }[];
  const unverified = unverifiedRes.count ?? 0;

  // who did it (names only for the rows shown)
  const ids = [...new Set(audit.map((a) => a.user_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.display_name ?? "موظف");
  }

  return (
    <>
      <PageHeader title="لوحة التحكم" description="نظرة عامة على المنتجات والحجوزات." actions={<AutoRefresh />} />

      {canReservations && n("reservations_pending") > 0 && (
        <Link
          href="/admin/reservations?status=pending"
          className="mb-6 flex items-center gap-3 rounded-lg border border-accent/40 bg-surface-sand p-4 font-semibold text-text transition-colors hover:bg-surface-sand-strong"
        >
          <BellRing className="size-5 shrink-0 text-accent-text" aria-hidden="true" />
          <span role="status">{n("reservations_pending")} حجوزات جديدة بانتظار المراجعة</span>
        </Link>
      )}

      {can(staff.role, "settings.manage") && unverified > 0 && (
        <Link href="/admin/settings" className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg p-4 text-sm text-text">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <strong className="font-bold">{unverified} منتجاً</strong> لديها أسعار غير مؤكدة العملة، ولذلك يظهر للزوار «السعر عند الاستفسار». أكّد العملة من الإعدادات لإظهار الأسعار.
          </span>
        </Link>
      )}

      <h2 className="mb-3 !text-lg">المنتجات</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي المنتجات" value={n("products_total")} href="/admin/products" icon={<Package className="size-4" aria-hidden="true" />} />
        <Stat label="منشورة" value={n("products_published")} href="/admin/products?status=published" icon={<Eye className="size-4" aria-hidden="true" />} />
        <Stat label="مخفية" value={n("products_hidden")} href="/admin/products?status=hidden" icon={<EyeOff className="size-4" aria-hidden="true" />} />
        <Stat label="مميزة" value={n("products_featured")} href="/admin/products?featured=1" icon={<Star className="size-4" aria-hidden="true" />} />
      </div>

      {canReservations && (
        <>
          <h2 className="mb-3 !text-lg">الحجوزات</h2>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="جديدة" value={n("reservations_pending")} href="/admin/reservations?status=pending" tone="accent" />
            <Stat label="قيد المعالجة" value={n("reservations_active")} href="/admin/reservations?status=contacted" />
            <Stat label="مكتملة" value={n("reservations_completed")} href="/admin/reservations?status=completed" />
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {canReservations && (
          <Card title="أحدث الحجوزات" actions={<ButtonLink href="/admin/reservations" variant="ghost" size="sm">عرض الكل</ButtonLink>}>
            {latest.length === 0 ? (
              <AdminEmpty title="لا توجد حجوزات" text="ستظهر هنا الحجوزات التي يسجلها الزوار." />
            ) : (
              <ul className="divide-y divide-line-soft">
                {latest.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/reservations/${r.id}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-surface-warm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{r.customer_name}</span>
                        <span className="block truncate text-xs text-muted">
                          <bdi dir="ltr">{r.reservation_number}</bdi> · {r.product_name_snapshot}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <ReservationStatusBadge status={r.status} />
                        <span className="text-xs text-muted">{formatDateTime(r.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {canAudit && (
          <Card title="آخر النشاطات">
            {audit.length === 0 ? (
              <AdminEmpty title="لا توجد نشاطات" />
            ) : (
              <ul className="divide-y divide-line-soft">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold">{a.user_id ? (names.get(a.user_id) ?? "موظف") : "زائر / النظام"}</span> {auditActionLabel(a.action)}
                      <span className="block truncate text-xs text-muted">{auditDetail(a.action, a.metadata)}</span>
                    </span>
                    <time dateTime={a.created_at} className="shrink-0 text-xs text-muted">
                      {formatDateTime(a.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
