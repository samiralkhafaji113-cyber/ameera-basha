/**
 * Production environment validation (pure → unit-tested). It only ever looks at variable NAMES and the *shape* of the
 * public values (https, not localhost, not a placeholder); secret values are never printed or returned.
 *
 * Used by next.config.ts (fails a Vercel PRODUCTION build early instead of shipping a site that silently falls back to the
 * bundled static catalog or that points at localhost) and by `npm run check:env`.
 */
export interface EnvProblem {
  variable: string;
  problem: string;
}

const PLACEHOLDER_HOSTS = /(^|\.)(example\.(com|org|net)|your-domain\.com|yourdomain\.com|localhost|127\.0\.0\.1|0\.0\.0\.0)$/i;

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function checkProductionEnv(env: Record<string, string | undefined>): EnvProblem[] {
  const problems: EnvProblem[] = [];

  const site = parseUrl(env.NEXT_PUBLIC_SITE_URL);
  if (!env.NEXT_PUBLIC_SITE_URL) problems.push({ variable: "NEXT_PUBLIC_SITE_URL", problem: "missing (the public https:// domain, no trailing slash)" });
  else if (!site) problems.push({ variable: "NEXT_PUBLIC_SITE_URL", problem: "not a valid URL" });
  else {
    if (site.protocol !== "https:") problems.push({ variable: "NEXT_PUBLIC_SITE_URL", problem: "must use https://" });
    if (PLACEHOLDER_HOSTS.test(site.hostname)) problems.push({ variable: "NEXT_PUBLIC_SITE_URL", problem: "is a placeholder/local host – set the real domain" });
    if (site.pathname !== "/" && site.pathname !== "") problems.push({ variable: "NEXT_PUBLIC_SITE_URL", problem: "must be the bare origin (no path)" });
  }

  const supa = parseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!env.NEXT_PUBLIC_SUPABASE_URL) problems.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "missing" });
  else if (!supa) problems.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "not a valid URL" });
  else {
    if (supa.protocol !== "https:") problems.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "must be the hosted https:// project URL (not the local stack)" });
    if (PLACEHOLDER_HOSTS.test(supa.hostname)) problems.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "points at localhost – production must use the hosted project" });
  }

  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) problems.push({ variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY", problem: "missing (the anon / publishable key)" });

  return problems;
}

/** Variables that must NOT exist in the hosting runtime (they are operator-only). Returns the names that are set. */
export function forbiddenRuntimeVars(env: Record<string, string | undefined>): string[] {
  return ["SUPABASE_SERVICE_ROLE_KEY", "E2E_ADMIN_PASSWORD", "E2E_EDITOR_PASSWORD"].filter((k) => Boolean(env[k]));
}
