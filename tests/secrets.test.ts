import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const decode = (p: string) => decodeURIComponent(p);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("secrets never reach application or client code", () => {
  const src = walk(join(decode(root), "src")).filter((f) => /\.(ts|tsx|mjs|js|json|css)$/.test(f));

  // src/lib/prod-env.ts only lists the variable NAME so the Vercel build can warn if someone adds it to the host; it is used by
  // next.config.ts and the operator scripts and must never be imported by application code (asserted below).
  const NAME_ONLY = /[\\/]lib[\\/]prod-env\.ts$/;

  it("nothing under src/ reads or mentions the service-role key", () => {
    for (const file of src.filter((f) => !NAME_ONLY.test(f))) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/SERVICE_ROLE/i.test(text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")), `${file} references the service-role key`);
    }
  });

  it("prod-env.ts (which names the key) is not imported by any application module", () => {
    for (const file of src.filter((f) => !NAME_ONLY.test(f))) {
      assert.ok(!/prod-env/.test(readFileSync(file, "utf8")), `${file} imports prod-env`);
    }
  });

  it("no JWT-shaped or sb_secret tokens are hard-coded in src/ or scripts/", () => {
    const files = [...src, ...walk(join(decode(root), "scripts"))];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(text), `${file} contains a JWT`);
      assert.ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(text), `${file} contains a Supabase secret key`);
    }
  });

  it("admin credentials are not present in the source tree", () => {
    for (const file of src) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/Local-Test-(Admin|Editor)/.test(text), `${file} contains a test password`);
    }
  });

  it("the built client bundle (when present) does not contain the service-role key or server-only env names", () => {
    const dir = join(decode(root), ".next", "static");
    if (!existsSync(dir)) return; // only meaningful after `npm run build`
    const env = readFileSync(join(decode(root), ".env.local"), "utf8");
    const key = /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m.exec(env)?.[1]?.trim();
    for (const file of walk(dir).filter((f) => /\.(js|css|html|json|map)$/.test(f))) {
      const text = readFileSync(file, "utf8");
      if (key) assert.ok(!text.includes(key), `${file} contains the service-role key`);
      assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(text), `${file} mentions SUPABASE_SERVICE_ROLE_KEY`);
    }
  });
});
