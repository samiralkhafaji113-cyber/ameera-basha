"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { EASE_SOFT } from "@/lib/motion";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "./Logo";

// The drawer (dialog, swipe handling, links) is only downloaded when someone opens the menu.
const MobileDrawer = dynamic(() => import("./MobileDrawer").then((m) => m.MobileDrawer), { ssr: false });

const NAV = [
  { href: "/", label: ar.nav.home },
  { href: "/products", label: ar.nav.products },
  { href: "/#categories", label: ar.nav.categories },
  { href: "/#about", label: ar.nav.about },
  { href: "/#contact", label: ar.nav.contact },
];

const iconLink =
  "grid size-11 place-items-center rounded-full text-secondary transition-colors duration-200 hover:bg-surface-sand hover:text-text";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const socials = socialLinks();

  // Only the homepage has a Hero for the header to float over transparently; every other page keeps the
  // always-solid header (it never had a hero image behind it, so "transparent" would just look unstyled).
  const isHome = pathname === "/";
  const [scrolledPastTop, setScrolledPastTop] = useState(() => (typeof window !== "undefined" ? window.scrollY > 24 : false));
  useEffect(() => {
    if (!isHome) return; // non-home pages never float, so no need to track scroll at all
    const onScroll = () => setScrolledPastTop(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);
  const scrolled = !isHome || scrolledPastTop;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));
  const floating = isHome && !scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-soft",
        floating
          ? "border-transparent bg-transparent"
          : "border-line-soft bg-bg/94 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur supports-[backdrop-filter]:bg-bg/85",
      )}
    >
      <div className="container-page flex h-[var(--header-h)] items-center justify-between gap-4 sm:gap-6">
        <Logo imageClassName="h-16 sm:h-[4.75rem]" preload />

        {/* Nav sits center-weighted with generous letter-spacing – editorial, not app-toolbar. The active
            item's underline is one shared element (motion layoutId) that glides between links. */}
        <nav aria-label={ar.nav.main} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href} className="relative">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-11 items-center px-4 text-[0.9375rem] font-bold tracking-wide transition-colors duration-200",
                      active ? "text-text" : "text-secondary hover:text-text",
                    )}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        transition={{ duration: 0.3, ease: EASE_SOFT }}
                        className="absolute inset-x-4 -bottom-0.5 h-[2.5px] rounded-full bg-accent"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <ul className="hidden items-center gap-0.5 xl:flex" aria-label={ar.nav.social}>
            {socials.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} – ${ar.nav.opensNew}`} title={s.name} className={iconLink}>
                  <SocialIcon id={s.id} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <ButtonLink
              href={whatsappUrl(site.phone.wa, generalInquiryMessage)}
              variant="whatsapp"
              size="sm"
              icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}
            >
              واتساب
            </ButtonLink>
          </div>
          <button
            ref={menuBtn}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-controls="mobile-drawer"
            aria-expanded={open}
            aria-label={ar.nav.openMenu}
            className={cn(
              "grid size-11 place-items-center rounded-full border transition-colors lg:hidden",
              floating ? "border-text/25 bg-surface/70 text-text backdrop-blur-sm hover:bg-surface" : "border-line bg-surface text-text hover:bg-surface-sand",
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <MobileDrawer
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => menuBtn.current?.focus()); // return focus to the trigger
          }}
        />
      )}
    </header>
  );
}
