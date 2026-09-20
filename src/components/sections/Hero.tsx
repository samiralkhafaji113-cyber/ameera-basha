import Image from "next/image";
import Link from "next/link";
import { Baby, CalendarCheck, GraduationCap, MapPin, MessageCircle, Pencil, Phone, Search, Shirt, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { bookingIntroMessage, whatsappUrl } from "@/lib/whatsapp";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const MAIN: { label: string; href: string; icon: ReactNode }[] = [
  { label: "ملابس نسائية", href: "/products?category=women", icon: <Shirt className="size-4" aria-hidden="true" /> },
  { label: "ملابس أطفال", href: "/products?category=kids", icon: <Baby className="size-4" aria-hidden="true" /> },
  { label: "ملابس مدرسية", href: "/products?category=school", icon: <GraduationCap className="size-4" aria-hidden="true" /> },
  { label: "قرطاسية", href: "/products?category=stationery", icon: <Pencil className="size-4" aria-hidden="true" /> },
];

export function Hero() {
  const t = ar.hero;
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-surface-warm">
      <div className="container-page grid items-center gap-7 py-7 sm:gap-10 sm:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-16">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface px-4 py-1.5 text-sm font-semibold text-accent-text">
            <MapPin className="size-4" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 id="hero-title">{t.title}</h1>
          <p className="mt-3 max-w-xl text-base leading-8 text-muted sm:mt-5 sm:text-lg">{t.subtitle}</p>

          <ul className="mt-5 flex flex-wrap gap-2" aria-label={t.mainLabel}>
            {MAIN.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-text transition-colors duration-200 hover:border-primary hover:bg-surface-sand"
                >
                  {m.icon}
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:flex sm:flex-wrap">
            <ButtonLink href="/products" variant="primary" size="lg" className="col-span-2 sm:col-span-1">
              {t.browse}
            </ButtonLink>
            <ButtonLink
              href={whatsappUrl(site.phone.wa, bookingIntroMessage)}
              variant="whatsapp"
              size="lg"
              icon={<MessageCircle className="size-5" aria-hidden="true" />}
            >
              {t.book}
              <span className="sr-only"> – {ar.nav.opensNew}</span>
            </ButtonLink>
            <ButtonLink href="/#contact" variant="secondary" size="lg" icon={<Phone className="size-5" aria-hidden="true" />}>
              {t.contact}
            </ButtonLink>
          </div>

          <form action="/products" role="search" className="mt-5 max-w-xl sm:mt-7">
            <label htmlFor="hero-search" className="mb-1.5 block text-sm font-semibold text-secondary">
              {t.searchLabel}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <Input id="hero-search" type="search" name="q" autoComplete="off" enterKeyHint="search" placeholder={t.searchPlaceholder} className="ps-12" />
              </div>
              <Button type="submit" variant="accent" className="shrink-0">
                {t.searchButton}
              </Button>
            </div>
            <p className="mt-2 hidden flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted sm:flex">
              <span>{t.popular}</span>
              {t.popularTerms.map((term) => (
                <Link
                  key={term}
                  href={`/products?q=${encodeURIComponent(term)}`}
                  className="inline-flex min-h-10 items-center rounded-full px-2.5 font-semibold text-secondary underline decoration-line decoration-1 underline-offset-4 hover:text-text hover:decoration-accent"
                >
                  {term}
                </Link>
              ))}
            </p>
          </form>
        </div>

        <div className="mx-auto grid aspect-[16/9] w-full max-w-[30rem] grid-cols-3 gap-2 sm:gap-3 lg:aspect-[5/6] lg:grid-cols-2 lg:grid-rows-2 lg:gap-4">
          <div className="relative order-2 overflow-hidden rounded-t-full rounded-b-lg bg-surface-sand shadow-card-hover lg:order-none lg:row-span-2">
            <Image
              src="/products/26598/1.webp"
              alt="فستان نسائي من منتجات المجمع"
              fill
              preload
              sizes="(min-width: 1024px) 240px, 34vw"
              className="object-cover object-[50%_30%]"
            />
            <span className="absolute inset-x-3 bottom-3 hidden rounded-full bg-primary/85 px-3 py-1.5 text-center text-xs font-semibold text-white lg:block">
              {t.caption}
            </span>
          </div>
          <div className="relative order-1 overflow-hidden rounded-lg bg-surface-sand shadow-card lg:order-none">
            <Image
              src="/products/26793/1.webp"
              alt="صدرية مدرسية من منتجات المجمع"
              fill
              sizes="(min-width: 1024px) 240px, 34vw"
              className="object-cover object-[50%_20%]"
            />
          </div>
          <div className="relative order-3 overflow-hidden rounded-lg bg-surface-sand shadow-card lg:order-none">
            <Image
              src="/products/26514/1.webp"
              alt="قاط ولادي رسمي من منتجات المجمع"
              fill
              sizes="(min-width: 1024px) 240px, 34vw"
              className="object-cover object-[50%_20%]"
            />
          </div>
        </div>
      </div>

      {/* Trust strip – only facts confirmed by the owner / the store's own posts */}
      <div className="border-t border-line-soft bg-surface">
        <ul className="container-page grid gap-x-8 gap-y-1 py-3 sm:grid-cols-3">
          {[
            { icon: <Truck className="size-5" aria-hidden="true" />, text: t.chips[0] },
            { icon: <CalendarCheck className="size-5" aria-hidden="true" />, text: t.chips[1] },
            { icon: <Phone className="size-5" aria-hidden="true" />, text: t.chips[2] },
          ].map((c) => (
            <li key={c.text} className="flex min-h-11 items-center gap-3 text-sm font-semibold text-secondary">
              <span className="text-accent-text">{c.icon}</span>
              {c.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
