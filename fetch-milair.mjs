// Snapshot of worldwide military ADS-B contacts from adsb.lol (airplanes.live as
// fallback), written to data/milair.json by the refresh Action. The browser uses
// the live API directly and only falls back to this file if both live sources are
// unreachable (blocked network, CORS change, outage). No key needed. Node 22+.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// works from scripts/ or from the repo root (GitHub's uploader sometimes flattens folders)
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(HERE, "index.html")) ? HERE : join(HERE, "..");
const OUT = join(ROOT, "data", "milair.json");
mkdirSync(join(ROOT, "data"), { recursive: true });

const SOURCES = ["https://api.adsb.lol/v2/mil", "https://api.airplanes.live/v2/mil"];
const KEEP = ["hex", "flight", "t", "r", "desc", "lat", "lon", "alt_baro", "gs", "track", "squawk", "ownOp", "category", "seen_pos"];

for (const url of SOURCES) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "global-monitor (GitHub Pages dashboard)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const ac = (json.ac ?? []).filter((a) => a.lat != null && a.lon != null)
      .map((a) => Object.fromEntries(KEEP.filter((k) => a[k] != null).map((k) => [k, a[k]])));
    writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: url, ac }));
    console.log(`${ac.length} military aircraft from ${url}`);
    process.exit(0);
  } catch (e) {
    console.warn(`${url} failed: ${e.message}`);
  }
}
console.warn("No military ADS-B source reachable; leaving data/milair.json untouched.");
