// Collects a global snapshot of oil & gas tanker positions (AIS ship types
// 80-89) from aisstream.io and writes data/shipping.json.
// Requires a free API key stored as the AISSTREAM_KEY repository secret —
// without it, this writes an empty file and exits cleanly.
// Runs in the GitHub Action every 30 minutes. Node 22+ (native WebSocket).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "shipping.json");
mkdirSync(join(ROOT, "data"), { recursive: true });

const KEY = process.env.AISSTREAM_KEY;
if (!KEY) {
  writeFileSync(OUT, JSON.stringify({ updated: null, note: "no-key", ships: [] }));
  console.log("AISSTREAM_KEY not set — wrote empty shipping.json (tanker layer disabled).");
  process.exit(0);
}

const COLLECT_MS = 75000;   // listen window per run
const MAX_SHIPS = 1500;

const positions = new Map(); // mmsi -> {lat,lng,sog,cog,name,ts}
const types = new Map();     // mmsi -> AIS ship type code

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
      if (positions.size < 250000 || positions.has(mmsi)) {
        positions.set(mmsi, {
          lat: +(meta.latitude ?? p.Latitude)?.toFixed?.(3),
          lng: +(meta.longitude ?? p.Longitude)?.toFixed?.(3),
          sog: p.Sog, cog: p.Cog,
          name: (meta.ShipName ?? "").trim(),
        });
      }
    } else if (m.MessageType === "ShipStaticData") {
      const t = m.Message?.ShipStaticData?.Type;
      if (t != null) types.set(mmsi, t);
    }
  } catch { /* skip malformed frame */ }
});

ws.addEventListener("error", (e) => console.error("WS error:", e?.message ?? e));

setTimeout(() => {
  try { ws.close(); } catch { /* already closed */ }
  const ships = [];
  for (const [mmsi, t] of types) {
    if (t < 80 || t > 89) continue;           // tankers only (oil/chem/LNG/LPG)
    const p = positions.get(mmsi);
    if (!p || p.lat == null || p.lng == null || Number.isNaN(p.lat)) continue;
    ships.push({ mmsi, name: p.name || `MMSI ${mmsi}`, lat: p.lat, lng: p.lng, sog: p.sog, t });
    if (ships.length >= MAX_SHIPS) break;
  }
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), ships }));
  console.log(`Wrote data/shipping.json (${ships.length} tankers from ${positions.size} tracked vessels)`);
  process.exit(0);
}, COLLECT_MS);
