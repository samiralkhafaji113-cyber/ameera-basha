import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hardenCookie } from "./cookies";
import { requireSupabaseEnv } from "./env";

/**
 * Session-bound client (Server Components, Server Actions, Route Handlers).
 * Runs as the signed-in staff member, so Row Level Security enforces what they may do.
 * Never cached (cookies make every request user-specific).
 */
export async function createSessionClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, hardenCookie(options));
        } catch {
          /* called from a Server Component – the proxy refreshes the session cookies instead */
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
