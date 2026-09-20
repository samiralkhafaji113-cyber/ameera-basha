import type { Metadata } from "next";
import { Suspense } from "react";
import { ar } from "@/content/ar";
import { getProductRepository } from "@/lib/catalog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { LoadingState } from "@/components/ui/States";
import { ProductBrowser } from "@/components/products/ProductBrowser";

export const metadata: Metadata = {
  title: "المنتجات",
  description: "تصفّح منتجات مجمع أميرة باشا في الحلة: ملابس نسائية وأطفال، ملابس مدرسية، قرطاسية، حقائب وأحذية. ابحث وفلتر حسب القسم والعمر والمقاس.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage() {
  const repo = getProductRepository();
  const [products, categories] = await Promise.all([repo.list(), repo.categories()]);
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumb items={[{ label: ar.nav.home, href: "/" }, { label: ar.products.title }]} />
      <header className="mt-5 mb-8 max-w-2xl">
        <h1 className="!text-[clamp(1.875rem,1.4rem+2vw,2.75rem)]">{ar.products.title}</h1>
        <p className="mt-2 text-muted">{ar.products.subtitle}</p>
      </header>
      {/* useSearchParams (filters in the URL) requires a Suspense boundary */}
      <Suspense fallback={<LoadingState />}>
        <ProductBrowser products={products} categories={categories} />
      </Suspense>
    </div>
  );
}
