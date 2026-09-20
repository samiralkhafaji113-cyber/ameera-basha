import { ar } from "@/content/ar";
import type { Product } from "@/types/product";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCard } from "@/components/products/ProductCard";

export function FeaturedProducts({ products }: { products: Product[] }) {
  const t = ar.featured;
  return (
    <section aria-labelledby="featured-title" className="bg-surface-warm py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading
          id="featured-title"
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.subtitle}
          action={
            <ButtonLink href="/products" variant="secondary">
              {t.all}
            </ButtonLink>
          }
        />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id} className="flex min-w-0">
              <div className="flex min-w-0 flex-1">
                <ProductCard product={p} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
