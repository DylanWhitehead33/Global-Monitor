// Fetches orbital elements (TLEs) from CelesTrak for the satellite layer and
// writes data/tles.json. CelesTrak asks clients to fetch each group no more
// than once every 2 hours, so this only refreshes when the file is older than
// 6 hours; the browser then reads the committed file instead of hitting
// CelesTrak once per visitor. No key needed. Node 22+.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// works from scripts/ or from the repo root (GitHub's uploader sometimes flattens folders)
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(HERE, "index.html")) ? HERE : join(HERE, "..");
const OUT = join(ROOT, "data", "tles.json");
mkdirSync(join(ROOT, "data"), { recursive: true });

const GROUPS = ["stations", "visual", "gps-ops"];
const MAX_AGE_MS = 6 * 3600 * 1000;

let prev = null;
if (existsSync(OUT)) {
  try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { prev = null; }
}
if (prev?.updated && Date.now() - Date.parse(prev.updated) < MAX_AGE_MS && Object.keys(prev.groups ?? {}).length === GROUPS.length) {
  console.log(`tles.json is ${Math.round((Date.now() - Date.parse(prev.updated)) / 60000)} min old — skipping CelesTrak.`);
  process.exit(0);
}

const groups = {};
for (const g of GROUPS) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "global-monitor (GitHub Pages dashboard)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const n = text.split("\n").filter((l) => l.startsWith("1 ")).length;
    if (n < 1) throw new Error("no TLE lines in response");
    groups[g] = text.trim();
    console.log(`${g}: ${n} objects`);
  } catch (e) {
    console.warn(`${g} failed: ${e.message}${prev?.groups?.[g] ? " — keeping previous" : ""}`);
    if (prev?.groups?.[g]) groups[g] = prev.groups[g];
  }
}
if (!Object.keys(groups).length) {
  console.warn("No TLE groups fetched; leaving existing file untouched.");
  process.exit(0);
}
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "CelesTrak", groups }));
console.log(`Wrote ${OUT}`);
