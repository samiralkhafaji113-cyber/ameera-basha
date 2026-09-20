import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card, PageHeader, ReservationStatusBadge, formatDateTime } from "@/components/admin/AdminUi";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { isUuid } from "@/lib/actions";
import { requireStaffPage } from "@/lib/auth/guard";
import type { ReservationStatus } from "@/lib/reservation-status";
import { createSessionClient } from "@/lib/supabase/server";
import { customerWhatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "تفاصيل الحجز" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-b border-line-soft py-3 last:border-b-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

export default async function ReservationDetailPage({ params }: PageProps<"/admin/reservations/[id]">) {
  await requireStaffPage("reservations.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createSessionClient();
  const { data: r } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [{ data: product }, { data: handler }] = await Promise.all([
    r.product_id ? supabase.from("products").select("id, slug, status, deleted_at").eq("id", r.product_id).maybeSingle() : Promise.resolve({ data: null }),
    r.handled_by ? supabase.from("profiles").select("display_name").eq("id", r.handled_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const status = r.status as ReservationStatus;

  return (
    <>
      <Link href="/admin/reservations" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
        <ArrowRight className="size-4" aria-hidden="true" />
        كل الحجوزات
      </Link>
      <PageHeader
        title={`حجز ${r.reservation_number}`}
        description={`سُجّل ${formatDateTime(r.created_at)}`}
        actions={<ReservationStatusBadge status={status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="بيانات الحجز">
          <dl>
            <Row label="رقم الحجز">
              <bdi dir="ltr" className="font-semibold tabular-nums">
                {r.reservation_number}
              </bdi>
            </Row>
            <Row label="المنتج">
              {r.product_name_snapshot}
              {product && !product.deleted_at && (
                <Link href={`/admin/products/${product.id}/edit`} className="ms-2 text-accent-text underline underline-offset-4">
                  فتح المنتج
                </Link>
              )}
              {!product && <span className="ms-2 text-xs text-muted">(المنتج لم يعد موجوداً – الاسم محفوظ وقت الحجز)</span>}
            </Row>
            <Row label="الكمية">{r.quantity}</Row>
            {r.price_snapshot !== null && r.currency_snapshot && (
              <Row label="السعر وقت الحجز">
                <span className="tabular-nums">{Number(r.price_snapshot).toLocaleString("en-US")}</span> {r.currency_snapshot === "IQD" ? "د.ع" : r.currency_snapshot}
              </Row>
            )}
            <Row label="المقاس">{r.size ?? "—"}</Row>
            <Row label="العميل">{r.customer_name}</Row>
            <Row label="الهاتف">
              <a href={`tel:+964${String(r.phone).slice(1)}`} dir="ltr" className="font-semibold tabular-nums underline-offset-4 hover:underline">
                {r.phone}
              </a>
            </Row>
            <Row label="المحافظة">{r.governorate}</Row>
            <Row label="المنطقة / الحي">{r.district}</Row>
            <Row label="العنوان">{r.address ?? "—"}</Row>
            <Row label="ملاحظات العميل">{r.notes ?? "—"}</Row>
            <Row label="آخر تغيير للحالة">
              {r.status_changed_at ? `${formatDateTime(r.status_changed_at)}${handler?.display_name ? ` · ${handler.display_name}` : ""}` : "—"}
            </Row>
          </dl>
        </Card>

        <Card title="الإجراءات">
          <ReservationActions
            id={r.id}
            status={status}
            whatsappHref={customerWhatsappUrl(r.phone, r.customer_name, r.reservation_number, r.product_name_snapshot)}
            initialNotes={r.admin_notes ?? ""}
          />
        </Card>
      </div>
    </>
  );
}
