import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { FilterPanel } from "@/components/admin/FilterPanel";
import { AutoRefresh } from "@/components/admin/AdminClient";
import { AdminEmpty, Card, PageHeader, Pagination, ReservationStatusBadge, formatDateTime } from "@/components/admin/AdminUi";
import { ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { requireStaffPage } from "@/lib/auth/guard";
import { IRAQI_GOVERNORATES, normalizeIraqiPhone } from "@/lib/reservation";
import { RESERVATION_STATUSES, STATUS_LABEL, isReservationStatus, sanitizeSearchTerm } from "@/lib/reservation-status";
import type { ReservationStatus } from "@/lib/reservation-status";
import { createSessionClient } from "@/lib/supabase/server";
import { customerWhatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "الحجوزات" };

const PAGE_SIZE = 20;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  id: string;
  reservation_number: string;
  customer_name: string;
  phone: string;
  product_name_snapshot: string;
  quantity: number;
  governorate: string;
  status: ReservationStatus;
  created_at: string;
}

export default async function AdminReservationsPage({ searchParams }: PageProps<"/admin/reservations">) {
  await requireStaffPage("reservations.manage");
  const sp = await searchParams;
  const q = sanitizeSearchTerm(one(sp.q));
  const product = sanitizeSearchTerm(one(sp.product));
  const status = one(sp.status);
  const governorate = one(sp.governorate);
  const from = DATE.test(one(sp.from)) ? one(sp.from) : "";
  const to = DATE.test(one(sp.to)) ? one(sp.to) : "";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const supabase = await createSessionClient();
  let query = supabase
    .from("reservations")
    .select("id, reservation_number, customer_name, phone, product_name_snapshot, quantity, governorate, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (isReservationStatus(status)) query = query.eq("status", status);
  if ((IRAQI_GOVERNORATES as readonly string[]).includes(governorate)) query = query.eq("governorate", governorate);
  if (from) query = query.gte("created_at", `${from}T00:00:00+03:00`); // store time zone: Asia/Baghdad
  if (to) query = query.lt("created_at", new Date(new Date(`${to}T00:00:00+03:00`).getTime() + 86_400_000).toISOString());
  if (product) query = query.ilike("product_name_snapshot", `%${product}%`);
  if (q) {
    const phone = normalizeIraqiPhone(q);
    const clauses = [`reservation_number.ilike.%${q}%`, `customer_name.ilike.%${q}%`, `product_name_snapshot.ilike.%${q}%`, `phone.ilike.%${q}%`];
    if (phone) clauses.push(`phone.eq.${phone}`);
    query = query.or(clauses.join(","));
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const filtered = Boolean(q || product || status || governorate || from || to);

  const href = (p: number, override: Record<string, string> = {}) => {
    const u = new URLSearchParams();
    const all: Record<string, string> = { q, product, status, governorate, from, to, ...override };
    for (const [k, v] of Object.entries(all)) if (v) u.set(k, v);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `/admin/reservations?${s}` : "/admin/reservations";
  };

  return (
    <>
      <PageHeader title="الحجوزات" description={`${total} حجز`} actions={<AutoRefresh />} />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="حالة الحجز">
        {[{ id: "", label: "الكل" }, ...RESERVATION_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] }))].map((t) => {
          const active = status === t.id;
          return (
            <Link
              key={t.id || "all"}
              href={href(1, { status: t.id })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-primary hover:bg-surface-warm"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <FilterPanel id="reservation-filters" activeCount={[q, product, governorate, from, to].filter(Boolean).length}>
      <form method="get" className="grid gap-3 rounded-lg border border-line-soft bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative sm:col-span-2">
          <label htmlFor="rq" className="sr-only">
            بحث برقم الحجز أو اسم العميل أو الهاتف أو المنتج
          </label>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input id="rq" name="q" defaultValue={q} placeholder="رقم الحجز، اسم العميل، الهاتف، المنتج…" className="h-11 ps-10" />
        </div>
        <div>
          <label htmlFor="rp" className="sr-only">
            اسم المنتج
          </label>
          <Input id="rp" name="product" defaultValue={product} placeholder="اسم المنتج" className="h-11" />
        </div>
        <div>
          <label htmlFor="rg" className="sr-only">
            المحافظة
          </label>
          <Select id="rg" name="governorate" defaultValue={governorate} className="h-11">
            <option value="">كل المحافظات</option>
            {IRAQI_GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="rf" className="mb-1 block text-xs text-muted">
            من تاريخ
          </label>
          <Input id="rf" name="from" type="date" defaultValue={from} dir="ltr" className="h-11 text-end" />
        </div>
        <div>
          <label htmlFor="rt" className="mb-1 block text-xs text-muted">
            إلى تاريخ
          </label>
          <Input id="rt" name="to" type="date" defaultValue={to} dir="ltr" className="h-11 text-end" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-hover">
            تطبيق
          </button>
          {filtered && (
            <Link href="/admin/reservations" className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm font-semibold hover:bg-surface-sand">
              مسح الفلاتر
            </Link>
          )}
        </div>
      </form>
      </FilterPanel>

      {error ? (
        <AdminEmpty title="تعذّر تحميل الحجوزات" text="حدث خطأ أثناء جلب البيانات.">
          <ButtonLink href={href(page)} variant="secondary" size="sm">
            إعادة المحاولة
          </ButtonLink>
        </AdminEmpty>
      ) : rows.length === 0 ? (
        <AdminEmpty title="لا توجد حجوزات" text={filtered ? "لا نتائج تطابق الفلاتر الحالية." : "ستظهر هنا الحجوزات التي يسجلها الزوار من الموقع."} />
      ) : (
        <>
          <Card className="hidden !p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">قائمة الحجوزات</caption>
                <thead className="border-b border-line-soft bg-surface-warm text-xs text-muted">
                  <tr>
                    {["رقم الحجز", "العميل", "الهاتف", "المنتج", "الكمية", "المحافظة", "الحالة", "التاريخ", "إجراءات"].map((h) => (
                      <th key={h} scope="col" className="p-3 text-start font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === "pending" ? "bg-warning-bg/40" : undefined}>
                      <td className="p-3 font-semibold tabular-nums">
                        <Link href={`/admin/reservations/${r.id}`} className="underline-offset-4 hover:underline">
                          <bdi dir="ltr">{r.reservation_number}</bdi>
                        </Link>
                      </td>
                      <td className="p-3">{r.customer_name}</td>
                      <td className="p-3 tabular-nums" dir="ltr">
                        {r.phone}
                      </td>
                      <td className="max-w-48 truncate p-3" title={r.product_name_snapshot}>
                        {r.product_name_snapshot}
                      </td>
                      <td className="p-3 tabular-nums">{r.quantity}</td>
                      <td className="p-3">{r.governorate}</td>
                      <td className="p-3">
                        <ReservationStatusBadge status={r.status} />
                      </td>
                      <td className="p-3 text-xs text-muted">{formatDateTime(r.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Link href={`/admin/reservations/${r.id}`} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold hover:border-primary hover:bg-surface-warm">
                            فتح
                          </Link>
                          <a
                            href={customerWhatsappUrl(r.phone, r.customer_name, r.reservation_number, r.product_name_snapshot)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`واتساب ${r.customer_name}`}
                            className="grid size-10 place-items-center rounded-md border border-line text-whatsapp hover:border-whatsapp hover:bg-success-bg"
                          >
                            <MessageCircle className="size-4" aria-hidden="true" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className={`rounded-lg border border-line-soft p-3 shadow-card ${r.status === "pending" ? "bg-warning-bg/40" : "bg-surface"}`}>
                <Link href={`/admin/reservations/${r.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{r.customer_name}</span>
                    <ReservationStatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    <bdi dir="ltr">{r.reservation_number}</bdi> · {formatDateTime(r.created_at)}
                  </p>
                  <p className="mt-1 truncate text-sm">
                    {r.product_name_snapshot} <span className="text-muted">× {r.quantity}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {r.governorate} · <bdi dir="ltr">{r.phone}</bdi>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => href(p)} />
        </>
      )}
    </>
  );
}
