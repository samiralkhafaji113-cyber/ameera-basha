import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/CategoryManager";
import type { AdminCategory } from "@/components/admin/CategoryManager";
import { AdminEmpty, PageHeader } from "@/components/admin/AdminUi";
import { requireStaffPage } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "التصنيفات" };

export default async function CategoriesPage() {
  await requireStaffPage("categories.manage");
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, short_name, description, image_url, is_active, sort_order, products(count), subcategories(id, slug, name, is_active, sort_order, products(count))")
    .order("sort_order");

  return (
    <>
      <PageHeader title="التصنيفات" description="أضف الأقسام وعدّلها وغيّر ترتيبها وصورها. القسم الذي يحتوي منتجات لا يمكن حذفه." />
      {error ? <AdminEmpty title="تعذّر تحميل الأقسام" text="حدث خطأ أثناء جلب البيانات." /> : <CategoryManager categories={(data ?? []) as unknown as AdminCategory[]} />}
    </>
  );
}
