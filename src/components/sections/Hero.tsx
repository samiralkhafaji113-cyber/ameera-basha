"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Baby, CalendarCheck, GraduationCap, MapPin, MessageCircle, Pencil, Phone, Search, Shirt, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ar } from "@/content/ar";
import { site } from "@/lib/site";
import { bookingIntroMessage, whatsappUrl } from "@/lib/whatsapp";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { LogoImage } from "@/components/layout/Logo";

const MAIN: { label: string; href: string; icon: ReactNode }[] = [
  { label: "ملابس نسائية", href: "/products?category=women", icon: <Shirt className="size-4" aria-hidden="true" /> },
  { label: "ملابس أطفال", href: "/products?category=kids", icon: <Baby className="size-4" aria-hidden="true" /> },
  { label: "ملابس مدرسية", href: "/products?category=school", icon: <GraduationCap className="size-4" aria-hidden="true" /> },
  { label: "قرطاسية", href: "/products?category=stationery", icon: <Pencil className="size-4" aria-hidden="true" /> },
];

export function Hero() {
  const t = ar.hero;
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // Subtle parallax on the image collage only (transform, GPU-friendly). The images themselves are never
  // faded/hidden on load – one of them carries `preload` as the page's LCP candidate, so it must paint
  // immediately at full opacity; only its position drifts a few pixels as the page scrolls past it.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 28]);

  return (
    <section ref={sectionRef} aria-labelledby="hero-title" className="relative overflow-hidden bg-surface-warm">
      {/* Editorial vertical rule + rotated brand label – the "fashion magazine" detail requested; runs the
          full height of the Hero on wide screens only (decorative, hidden from AT). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-[6%] hidden w-px bg-line lg:block"
      />
      <span
        aria-hidden="true"
        className="label-editorial pointer-events-none absolute start-[calc(6%+10px)] top-24 hidden [writing-mode:vertical-rl] text-muted lg:block"
      >
        {ar.brand.en}
      </span>

      <div className="container-page grid items-center gap-9 py-10 sm:gap-10 sm:py-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:py-20 xl:py-24">
        <motion.div initial="hidden" animate="show" variants={staggerContainer(0.09, 0.05)} className="lg:pe-2">
          <motion.p variants={fadeUp} className="label-editorial mb-4 flex items-center gap-2 text-accent-text">
            <MapPin className="size-3.5" aria-hidden="true" />
            {t.eyebrow}
          </motion.p>
          <motion.h1 variants={fadeUp} id="hero-title" className="text-display">
            {t.title}
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-md text-base leading-8 text-muted sm:mt-6 sm:text-lg">
            {t.subtitle}
          </motion.p>

          <motion.p variants={fadeUp} className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm font-semibold text-secondary" aria-label={t.mainLabel}>
            {MAIN.map((m, i) => (
              <span key={m.href} className="inline-flex items-center gap-2.5">
                {i > 0 && (
                  <span aria-hidden="true" className="size-1 rounded-full bg-line" />
                )}
                <Link href={m.href} className="inline-flex min-h-10 items-center gap-1.5 underline-offset-4 transition-colors hover:text-accent-text hover:underline">
                  {m.icon}
                  {m.label}
                </Link>
              </span>
            ))}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            <ButtonLink href="/products" variant="primary" size="lg">
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
            <ButtonLink
              href="/#contact"
              variant="ghost"
              size="lg"
              className="!px-2 underline decoration-line underline-offset-4 hover:decoration-accent"
              icon={<Phone className="size-5" aria-hidden="true" />}
            >
              {t.contact}
            </ButtonLink>
          </motion.div>

          <motion.form variants={fadeUp} action="/products" role="search" className="mt-7 max-w-md border-t border-line-soft pt-5 sm:mt-9">
            <label htmlFor="hero-search" className="label-editorial mb-2 block text-muted">
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
          </motion.form>
        </motion.div>

        {/* Layered, asymmetric composition – the image IS the statement, not a tidy grid of equal boxes:
            one large portrait behind an offset accent panel, a second image breaking over its corner,
            and a small floating fact card (a real, current number – not a decorative placeholder). */}
        <motion.div style={{ y: parallaxY }} className="relative mx-auto w-full max-w-[30rem] lg:mx-0 lg:max-w-none">
          <div className="relative aspect-[4/5] w-[86%] sm:aspect-[3/4] lg:aspect-[4/5] lg:h-[36rem] lg:w-[78%]">
            <span aria-hidden="true" className="absolute -inset-x-4 -bottom-4 -top-4 -z-10 rounded-md bg-surface-sand-strong sm:-inset-x-6 sm:-top-6 sm:-bottom-6" />
            <div className="relative h-full w-full overflow-hidden rounded-md shadow-card-hover">
              <Image
                src="/products/26598/1.webp"
                alt="فستان نسائي من منتجات المجمع"
                fill
                preload
                sizes="(min-width: 1024px) 520px, 70vw"
                className="object-cover object-[50%_18%]"
              />
            </div>
          </div>

          <div className="absolute bottom-[-6%] start-0 w-[42%] sm:w-[38%]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-md border-4 border-surface bg-surface-sand shadow-card-hover">
              <Image
                src="/products/26793/1.webp"
                alt="صدرية مدرسية من منتجات المجمع"
                fill
                sizes="(min-width: 1024px) 220px, 30vw"
                className="object-cover object-[50%_15%]"
              />
            </div>
          </div>

          <div className="absolute end-0 top-4 flex items-center gap-2.5 rounded-md bg-surface px-4 py-3 shadow-card-hover sm:top-8">
            <LogoImage variant="mark" className="h-7 w-auto" />
            <span className="label-editorial text-muted">{t.caption}</span>
          </div>
        </motion.div>
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
