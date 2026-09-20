/**
 * Supabase configuration.
 *  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY : safe to expose (protected by RLS).
 *  - SUPABASE_SERVICE_ROLE_KEY : NEVER read by application code. It exists only for operator scripts
 *    (scripts/seed-catalog.ts, scripts/create-admin.ts) that run on a trusted machine.
 */
export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  return env;
}

/** Tag used to invalidate every cached public catalog read after an admin change. */
export const CATALOG_TAG = "catalog";
