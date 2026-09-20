"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Menu, MessageCircle } from "lucide-react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-bg/92 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="container-page flex h-[var(--header-h)] items-center justify-between gap-4">
        <Logo imageClassName="h-[3.75rem]" preload />

        <nav aria-label={ar.nav.main} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-md px-3.5 text-[0.9375rem] font-semibold transition-colors duration-200 hover:bg-surface-sand",
                    isActive(item.href) ? "text-text underline decoration-accent decoration-2 underline-offset-[10px]" : "text-secondary",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
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
            className="grid size-11 place-items-center rounded-md border border-line bg-surface text-text transition-colors hover:bg-surface-sand lg:hidden"
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
