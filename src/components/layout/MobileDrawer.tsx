"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ChevronLeft, MessageCircle, Phone, X } from "lucide-react";
import { ar } from "@/content/ar";
import { socialLinks } from "@/data/social";
import { site, telHref } from "@/lib/site";
import { generalInquiryMessage, whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { SocialIcon } from "@/components/ui/BrandIcons";
import { ButtonLink } from "@/components/ui/Button";
import { LogoImage } from "./Logo";

const ITEMS = [
  { href: "/", label: ar.nav.home },
  { href: "/products", label: ar.nav.products },
  { href: "/#categories", label: ar.nav.categories },
  { href: "/#contact", label: ar.nav.contact },
];

/**
 * Mobile navigation drawer.
 * Pattern adapted from the 21st.dev "Drawer" component (coss.com, «Mobile Menu» demo): side panel with header /
 * scrollable panel / sticky footer, swipe-to-dismiss and the (0.32, 0.72, 0, 1) easing. The original is built on
 * @base-ui/react; here it sits on the native <dialog> so no dependency is added – focus trap, Esc, inert background
 * and focus restore come from the platform. Loaded lazily (next/dynamic) only when the menu is opened.
 */
export function MobileDrawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const pathname = usePathname();
  const swipe = useRef<{ x: number; y: number; axis: "x" | "y" | null; id: number } | null>(null);
  const onCloseRef = useRef(onClose); // parent passes an inline callback – keep the effect stable
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onCloseRef.current(), reduced ? 0 : 200);
  }, [closing]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const mq = window.matchMedia("(min-width: 1024px)"); // desktop nav takes over
    const onChange = () => mq.matches && onCloseRef.current();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Swipe toward the edge the drawer is anchored to (left in RTL, right in LTR) dismisses it.
  const sign = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? -1 : 1;
  const onDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    const s = swipe.current;
    const el = ref.current;
    if (!s || !el) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.axis === "x" && dx * sign > 0) el.style.transform = `translateX(${dx}px)`;
  };
  const onUp = (e: PointerEvent) => {
    const s = swipe.current;
    const el = ref.current;
    swipe.current = null;
    if (!s || !el) return;
    const dx = e.clientX - s.x;
    el.style.transform = "";
    if (s.axis === "x" && dx * sign > 72) close();
  };

  const active = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));
  const socials = socialLinks();

  return (
    <dialog
      ref={ref}
      id="mobile-drawer"
      aria-label={ar.nav.menu}
      className="drawer bg-surface text-text shadow-pop"
      data-closing={closing ? "" : undefined}
      onClose={() => onCloseRef.current()}
      onCancel={(e) => {
        e.preventDefault(); // animate out instead of vanishing
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close(); // backdrop
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        swipe.current = null;
        if (ref.current) ref.current.style.transform = "";
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
          <LogoImage variant="mark" className="h-10" />
          <button
            type="button"
            onClick={close}
            aria-label={ar.nav.closeMenu}
            className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-sand hover:text-text"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [touch-action:pan-y]">
          <nav aria-label={ar.nav.menu}>
            <ul>
              {ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active(item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-[3.25rem] items-center justify-between rounded-md px-3 font-heading text-lg font-bold transition-colors hover:bg-surface-sand",
                      active(item.href) ? "text-text" : "text-secondary",
                    )}
                  >
                    <span className={cn("border-s-2 ps-3", active(item.href) ? "border-accent" : "border-transparent")}>{item.label}</span>
                    <ChevronLeft className="size-4 text-muted ltr:rotate-180" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <h2 className="mt-4 mb-1 px-3 !font-sans !text-xs !font-semibold tracking-wide text-muted">{ar.nav.followUs}</h2>
          <ul>
            {socials.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-semibold text-text transition-colors hover:bg-surface-sand"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-sand text-primary">
                    <SocialIcon id={s.id} className="size-[18px]" />
                  </span>
                  {s.name}
                  <span className="sr-only"> – {ar.nav.opensNew}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2 border-t border-line-soft bg-surface-warm px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <ButtonLink
            href={whatsappUrl(site.phone.wa, generalInquiryMessage)}
            variant="whatsapp"
            size="lg"
            className="w-full"
            icon={<MessageCircle className="size-5" aria-hidden="true" />}
          >
            WhatsApp
            <span className="sr-only"> – {ar.nav.opensNew}</span>
          </ButtonLink>
          <ButtonLink href={telHref} variant="secondary" className="w-full" icon={<Phone className="size-[18px]" aria-hidden="true" />}>
            <span dir="ltr">{site.phone.display}</span>
          </ButtonLink>
        </div>
      </div>
    </dialog>
  );
}
