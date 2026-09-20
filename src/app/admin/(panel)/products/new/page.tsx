import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/AdminUi";
import { loadCategoryOptions } from "@/lib/admin-data";
import { requireStaffPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "إضافة منتج" };

export default async function NewProductPage() {
  const staff = await requireStaffPage("products.write");
  const categories = await loadCategoryOptions(await createSessionClient());
  return (
    <>
      <PageHeader title="إضافة منتج" description="يُحفظ المنتج كمسودة، ثم تضيف الصور وتنشره." />
      <ProductForm categories={categories} canPublish={can(staff.role, "products.publish")} />
    </>
  );
}
