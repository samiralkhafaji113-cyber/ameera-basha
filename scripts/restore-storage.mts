/**
 * Re-uploads the files of a backup made by scripts/backup.mts into the `store-media` bucket (same paths → same public URLs).
 * Non-destructive: existing objects with the same path are overwritten with the backed-up bytes, nothing is deleted.
 *
 *   tsx --env-file=.env.production.local scripts/restore-storage.mts backups/<timestamp> --allow-remote
 */
import fs from "node:fs";
import path from "node:path";
import { operatorTarget } from "./lib/operator.mts";

const { db, args } = operatorTarget("Restore storage files from a backup");
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) throw new Error("usage: restore-storage.mts <backup-folder> [--allow-remote]");
const root = path.join(dir, "storage", "store-media");
if (!fs.existsSync(root)) throw new Error(`no storage backup found in ${root}`);

let done = 0;
let failed = 0;
function* walk(d: string): Generator<string> {
  for (const name of fs.readdirSync(d)) {
    const p = path.join(d, name);
    if (fs.statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
for (const file of walk(root)) {
  const objectPath = path.relative(root, file).split(path.sep).join("/");
  const { error } = await db.storage.from("store-media").upload(objectPath, fs.readFileSync(file), { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) {
    failed++;
    console.error(`FAILED ${objectPath}: ${error.message}`);
  } else done++;
}
console.log(`restored ${done} files, ${failed} failed`);
process.exit(failed ? 1 : 0);
