"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ClipboardList,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Package,
  Settings,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/admin/actions/auth";
import { LogoImage } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: "dashboard" | "products" | "new" | "categories" | "reservations" | "media" | "settings";
  /** e.g. number of new reservations */
  badge?: number;
  /** match exactly (dashboard, "new product") instead of by prefix */
  exact?: boolean;
}

const ICONS = {
  dashboard: LayoutDashboard,
  products: Package,
  new: PackagePlus,
  categories: FolderTree,
  reservations: ClipboardList,
  media: ImageIcon,
  settings: Settings,
} as const;

const ROLE_LABEL = { admin: "مدير النظام", manager: "مدير", editor: "محرر" } as const;

function NavList({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = (i: AdminNavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)) && !(i.href === "/admin/products" && pathname === "/admin/products/new");
  return (
    <nav aria-label="القائمة الرئيسية">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = active(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-semibold transition-colors",
                  isActive ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-sand hover:text-text",
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums", isActive ? "bg-white/20 text-on-primary" : "bg-accent text-on-accent")}
                  >
                    <span className="sr-only">جديد: </span>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserBox({ email, role }: { email: string; role: keyof typeof ROLE_LABEL }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <p className="min-w-0 px-1 text-sm">
        <span className="block truncate font-semibold text-text" dir="ltr">
          {email}
        </span>
        <span className="text-xs text-muted">{ROLE_LABEL[role]}</span>
      </p>
      <div className="flex gap-2">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-text transition-colors hover:border-primary hover:bg-surface-warm"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          الموقع
          <span className="sr-only"> – يفتح في نافذة جديدة</span>
        </a>
        <form action={signOutAction} className="flex-1">
          <button
            type="submit"
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-text transition-colors hover:border-error hover:bg-error-bg hover:text-error"
          >
            <LogOut className="size-4" aria-hidden="true" />
            خروج
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Admin frame: fixed sidebar on desktop, side drawer on phones.
 * The drawer reuses the storefront's <dialog>-based pattern (`dialog.drawer`, adapted from the 21st.dev Drawer)
 * so focus trap / Esc / inert background come from the platform and no dependency is added.
 */
export function AdminShell({ items, email, role, children }: { items: AdminNavItem[]; email: string; role: keyof typeof ROLE_LABEL; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    window.setTimeout(
      () => {
        setClosing(false);
        setOpen(false);
      },
      reduced ? 0 : 200,
    );
  }, []);

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-e border-line-soft bg-surface p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-1">
          <LogoImage variant="mark" className="h-11" />
          <span className="font-heading text-base font-bold">لوحة التحكم</span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList items={items} />
        </div>
        <UserBox email={email} role={role} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line-soft bg-surface px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-haspopup="dialog"
            className="grid size-11 place-items-center rounded-md text-text transition-colors hover:bg-surface-sand"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <span className="font-heading text-base font-bold">لوحة التحكم</span>
            <LogoImage variant="mark" className="h-9" />
          </Link>
        </header>
        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <dialog
        ref={ref}
        aria-label="القائمة الرئيسية"
        className="drawer bg-surface text-text shadow-pop"
        data-closing={closing ? "" : undefined}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
      >
        {open && (
          <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <LogoImage variant="mark" className="h-10" />
              <button type="button" onClick={close} aria-label="إغلاق القائمة" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-sand hover:text-text">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList items={items} onNavigate={close} />
            </div>
            <UserBox email={email} role={role} />
          </div>
        )}
      </dialog>
    </div>
  );
}
