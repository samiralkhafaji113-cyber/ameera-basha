import type { NextConfig } from "next";
import { checkProductionEnv, forbiddenRuntimeVars } from "./src/lib/prod-env";

// A Vercel PRODUCTION build must not succeed with a missing/placeholder configuration: it would silently serve the bundled
// static catalog, or canonical/OG/sitemap URLs pointing at localhost. Only variable NAMES are printed – never values.
if (process.env.VERCEL_ENV === "production") {
  const problems = checkProductionEnv(process.env);
  if (problems.length) {
    throw new Error(["Production environment is not ready:", ...problems.map((p) => `  - ${p.variable}: ${p.problem}`)].join("\n"));
  }
  const forbidden = forbiddenRuntimeVars(process.env);
  if (forbidden.length) console.warn(`[security] ${forbidden.join(", ")} is set in the hosting environment but the app never reads it – remove it from Vercel.`);
}

/** Product photos live in Supabase Storage (public bucket `store-media`); allow exactly that origin for next/image. */
function supabaseImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    return [
      {
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        pathname: "/storage/v1/object/public/store-media/**",
      },
    ];
  } catch {
    return [];
  }
}

const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Low-memory machines (or shared CI runners): NEXT_BUILD_CPUS=3 npm run build limits the parallel build workers.
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    // Uploads are converted to WebP by the admin upload pipeline; Next resizes per device.
    qualities: [75],
    minimumCacheTTL: 86400,
    remotePatterns: supabaseImagePatterns(),
    // Only for the local Supabase stack (127.0.0.1) during development; never enabled for a hosted project.
    ...(isLocalSupabase ? { dangerouslyAllowLocalIP: true } : {}),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Non-breaking CSP directives (no script-src: Next injects inline scripts): no framing by other sites, no <base>/<object>
          // tricks, forms may only post back to this site.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
