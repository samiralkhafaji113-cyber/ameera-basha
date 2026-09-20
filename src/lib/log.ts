/**
 * Safe server-side logging. Vercel keeps these lines in its log stream, so they must never contain customer data,
 * credentials or tokens. `redact()` is applied to every message before it is written (pure → unit-tested).
 */
const PATTERNS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt]"], // JWTs (Supabase keys/sessions)
  [/sb_(secret|publishable)_[A-Za-z0-9_-]{8,}/g, "[key]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/(?:\+|00)?964\s?7\d{8,9}|\b0?7\d{9}\b/g, "[phone]"], // Iraqi mobile numbers
  [/(password|passwd|secret|token|apikey|api_key|authorization)(["'\s:=]+)[^\s"',}]{3,}/gi, "$1$2[redacted]"],
  [/([?&](?:token|key|apikey|access_token|code)=)[^&\s]+/gi, "$1[redacted]"],
];

export function redact(input: unknown, max = 400): string {
  let text = typeof input === "string" ? input : input instanceof Error ? `${input.name}: ${input.message}` : String(input);
  for (const [re, to] of PATTERNS) text = text.replace(re, to);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One structured line: scope + redacted message (+ Next's error digest to correlate with the browser's error page). */
export function logError(scope: string, error: unknown, extra: Record<string, string | number | undefined> = {}): void {
  const digest = (error as { digest?: string } | null)?.digest;
  console.error(JSON.stringify({ level: "error", scope, message: redact(error), ...(digest ? { digest } : {}), ...extra }));
}
