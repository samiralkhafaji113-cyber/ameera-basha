import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminNavItem } from "@/components/admin/AdminShell";
import { requireStaffPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // per-user, never cached

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaffPage("products.read"); // redirects to /admin/login when not signed in / not staff

  let pending = 0;
  if (can(staff.role, "reservations.manage")) {
    const supabase = await createSessionClient();
    const { count } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "pending");
    pending = count ?? 0;
  }

  const items: AdminNavItem[] = [
    { href: "/admin", label: "لوحة التحكم", icon: "dashboard", exact: true },
    { href: "/admin/products", label: "المنتجات", icon: "products" },
    { href: "/admin/products/new", label: "إضافة منتج", icon: "new", exact: true },
    ...(can(staff.role, "categories.manage") ? ([{ href: "/admin/categories", label: "التصنيفات", icon: "categories" }] as AdminNavItem[]) : []),
    ...(can(staff.role, "reservations.manage")
      ? ([{ href: "/admin/reservations", label: "الحجوزات", icon: "reservations", badge: pending }] as AdminNavItem[])
      : []),
    { href: "/admin/media", label: "الوسائط", icon: "media" },
    { href: "/admin/settings", label: "الإعدادات", icon: "settings" },
  ];

  return (
    <AdminShell items={items} email={staff.email} role={staff.role}>
      {children}
    </AdminShell>
  );
}
