import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ar } from "@/content/ar";
import type { HomeCategoryCard } from "@/data/categories";
import { buildHomeCards } from "@/lib/home-cards";
import type { Category } from "@/types/product";
import { cn } from "@/lib/cn";
import { SectionHeading } from "@/components/ui/SectionHeading";

function CategoryCard({ card, className, sizes, wide }: { card: HomeCategoryCard; className?: string; sizes: string; wide?: boolean }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-line-soft bg-surface shadow-card",
        "transition-[box-shadow,transform,border-color] duration-200 ease-soft hover:-translate-y-1 hover:border-line hover:shadow-card-hover",
        className,
      )}
    >
      <span className={cn("relative block overflow-hidden bg-surface-sand", wide ? "aspect-[16/10] md:aspect-[4/5]" : "aspect-[4/5]")}>
        <Image
          src={card.cover}
          alt={card.coverAlt}
          fill
          sizes={sizes}
          className="object-cover object-[50%_25%] transition-transform duration-500 ease-soft group-hover:scale-[1.05]"
        />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <span className="font-heading text-lg font-bold leading-snug text-text sm:text-xl">{card.title}</span>
        <span className="text-sm leading-6 text-muted">{card.description}</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-accent-text">
          {ar.categories.explore}
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

export function CategoryCards({ categories }: { categories: Category[] }) {
  const t = ar.categories;
  const { main, more } = buildHomeCards(categories);
  return (
    <section id="categories" aria-labelledby="categories-title" className="py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading id="categories-title" eyebrow={t.eyebrow} title={t.title} description={t.subtitle} />

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
          {main.map((card, i) => (
            <li key={card.key} className={cn("flex", i === 0 && "col-span-2 md:col-span-1")}>
              <CategoryCard
                card={card}
                wide={i === 0}
                className="w-full"
                sizes="(min-width: 1024px) 220px, (min-width: 768px) 30vw, 50vw"
              />
            </li>
          ))}
        </ul>

        <h3 className="mt-12 mb-4 !text-xl text-secondary">{t.moreTitle}</h3>
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5">
          {more.map((card) => (
            <li key={card.key}>
              <Link
                href={card.href}
                className="group flex items-center gap-4 rounded-lg border border-line-soft bg-surface p-3 shadow-card transition-[box-shadow,transform] duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="relative block size-24 shrink-0 overflow-hidden rounded-md bg-surface-sand">
                  <Image src={card.cover} alt={card.coverAlt} fill sizes="96px" className="object-cover" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-heading text-lg font-bold text-text">{card.title}</span>
                  <span className="text-sm text-muted">{card.description}</span>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-accent-text">
                    {t.explore}
                    <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
