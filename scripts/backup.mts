/**
 * Operator backup of a Supabase project → ./backups/<timestamp>/  (folder is git-ignored: it contains CUSTOMER DATA).
 *
 *   tsx --env-file=.env.production.local scripts/backup.mts --allow-remote [--no-storage]
 *
 * Exports every table as JSON (paged) and downloads every object of the `store-media` bucket. It is READ-ONLY on the
 * project. This is a portable safety net in addition to Supabase's own backups (see docs/production.md → Backup):
 *   - tables:  restore with scripts/restore-notes in docs/production.md (or `supabase db dump` for a full SQL dump)
 *   - storage: the files are copied byte-for-byte with their paths, so re-uploading them recreates the same public URLs
 */
import fs from "node:fs";
import path from "node:path";
import { flag, operatorTarget } from "./lib/operator.mts";

const { db, args, host } = operatorTarget("Backup (read-only)");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.resolve(import.meta.dirname, "..", "backups", stamp);
fs.mkdirSync(path.join(dir, "tables"), { recursive: true });

const TABLES = ["categories", "subcategories", "products", "product_images", "product_slug_history", "reservations", "reservation_counters", "audit_logs", "profiles"];
const summary: Record<string, number> = {};
for (const table of TABLES) {
  const all: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  fs.writeFileSync(path.join(dir, "tables", `${table}.json`), JSON.stringify(all, null, 1));
  summary[table] = all.length;
}
console.log("tables:", JSON.stringify(summary));

let files = 0;
let bytes = 0;
if (!flag(args, "no-storage")) {
  async function walk(prefix: string): Promise<void> {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await db.storage.from("store-media").list(prefix, { limit: 100, offset });
      if (error) throw new Error(`storage list ${prefix}: ${error.message}`);
      for (const entry of data ?? []) {
        const p = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) await walk(p); // folder
        else {
          const { data: blob, error: e2 } = await db.storage.from("store-media").download(p);
          if (e2 || !blob) throw new Error(`download ${p}: ${e2?.message}`);
          const target = path.join(dir, "storage", "store-media", ...p.split("/"));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const buf = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(target, buf);
          files++;
          bytes += buf.length;
        }
      }
      if (!data || data.length < 100) break;
    }
  }
  await walk("");
  console.log(`storage: ${files} files · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify({ project: host, takenAt: new Date().toISOString(), tables: summary, storageFiles: files, storageBytes: bytes }, null, 2));
console.log(`backup written to ${dir}`);
