import "server-only";
import { createClient } from "@supabase/supabase-js";
import { CATALOG_TAG, requireSupabaseEnv } from "./env";

/**
 * Anonymous, cookie-less client for PUBLIC reads. RLS exposes only published products / active
 * categories to this role. GET requests are tagged so `updateTag(CATALOG_TAG)` in an admin action
 * invalidates them immediately; otherwise they revalidate every 5 minutes.
 */
export function createPublicClient(options: { cache: boolean } = { cache: true }) {
  const { url, anonKey } = requireSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, options.cache ? { ...init, next: { tags: [CATALOG_TAG], revalidate: 300 } } : { ...init, cache: "no-store" }),
    },
  });
}
