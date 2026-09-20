/**
 * Node port of the BM25 search in ~/.claude/skills/ui-ux-pro-max/scripts/core.py
 * (Python 3 is not installed on this machine, so search.py cannot run).
 *
 * Faithful to core.py: same CSV_CONFIG search columns, same tokenizer (lowercase → synonym
 * substitution → strip punctuation → drop <2-char tokens and stopwords), same BM25 (k1=1.5,
 * b=0.75, idf = ln((N-n+0.5)/(n+0.5)+1)), and the `style` domain only indexes Status == "active".
 * NOT ported: domain-keyword query rewrites and the abstain/threshold calibration.
 *
 * Usage:
 *   node scripts/uiux-search.mjs stats
 *   node scripts/uiux-search.mjs <domain> "<query>" [maxResults]
 *   domains: style color typography landing product ux google-fonts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA = path.join(os.homedir(), ".claude/skills/ui-ux-pro-max/data");

const CONFIG = {
  style: { file: "styles.csv", cols: ["Style ID", "Style Category", "Aliases", "Keywords", "Best For", "Type", "AI Prompt Keywords"], show: ["No", "Style ID", "Style Category", "Type", "Keywords", "Best For", "Do Not Use For", "Mobile-Friendly", "Accessibility", "Performance", "Status"] },
  color: { file: "colors.csv", cols: ["Product Type", "Notes"], show: ["No", "Product Type", "Primary", "Secondary", "Accent", "Background", "Foreground", "Muted", "Border", "Notes"] },
  typography: { file: "typography.csv", cols: ["Font Pairing Name", "Category", "Mood/Style Keywords", "Best For", "Heading Font", "Body Font"], show: ["No", "Font Pairing Name", "Heading Font", "Body Font", "Mood/Style Keywords", "Best For"] },
  landing: { file: "landing.csv", cols: ["Pattern ID", "Pattern Name", "Aliases", "Keywords", "Conversion Optimization", "Section Order"], show: ["No", "Pattern Name", "Section Order", "Primary CTA Placement", "Conversion Optimization"] },
  product: { file: "products.csv", cols: ["Product Type", "Keywords", "Primary Style Recommendation", "Key Considerations"], show: ["No", "Product Type", "Primary Style Recommendation", "Secondary Styles", "Landing Page Pattern", "Color Palette Focus"] },
  ux: { file: "ux-guidelines.csv", cols: ["Category", "Issue", "Description", "Platform"], show: ["No", "Category", "Issue", "Description", "Do", "Severity"] },
  "google-fonts": { file: "google-fonts.csv", cols: ["Family", "Category", "Stroke", "Classifications", "Keywords", "Subsets", "Designers"], show: ["Family", "Category", "Subsets", "Popularity Rank"] },
};

const STOP = new Set(["to", "in", "on", "at", "is", "of", "by", "or", "an", "if", "no", "so", "do", "be", "we", "it", "as", "the", "and", "for", "are", "was"]);
const SYN = { "q&a": "question answer", "e-commerce": "ecommerce", "dark-mode": "dark", darkmode: "dark", "light-mode": "light", lightmode: "light", a11y: "accessibility", nav: "navigation", "sign-up": "signup", "log-in": "login", colour: "color", colours: "colors", customisation: "customization", organisation: "organization", behaviour: "behavior", "ux/ui": "ux ui" };
const SYN_RE = Object.entries(SYN)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([k, v]) => [new RegExp(`(?<![\\p{L}\\p{N}_])${k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "giu"), v]);

function tokenize(text) {
  let t = String(text).toLowerCase();
  for (const [re, v] of SYN_RE) t = t.replace(re, v);
  t = t.replace(/[^\p{L}\p{N}_\s]/gu, " ");
  return t.split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w));
}

export function parseCsv(text) {
  const rows = [];
  let r = [], c = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { r.push(c); c = ""; }
    else if (ch === "\n") { r.push(c.replace(/\r$/, "")); rows.push(r); r = []; c = ""; }
    else c += ch;
  }
  if (c || r.length) { r.push(c); rows.push(r); }
  const [h, ...b] = rows;
  return b.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
}

export const load = (file) => parseCsv(fs.readFileSync(path.join(DATA, file), "utf8"));

export function search(domain, query, max = 5) {
  const cfg = CONFIG[domain];
  let rows = load(cfg.file);
  if (domain === "style") rows = rows.filter((r) => (r.Status ?? "active") === "active");
  const docs = rows.map((r) => tokenize(cfg.cols.map((c) => r[c] ?? "").join(" ")));
  const N = docs.length, K1 = 1.5, B = 0.75;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = new Map();
  const tfs = docs.map((d) => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) ?? 0) + 1); for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1); return m; });
  const idf = (w) => Math.log((N - df.get(w) + 0.5) / (df.get(w) + 0.5) + 1);
  const q = tokenize(query);
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const w of q) if (df.has(w)) { const tf = tfs[i].get(w) ?? 0; s += (idf(w) * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / avgdl)); }
    return [i, s];
  }).sort((a, b) => b[1] - a[1]);
  return { indexed: N, results: scored.slice(0, max).filter(([, s]) => s > 0).map(([i, s]) => ({ score: +s.toFixed(3), ...Object.fromEntries(cfg.show.map((c) => [c, (rows[i][c] ?? "").slice(0, 150)])) })) };
}

export function stats() {
  const styles = load("styles.csv");
  const by = {};
  for (const s of styles) by[s.Status || "active"] = (by[s.Status || "active"] ?? 0) + 1;
  const count = (f) => load(f).length;
  return {
    styles: { totalRows: styles.length, byStatus: by, searchableNonDeprecated: styles.filter((s) => s.Status !== "deprecated").length },
    colors_palettes: count("colors.csv"),
    products: count("products.csv"),
    ui_reasoning_profiles: count("ui-reasoning.csv"),
    typography_pairings: count("typography.csv"),
    google_fonts: count("google-fonts.csv"),
    ux_guidelines: count("ux-guidelines.csv"),
    landing_patterns: count("landing.csv"),
    icons: count("icons.csv"),
    motion_presets: count("motion.csv"),
    charts: count("charts.csv"),
    stacks: fs.readdirSync(path.join(DATA, "stacks")).length,
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("uiux-search.mjs")) {
  const [, , a, b, c] = process.argv;
  if (a === "stats") console.log(JSON.stringify(stats(), null, 2));
  else if (a && b) console.log(JSON.stringify(search(a, b, Number(c) || 5), null, 1));
}
