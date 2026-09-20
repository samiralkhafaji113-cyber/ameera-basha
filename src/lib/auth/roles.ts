/**
 * Role → permission matrix (pure, unit-tested). The database enforces the same matrix with RLS
 * (supabase/migrations/…_rls_and_grants.sql); this copy drives the UI and the early server-side checks.
 * Phase 1 uses `admin` only – `manager` and `editor` are already wired end to end.
 */
export const ROLES = ["admin", "manager", "editor"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "products.read"
  | "products.write" // create / edit content, images
  | "products.publish" // publish / hide / archive / feature
  | "products.delete" // soft delete + restore
  | "products.purge" // permanent delete
  | "categories.manage"
  | "reservations.manage"
  | "audit.read"
  | "settings.manage"; // bulk price confirmation etc.

const ALL: Permission[] = [
  "products.read",
  "products.write",
  "products.publish",
  "products.delete",
  "products.purge",
  "categories.manage",
  "reservations.manage",
  "audit.read",
  "settings.manage",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ALL,
  manager: ["products.read", "products.write", "products.publish", "products.delete", "categories.manage", "reservations.manage"],
  editor: ["products.read", "products.write"],
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const can = (role: Role | null | undefined, permission: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role].includes(permission);
