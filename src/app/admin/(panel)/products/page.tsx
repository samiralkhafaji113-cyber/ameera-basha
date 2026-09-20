import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PackagePlus, Search } from "lucide-react";
import { AdminEmpty, Card, PageHeader, Pagination, ProductStatusBadge, formatDateTime } from "@/components/admin/AdminUi";
import { FilterPanel } from "@/components/admin/FilterPanel";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { requireStaffPage } from "@/lib/auth/guard";
import { formatPrice } from "@/lib/format";
import { sanitizeSearchTerm } from "@/lib/reservation-status";
import { normalizeArabic } from "@/lib/search";
import { createSessionClient } from "@/lib/supabase/server";
import { PRODUCT_SOURCES, PRODUCT_STATUSES } from "@/lib/validation/product";
import type { ProductStatus } from "@/lib/validation/product";

export const metadata: Metadata = { title: "المنتجات" };

const PAGE_SIZE = 20;
const STATUS_TABS: { id: string; label: string }[] = [
  { id: "", label: "الكل" },
  { id: "published", label: "منشور" },
  { id: "draft", label: "مسودة" },
  { id: "hidden", label: "مخفي" },
  { id: "archived", label: "مؤرشف" },
  { id: "trash", label: "المحذوفات" },
];
const SOURCE_LABEL: Record<string, string> = { manual: "يدوي", telegram: "Telegram", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

interface Row {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  featured: boolean;
  price: number | string | null;
  currency: string | null;
  price_verified: boolean;
  source: string;
  created_at: string;
  deleted_at: string | null;
  category: { name: string } | null;
  images: { public_url: string; is_primary: boolean; sort_order: number }[] | null;
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const staff = await requireStaffPage("products.read");
  const sp = await searchParams;
  const q = sanitizeSearchTerm(one(sp.q));
  const status = one(sp.status);
  const category = one(sp.category);
  const source = one(sp.source);
  const featured = one(sp.featured) === "1";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const trash = status === "trash";

  const supabase = await createSessionClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");

  let query = supabase
    .from("products")
    .select("id, name, slug, status, featured, price, currency, price_verified, source, created_at, deleted_at, category:categories(name), images:product_images(public_url, is_primary, sort_order)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  query = trash ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (!trash && (PRODUCT_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (category && /^[0-9a-f-]{36}$/i.test(category)) query = query.eq("category_id", category);
  if ((PRODUCT_SOURCES as readonly string[]).includes(source)) query = query.eq("source", source);
  if (featured) query = query.eq("featured", true);
  if (q) query = query.ilike("search_text", `%${normalizeArabic(q).replace(/[%_]/g, " ")}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  const href = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    if (category) u.set("category", category);
    if (source) u.set("source", source);
    if (featured) u.set("featured", "1");
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };

  const thumb = (r: Row) => {
    const img = [...(r.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
    return img ? (
      <Image src={img.public_url} alt="" width={56} height={70} className="h-[70px] w-14 shrink-0 rounded object-cover" />
    ) : (
      <span aria-label="بدون صورة" className="grid h-[70px] w-14 shrink-0 place-items-center rounded bg-surface-sand text-xs text-muted">
        —
      </span>
    );
  };
  const priceText = (r: Row) =>
    r.price === null ? "—" : r.price_verified && r.currency ? `${formatPrice(Number(r.price))}${r.currency === "USD" ? " (USD)" : ""}` : `${Number(r.price).toLocaleString("en-US")} (غير مؤكد)`;

  return (
    <>
      <PageHeader
        title="المنتجات"
        description={`${total} منتج`}
        actions={
          <ButtonLink href="/admin/products/new" size="sm" icon={<PackagePlus className="size-4" aria-hidden="true" />}>
            إضافة منتج
          </ButtonLink>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="حالة المنتج">
        {STATUS_TABS.map((t) => {
          const active = status === t.id;
          const u = new URLSearchParams();
          if (t.id) u.set("status", t.id);
          return (
            <Link
              key={t.id || "all"}
              href={u.toString() ? `/admin/products?${u}` : "/admin/products"}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-primary hover:bg-surface-warm"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <FilterPanel id="product-filters" activeCount={[q, category, source, featured ? "1" : ""].filter(Boolean).length}>
      <form method="get" className="grid gap-3 rounded-lg border border-line-soft bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <label htmlFor="pq" className="sr-only">
            بحث في المنتجات
          </label>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input id="pq" name="q" defaultValue={q} placeholder="ابحث بالاسم أو الوصف…" className="h-11 ps-10" />
        </div>
        <div>
          <label htmlFor="pc" className="sr-only">
            القسم
          </label>
          <Select id="pc" name="category" defaultValue={category} className="h-11">
            <option value="">كل الأقسام</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="ps" className="sr-only">
            المصدر
          </label>
          <Select id="ps" name="source" defaultValue={source} className="h-11">
            <option value="">كل المصادر</option>
            {PRODUCT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover">
            بحث
          </button>
          {(q || category || source || featured) && (
            <Link href={status ? `/admin/products?status=${status}` : "/admin/products"} className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm font-semibold hover:bg-surface-sand">
              مسح
            </Link>
          )}
        </div>
      </form>
      </FilterPanel>

      {error ? (
        <AdminEmpty title="تعذّر تحميل المنتجات" text="حدث خطأ أثناء جلب البيانات. حاول التحديث.">
          <ButtonLink href={href(page)} variant="secondary" size="sm">
            إعادة المحاولة
          </ButtonLink>
        </AdminEmpty>
      ) : rows.length === 0 ? (
        <AdminEmpty title="لا توجد منتجات" text={q || category || source || status ? "لا نتائج تطابق الفلاتر الحالية." : "ابدأ بإضافة أول منتج."}>
          <ButtonLink href="/admin/products/new" size="sm">
            إضافة منتج
          </ButtonLink>
        </AdminEmpty>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden !p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">قائمة المنتجات</caption>
                <thead className="border-b border-line-soft bg-surface-warm text-start text-xs text-muted">
                  <tr>
                    <th scope="col" className="p-3 text-start font-semibold">الصورة</th>
                    <th scope="col" className="p-3 text-start font-semibold">الاسم</th>
                    <th scope="col" className="p-3 text-start font-semibold">القسم</th>
                    <th scope="col" className="p-3 text-start font-semibold">السعر</th>
                    <th scope="col" className="p-3 text-start font-semibold">الحالة</th>
                    <th scope="col" className="p-3 text-start font-semibold">المصدر</th>
                    <th scope="col" className="p-3 text-start font-semibold">أُضيف</th>
                    <th scope="col" className="p-3 text-start font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-middle">
                      <td className="p-3">{thumb(r)}</td>
                      <td className="max-w-64 p-3">
                        <Link href={`/admin/products/${r.id}/edit`} className="line-clamp-2 font-semibold underline-offset-4 hover:underline">
                          {r.name}
                        </Link>
                        {r.featured && <Badge tone="gold" className="mt-1">مميز</Badge>}
                      </td>
                      <td className="p-3 text-muted">{r.category?.name ?? "—"}</td>
                      <td className="p-3 tabular-nums">{priceText(r)}</td>
                      <td className="p-3">
                        <ProductStatusBadge status={r.status} trashed={Boolean(r.deleted_at)} />
                      </td>
                      <td className="p-3 text-muted">{SOURCE_LABEL[r.source] ?? r.source}</td>
                      <td className="p-3 text-xs text-muted">{formatDateTime(r.created_at)}</td>
                      <td className="p-3">
                        <ProductRowActions id={r.id} name={r.name} status={r.status} featured={r.featured} trashed={Boolean(r.deleted_at)} role={staff.role} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-line-soft bg-surface p-3 shadow-card">
                <div className="flex gap-3">
                  {thumb(r)}
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${r.id}/edit`} className="line-clamp-2 font-semibold">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.category?.name ?? "—"} · {SOURCE_LABEL[r.source] ?? r.source}
                    </p>
                    <p className="mt-1 text-sm tabular-nums">{priceText(r)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <ProductStatusBadge status={r.status} trashed={Boolean(r.deleted_at)} />
                      {r.featured && <Badge tone="gold">مميز</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 border-t border-line-soft pt-3">
                  <ProductRowActions id={r.id} name={r.name} status={r.status} featured={r.featured} trashed={Boolean(r.deleted_at)} role={staff.role} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={href} />
        </>
      )}
    </>
  );
}
