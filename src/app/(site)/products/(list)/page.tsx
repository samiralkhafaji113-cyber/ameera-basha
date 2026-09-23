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
      <header className="mt-5 mb-10 max-w-2xl border-b border-line-soft pb-8 sm:mb-12">
        <p className="label-editorial mb-3 text-accent-text">{ar.nav.products}</p>
        <h1 className="text-display !text-[clamp(2.25rem,1.6rem+3.4vw,4rem)]">{ar.products.title}</h1>
        <p className="mt-3 max-w-md text-base leading-8 text-muted">{ar.products.subtitle}</p>
      </header>
      {/* useSearchParams (filters in the URL) requires a Suspense boundary */}
      <Suspense fallback={<LoadingState />}>
        <ProductBrowser products={products} categories={categories} />
      </Suspense>
    </div>
  );
}
