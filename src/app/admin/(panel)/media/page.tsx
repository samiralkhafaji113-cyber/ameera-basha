import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminEmpty, PageHeader, Pagination, ProductStatusBadge } from "@/components/admin/AdminUi";
import { requireStaffPage } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/server";
import type { ProductStatus } from "@/lib/validation/product";

export const metadata: Metadata = { title: "الوسائط" };

const PAGE_SIZE = 24;

interface Row {
  id: string;
  public_url: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  is_primary: boolean;
  product: { id: string; name: string; status: ProductStatus; deleted_at: string | null } | null;
}

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  await requireStaffPage("products.read");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(String(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? "1")), 10) || 1);
  const supabase = await createSessionClient();
  const { data, count, error } = await supabase
    .from("product_images")
    .select("id, public_url, alt_text, width, height, is_primary, product:products(id, name, status, deleted_at)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="الوسائط" description={`${count ?? 0} صورة. تُدار صور كل منتج من صفحة تعديله.`} />
      {error ? (
        <AdminEmpty title="تعذّر تحميل الوسائط" />
      ) : rows.length === 0 ? (
        <AdminEmpty title="لا توجد صور" text="ارفع صور المنتجات من صفحة تعديل المنتج." />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rows.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-lg border border-line-soft bg-surface">
                <Link href={r.product ? `/admin/products/${r.product.id}/edit` : "#"} className="block">
                  <span className="relative block aspect-[4/5] bg-surface-sand">
                    <Image src={r.public_url} alt={r.alt_text ?? r.product?.name ?? ""} fill sizes="(min-width:1280px) 16vw, (min-width:640px) 25vw, 45vw" className="object-cover" />
                  </span>
                  <span className="flex flex-col gap-1 p-2.5 text-xs">
                    <span className="line-clamp-1 font-semibold">{r.product?.name ?? "—"}</span>
                    <span className="flex items-center justify-between gap-1 text-muted">
                      <span dir="ltr">
                        {r.width}×{r.height}
                      </span>
                      {r.product && <ProductStatusBadge status={r.product.status} trashed={Boolean(r.product.deleted_at)} />}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => (p > 1 ? `/admin/media?page=${p}` : "/admin/media")} />
        </>
      )}
    </>
  );
}
