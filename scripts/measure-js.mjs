/**
 * Bundle-size probe: for each route, fetch the HTML of a running `next start`, collect every same-origin <script src>
 * and <link rel=modulepreload/preload as=script>, then report raw + gzip bytes.  Usage: node scripts/measure-js.mjs [baseUrl]
 */
import zlib from "node:zlib";
const base = process.argv[2] ?? "http://localhost:3100";
const routes = ["/", "/products", "/products/26598"];
const out = {};
for (const r of routes) {
  const html = await (await fetch(base + r)).text();
  const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
  let raw = 0, gz = 0;
  for (const u of urls) {
    const buf = Buffer.from(await (await fetch(base + u)).arrayBuffer());
    raw += buf.length;
    gz += zlib.gzipSync(buf).length;
  }
  out[r] = { scripts: urls.length, rawKB: +(raw / 1024).toFixed(1), gzipKB: +(gz / 1024).toFixed(1) };
}
console.log(JSON.stringify(out, null, 1));
