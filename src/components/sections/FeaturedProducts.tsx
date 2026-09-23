import { ar } from "@/content/ar";
import { cn } from "@/lib/cn";
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
          {products.map((p, i) => (
            <li key={p.id} className={cn("flex min-w-0", i === 0 && "col-span-2")}>
              <div className="flex min-w-0 flex-1">
                <ProductCard product={p} featured={i === 0} preload={i < 2} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
