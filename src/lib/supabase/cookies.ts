import type { CookieOptions } from "@supabase/ssr";

/**
 * Session cookies are only ever read on the server (there is no Supabase client in the browser bundle), so they can be
 * HttpOnly: a script injected into any page could not steal the admin session. SameSite=Lax blocks cross-site POSTs,
 * `Secure` is forced in production.
 */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
}
