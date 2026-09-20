import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hardenCookie } from "@/lib/supabase/cookies";

/**
 * Admin gatekeeper (Next 16 "proxy", formerly middleware). Runs ONLY for /admin/**:
 *  1. refreshes the Supabase session cookies,
 *  2. redirects anonymous visitors to /admin/login,
 *  3. marks every admin response private (no-store, noindex).
 * It is a first line of defence only – every admin page, Server Action and API route re-checks the
 * user and role itself (see src/lib/auth/guard.ts), so a proxy bypass would still be denied.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  if (!url || !anon) {
    // Backend not configured: the admin cannot work – send everyone (except the login page, which explains it) away
    return isLogin ? response : NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        for (const { name, value, options } of list) response.cookies.set(name, value, hardenCookie(options));
      },
    },
  });

  // getUser() validates the JWT against the Auth server (getSession() alone trusts the cookie)
  const { data } = await supabase.auth.getUser();

  if (!data.user && !isLogin) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  // (A signed-in user on /admin/login is bounced by the page itself: only real staff go on to /admin, otherwise a
  //  signed-in non-staff account would loop between the two redirects.)
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
