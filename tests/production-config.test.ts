import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { checkProductionEnv, forbiddenRuntimeVars } from "../src/lib/prod-env";
import { logError, redact } from "../src/lib/log";
import { planResize } from "../src/lib/media/client-compress";
import { productSchema } from "../src/components/seo/schemas";
import { absoluteUrl, site } from "../src/lib/site";
import { sameAsUrls } from "../src/data/social";
import type { Product } from "../src/types/product";

const good = {
  NEXT_PUBLIC_SITE_URL: "https://ameera-basha.example-shop.iq",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
};

describe("production environment validation", () => {
  it("accepts a correct https configuration", () => assert.deepEqual(checkProductionEnv(good), []));
  it("reports every missing variable by NAME", () => {
    const names = checkProductionEnv({}).map((p) => p.variable).sort();
    assert.deepEqual(names, ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  });
  it("rejects localhost / http / placeholder domains", () => {
    for (const site of ["http://localhost:3000", "http://example.com", "https://example.com", "https://your-domain.com", "https://127.0.0.1", "not a url", "https://shop.iq/some/path"]) {
      assert.ok(checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: site }).some((p) => p.variable === "NEXT_PUBLIC_SITE_URL"), site);
    }
    for (const supa of ["http://127.0.0.1:54321", "http://localhost:54321", "https://localhost"]) {
      assert.ok(checkProductionEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: supa }).some((p) => p.variable === "NEXT_PUBLIC_SUPABASE_URL"), supa);
    }
  });
  it("never puts a secret VALUE into a problem message", () => {
    const secret = "sb_secret_SUPERSECRETVALUE1234567890";
    const out = JSON.stringify(checkProductionEnv({ NEXT_PUBLIC_SITE_URL: secret, NEXT_PUBLIC_SUPABASE_URL: secret, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }));
    assert.ok(!out.includes("SUPERSECRET"));
  });
  it("flags operator-only secrets that must not be set on the host", () => {
    assert.deepEqual(forbiddenRuntimeVars({ SUPABASE_SERVICE_ROLE_KEY: "x", E2E_ADMIN_PASSWORD: "" }), ["SUPABASE_SERVICE_ROLE_KEY"]);
    assert.deepEqual(forbiddenRuntimeVars(good), []);
  });
});

describe("log redaction (no customer data / secrets in server logs)", () => {
  it("removes JWTs, keys, bearer tokens, e-mails and Iraqi phone numbers", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuvwxyz";
    const text = `failed for boss@shop.iq phone 07701234567 / +9647701234567 key ${jwt} Bearer abcdef123456789 token=abc123 sb_secret_abcdefgh123456`;
    const out = redact(text);
    for (const leaked of ["boss@shop.iq", "07701234567", "7701234567", "eyJhbGci", "abcdef123456789", "abc123", "sb_secret_abcdefgh"]) assert.ok(!out.includes(leaked), `leaked ${leaked}: ${out}`);
  });
  it("redacts password-like key/value pairs and truncates long messages", () => {
    assert.ok(!redact('login failed {"password":"Hunter2-Hunter2"}').includes("Hunter2"));
    assert.ok(redact("x".repeat(5000)).length <= 401);
  });
  it("logError writes one JSON line with the digest but no raw error object", () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (l: string) => lines.push(l);
    try {
      const err = Object.assign(new Error("db down for 07701234567"), { digest: "d123" });
      logError("route:/x", err, { method: "POST" });
    } finally {
      console.error = original;
    }
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.digest, "d123");
    assert.equal(parsed.method, "POST");
    assert.ok(!lines[0].includes("07701234567"));
  });
});

describe("browser-side upload downscaling", () => {
  it("never upscales and keeps the aspect ratio", () => {
    assert.deepEqual(planResize(1200, 900), { width: 1200, height: 900, scaled: false });
    assert.deepEqual(planResize(4800, 3200, 2400), { width: 2400, height: 1600, scaled: true });
    assert.deepEqual(planResize(3000, 6000, 2400), { width: 1200, height: 2400, scaled: true });
  });
});

describe("SEO: product structured data with Supabase image URLs", () => {
  const p = { id: "1", slug: "a", name: "فستان", category: "women", categoryName: "ملابس نسائية", subcategory: "", subcategoryName: "", images: [{ src: "https://x.supabase.co/storage/v1/object/public/store-media/products/a/1.webp", width: 1, height: 1 }, { src: "/products/1/1.webp", width: 1, height: 1 }], source: "manual", postedAt: "2026-01-01" } as Product;
  it("keeps absolute image URLs intact and prefixes site-relative ones", () => {
    const images = productSchema(p).image as string[];
    assert.equal(images[0], "https://x.supabase.co/storage/v1/object/public/store-media/products/a/1.webp");
    assert.equal(images[1], `${site.url}/products/1/1.webp`);
    assert.equal(absoluteUrl("brand/x.png"), `${site.url}/brand/x.png`);
  });
  it("TikTok (probable, unverified) stays out of sameAs", () => {
    assert.ok(!sameAsUrls().some((u) => u.includes("tiktok.com")));
  });
});

describe("repository hygiene: no credentials anywhere in the project files", () => {
  const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const base = decodeURIComponent(root);
  const SKIP = new Set(["node_modules", ".next", ".git", "backups", "public", ".claude"]);
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".env.local") || name === ".env.production.local") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|mts|mjs|js|json|md|sql|toml|css|txt|yml|yaml)$/.test(name) && statSync(p).size < 2_000_000) out.push(p);
    }
    return out;
  }
  const files = walk(base).filter((f) => !/package-lock\.json$/.test(f) && !/tests[\\/]/.test(f));
  it("no test/default passwords, JWTs or Supabase secret keys in any committed file", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = relative(base, file);
      assert.ok(!/Local-Test-(Admin|Editor)/.test(text), `${rel} contains a test password`);
      assert.ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(text), `${rel} contains a Supabase secret key`);
      assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(text), `${rel} contains a JWT`);
    }
  });
  it(".env.example has only empty values for secrets and no personal e-mail", () => {
    const text = readFileSync(join(base, ".env.example"), "utf8");
    for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "E2E_ADMIN_PASSWORD", "E2E_EDITOR_PASSWORD", "E2E_ADMIN_EMAIL", "E2E_EDITOR_EMAIL"]) {
      const m = new RegExp(`^${key}=(.*)$`, "m").exec(text);
      assert.ok(m, `${key} missing from .env.example`);
      assert.equal(m![1].trim(), "", `${key} must be empty in .env.example`);
    }
    assert.ok(!/@ameera\.test/.test(text));
  });
  it("git ignores real env files but keeps the template", () => {
    const ignore = readFileSync(join(base, ".gitignore"), "utf8");
    assert.match(ignore, /^\.env\*$/m);
    assert.match(ignore, /^!\.env\.example$/m);
    assert.match(ignore, /^\/backups\/$/m);
    assert.ok(existsSync(join(base, ".env.example")));
  });
});
