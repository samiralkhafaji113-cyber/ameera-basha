import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader, ProductStatusBadge, formatDateTime } from "@/components/admin/AdminUi";
import { ImageManager } from "@/components/admin/ImageManager";
import type { ManagedImage } from "@/components/admin/ImageManager";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { loadCategoryOptions, productToFormValues } from "@/lib/admin-data";
import { requireStaffPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { createSessionClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/actions";
import type { ProductStatus } from "@/lib/validation/product";

export const metadata: Metadata = { title: "تعديل منتج" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]/edit">) {
  const staff = await requireStaffPage("products.write");
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createSessionClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const [categories, imagesRes] = await Promise.all([
    loadCategoryOptions(supabase),
    supabase.from("product_images").select("id, public_url, alt_text, width, height, sort_order, is_primary, storage_path").eq("product_id", id).order("sort_order"),
  ]);
  const images = (imagesRes.data ?? []) as ManagedImage[];
  const status = product.status as ProductStatus;
  const trashed = Boolean(product.deleted_at);

  return (
    <>
      <PageHeader
        title={product.name}
        description={`أُضيف ${formatDateTime(product.created_at)} · آخر تعديل ${formatDateTime(product.updated_at)}`}
        actions={
          <>
            <ProductStatusBadge status={status} trashed={trashed} />
            {status === "published" && !trashed && (
              <Link href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-semibold hover:border-primary hover:bg-surface-warm">
                <ExternalLink className="size-4" aria-hidden="true" />
                عرض في الموقع
                <span className="sr-only"> – يفتح في نافذة جديدة</span>
              </Link>
            )}
          </>
        }
      />

      {sp.created === "1" && (
        <p role="status" className="mb-4 rounded-md border border-success/30 bg-success-bg p-3 text-sm font-semibold text-success">
          تم إنشاء المنتج كمسودة. أضف الصور من الأسفل ثم انشره.
        </p>
      )}
      {trashed && (
        <p role="alert" className="mb-4 rounded-md border border-error/30 bg-error-bg p-3 text-sm font-semibold text-error">
          هذا المنتج في المحذوفات ولا يظهر في الموقع.
        </p>
      )}

      <div className="flex flex-col gap-6">
        <Card title="الحالة والإجراءات">
          <ProductRowActions id={id} name={product.name} status={status} featured={product.featured} trashed={trashed} role={staff.role} hideEdit />
          {!can(staff.role, "products.publish") && <p className="mt-3 text-xs text-muted">النشر والإخفاء والأرشفة متاحة للمدير فقط.</p>}
        </Card>
        <ImageManager productId={id} initial={images} published={status === "published"} canDelete={can(staff.role, "products.delete")} />
        <ProductForm categories={categories} initial={productToFormValues(product)} productId={id} canPublish={can(staff.role, "products.publish")} />
      </div>
    </>
  );
}
