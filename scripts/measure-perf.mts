/**
 * Response-time + payload measurement against a RUNNING production build (npm run build && npm start -- -p 3100).
 *   tsx --env-file=.env.local scripts/measure-perf.mts [baseUrl]
 * Public pages are measured without a session; admin pages with a real admin session (cookie from @supabase/ssr).
 * Reports median / p95 of N requests (after one warm-up), transfer size and – for the catalog – the number of rows.
 */
import { createServerClient } from "@supabase/ssr";
import { gzipSync } from "node:zlib";

const BASE = process.argv[2] ?? "http://localhost:3100";
const N = 15;

async function adminCookie(): Promise<string> {
  const jar = new Map<string, string>();
  const c = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await c.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! });
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];

async function measure(path: string, headers: Record<string, string> = {}) {
  await fetch(BASE + path, { headers });
  const times: number[] = [];
  let bytes = 0;
  let status = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const res = await fetch(BASE + path, { headers });
    const body = Buffer.from(await res.arrayBuffer());
    times.push(performance.now() - t);
    bytes = gzipSync(body).length;
    status = res.status;
  }
  return { path, status, medianMs: +pct(times, 50).toFixed(1), p95Ms: +pct(times, 95).toFixed(1), gzipKB: +(bytes / 1024).toFixed(1) };
}

const cookie = await adminCookie();
const { data: list } = await (await fetch(`${BASE}/sitemap.xml`)).text().then((t) => ({ data: [...t.matchAll(/\/products\/([^<]+)</g)].map((m) => m[1]) }));
const sample = list?.[0] ?? "26807";

const results = [];
for (const p of ["/", "/products", `/products/${sample}`]) results.push(await measure(p));
for (const p of ["/admin", "/admin/products", "/admin/reservations", "/admin/categories"]) results.push(await measure(p, { cookie }));
console.table(results);
