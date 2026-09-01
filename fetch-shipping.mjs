// Collects a global snapshot of oil & gas tanker positions (AIS ship types
// 80-89) from aisstream.io and writes data/shipping.json.
// Ship TYPE broadcasts are infrequent (~every 6 min), so this keeps a rolling
// mmsi->type cache (data/ais-types.json) that grows across runs — each run
// then matches live positions against every tanker it has ever identified.
// Requires the AISSTREAM_KEY repository secret; without it, writes an empty
// file and exits cleanly. Node 22+ (native WebSocket).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "shipping.json");
const TYPES_PATH = join(ROOT, "data", "ais-types.json");
mkdirSync(join(ROOT, "data"), { recursive: true });

const KEY = process.env.AISSTREAM_KEY;
if (!KEY) {
  writeFileSync(OUT, JSON.stringify({ updated: null, note: "no-key", ships: [] }));
  console.log("AISSTREAM_KEY not set — wrote empty shipping.json (tanker layer disabled).");
  process.exit(0);
}

const COLLECT_MS = 90000;   // listen window per run
const MAX_SHIPS = 4000;
const MAX_TYPE_CACHE = 400000;

// rolling type cache from previous runs: { "<mmsi>": typeCode }
let typeCache = {};
if (existsSync(TYPES_PATH)) {
  try { typeCache = JSON.parse(readFileSync(TYPES_PATH, "utf8")); } catch { typeCache = {}; }
}
let newTypes = 0;

const positions = new Map(); // mmsi -> {lat,lng,sog,name}

const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    APIKey: KEY,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
    FilterMessageTypes: ["PositionReport", "ShipStaticData"],
  }));
  console.log("Connected to aisstream, collecting…");
});

ws.addEventListener("message", async (ev) => {
  try {
    let txt;
    if (typeof ev.data === "string") txt = ev.data;
    else if (ev.data instanceof ArrayBuffer) txt = Buffer.from(ev.data).toString();
    else if (typeof ev.data?.arrayBuffer === "function") txt = Buffer.from(await ev.data.arrayBuffer()).toString();
    else txt = String(ev.data);
    const m = JSON.parse(txt);
    const meta = m.MetaData ?? {};
    const mmsi = meta.MMSI;
    if (!mmsi) return;
    if (m.MessageType === "PositionReport") {
      const p = m.Message?.PositionReport ?? {};
      const lat = meta.latitude ?? p.Latitude;
      const lng = meta.longitude ?? p.Longitude;
      if (lat == null || lng == null) return;
      if (positions.size < 400000 || positions.has(mmsi)) {
        positions.set(mmsi, {
          lat: +(+lat).toFixed(3),
          lng: +(+lng).toFixed(3),
          sog: p.Sog,
          cog: p.Cog,
          name: (meta.ShipName ?? "").trim(),
        });
      }
    } else if (m.MessageType === "ShipStaticData") {
      const t = m.Message?.ShipStaticData?.Type;
      // cache tankers only — keeps the cache file small
      if (t != null && t >= 80 && t <= 89 && typeCache[mmsi] !== t) {
        if (typeCache[mmsi] === undefined) newTypes++;
        typeCache[mmsi] = t;
      }
    }
  } catch { /* skip malformed frame */ }
});

ws.addEventListener("error", (e) => console.error("WS error:", e?.message ?? e));

setTimeout(() => {
  try { ws.close(); } catch { /* already closed */ }

  // persist the (possibly trimmed) type cache for the next run
  let entries = Object.entries(typeCache);
  if (entries.length > MAX_TYPE_CACHE) entries = entries.slice(entries.length - MAX_TYPE_CACHE);
  writeFileSync(TYPES_PATH, JSON.stringify(Object.fromEntries(entries)));

  const ships = [];
  for (const [mmsi, p] of positions) {
    const t = typeCache[mmsi];
    if (t == null || t < 80 || t > 89) continue;   // tankers only (oil/chem/LNG/LPG)
    if (p.lat == null || p.lng == null || Number.isNaN(p.lat)) continue;
    ships.push({ mmsi: +mmsi, name: p.name || `MMSI ${mmsi}`, lat: p.lat, lng: p.lng, sog: p.sog, cog: p.cog, t });
    if (ships.length >= MAX_SHIPS) break;
  }
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), ships }));

  // Rolling position history per tanker (data/ship-tracks.json) — one breadcrumb
  // per run, last 12 points (~6 hours at the 30-min cadence). Ships absent from
  // this snapshot are dropped so the file stays bounded.
  const TRACKS_PATH = join(ROOT, "data", "ship-tracks.json");
  let tracks = {};
  if (existsSync(TRACKS_PATH)) {
    try { tracks = JSON.parse(readFileSync(TRACKS_PATH, "utf8")); } catch { tracks = {}; }
  }
  const newTracks = {};
  for (const s of ships) {
    const arr = tracks[s.mmsi] ?? [];
    const last = arr[arr.length - 1];
    if (!last || Math.abs(last[0] - s.lat) > 0.002 || Math.abs(last[1] - s.lng) > 0.002) {
      arr.push([s.lat, s.lng]);
    }
    newTracks[s.mmsi] = arr.slice(-12);
  }
  writeFileSync(TRACKS_PATH, JSON.stringify(newTracks));

  console.log(`Wrote data/shipping.json (${ships.length} tankers · ${positions.size} vessels heard · ` +
    `tanker cache ${entries.length}, +${newTypes} new) and ship-tracks.json (${Object.keys(newTracks).length} trails)`);
  process.exit(0);
}, COLLECT_MS);
