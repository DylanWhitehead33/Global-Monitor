/* GLOBAL MONITOR — client logic
 * News comes from data/news.json (refreshed by GitHub Actions every 30 min).
 * Quakes, crypto, FX, and space weather are fetched live from open CORS APIs.
 */
"use strict";

const $ = (id) => document.getElementById(id);

/* ---------- system status readout ---------- */
const SYS = { news: null, quakes: null, markets: null, crypto: null, fx: null, kp: null, milair: null, sats: null };
function sysReport(key, ok) {
  SYS[key] = ok;
  const vals = Object.values(SYS);
  const done = vals.filter((v) => v !== null).length;
  const up = vals.filter((v) => v === true).length;
  const el = $("sys-status");
  if (!el) return;
  if (done < vals.length) el.textContent = `BRINGING SYSTEMS ONLINE… ${up}/${vals.length}`;
  else if (up === vals.length) el.textContent = "ALL SYSTEMS NOMINAL";
  else el.textContent = `${up}/${vals.length} FEEDS ONLINE`;
}

/* ---------- clocks ---------- */
function tickClocks() {
  const now = new Date();
  $("clock-utc").textContent = now.toISOString().slice(11, 19);
  $("clock-local").textContent = now.toLocaleTimeString([], { hour12: false });
}
try {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) $("local-label").textContent = tz.split("/").pop().replace(/_/g, " ").toUpperCase();
} catch (_) { /* keep LOCAL */ }
tickClocks();
setInterval(tickClocks, 1000);

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (!isFinite(m) || m < 0) return "";
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ---------- news panels ---------- */
let newsEvents = [];
async function loadNews() {
  try {
    const res = await fetch(`data/news.json?cb=${Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const updated = new Date(data.updated);
    $("data-age").textContent = ago(updated.getTime()) || "—";
    for (const cat of ["world", "geopolitics", "tech", "finance"]) {
      const list = $(`feed-${cat}`);
      const items = (data.categories?.[cat] ?? []).slice(0, 30);
      $(`note-${cat}`).textContent = items.length ? `${items.length} items` : "";
      list.innerHTML = items.length
        ? items.map((i) =>
            `<li><a href="${esc(i.u)}" target="_blank" rel="noopener">${esc(i.t)}` +
            `<span class="meta">${esc(i.s)}${i.ts ? " · " + ago(i.ts) : ""}</span></a></li>`
          ).join("")
        : `<li class="empty">No items yet — the refresh Action populates this within 30 minutes of deploy.</li>`;
    }
    newsEvents = data.events ?? [];
    sysReport("news", true);
  } catch (e) {
    console.error("news.json load failed:", e);
    $("data-age").textContent = "unavailable";
    sysReport("news", false);
  }
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- earthquakes (USGS, CORS-open) ---------- */
let quakePoints = [];
async function loadQuakes() {
  try {
    const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const gj = await res.json();
    const quakes = gj.features
      .map((f) => ({
        mag: f.properties.mag, place: f.properties.place, time: f.properties.time,
        url: f.properties.url, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      }))
      .sort((a, b) => b.mag - a.mag);
    $("quake-note").textContent = `${quakes.length} events M2.5+`;
    $("feed-quakes").innerHTML = quakes.slice(0, 25).map((q) =>
      `<li><span class="mag">M${q.mag?.toFixed(1)}</span>` +
      `<a class="qtitle" href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.place ?? "unknown")}` +
      `<span class="meta">${ago(q.time)}</span></a></li>`
    ).join("") || `<li class="empty">No M2.5+ quakes reported.</li>`;
    quakePoints = quakes;
    sysReport("quakes", true);
  } catch (e) {
    console.error("USGS load failed:", e);
    $("feed-quakes").innerHTML = `<li class="empty">Seismic feed unavailable right now.</li>`;
    sysReport("quakes", false);
  }
}

/* ---------- crypto (CoinGecko, CORS-open, no key) ---------- */
function sparkSVG(prices, w = 110, h = 34) {
  if (!prices?.length) return "";
  const min = Math.min(...prices), max = Math.max(...prices), span = max - min || 1;
  const step = w / (prices.length - 1);
  const pts = prices.map((p, i) =>
    `${(i * step).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="7-day price trend">` +
         `<polyline class="spark-line" points="${pts}"/></svg>`;
}
async function loadCrypto() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets" +
      "?vs_currency=usd&ids=bitcoin,ethereum,solana&sparkline=true&price_change_percentage=24h");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const coins = await res.json();
    $("mkt-crypto").innerHTML = coins.map((c) => {
      const chg = c.price_change_percentage_24h ?? 0;
      const cls = chg >= 0 ? "up" : "down";
      const sign = chg >= 0 ? "+" : "−";
      const spark = c.sparkline_in_7d?.price?.filter((_, i) => i % 4 === 0);
      return `<div class="tile">` +
        `<span class="name">${esc(c.symbol.toUpperCase())} · ${esc(c.name)}</span>` +
        `${sparkSVG(spark)}` +
        `<span class="price">$${c.current_price.toLocaleString()} ` +
        `<span class="chg ${cls}">${sign}${Math.abs(chg).toFixed(2)}% 24h</span></span>` +
        `</div>`;
    }).join("");
    sysReport("crypto", true);
  } catch (e) {
    console.error("CoinGecko load failed:", e);
    $("mkt-crypto").innerHTML = `<div class="empty">Crypto feed unavailable right now.</div>`;
    sysReport("crypto", false);
  }
}

/* ---------- stock indexes (data/markets.json, refreshed by GitHub Action) ---------- */
function indexRow(m) {
  const cls = m.chgPct >= 0 ? "up" : "down";
  const sign = m.chgPct >= 0 ? "+" : "−";
  return `<div class="tile">` +
    `<span class="name">${esc(m.name)}</span>` +
    `${sparkSVG(m.spark)}` +
    `<span class="price">${m.price.toLocaleString()} ` +
    `<span class="chg ${cls}">${sign}${Math.abs(m.chgPct).toFixed(2)}%</span></span>` +
    `</div>`;
}
async function loadMarkets() {
  try {
    const res = await fetch(`data/markets.json?cb=${Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const empty = `<div class="empty">Awaiting first data refresh — the GitHub Action populates this within 30 minutes.</div>`;
    $("mkt-us").innerHTML = data.us?.length ? data.us.map(indexRow).join("") : empty;
    $("mkt-global").innerHTML = data.global?.length ? data.global.map(indexRow).join("") : empty;
    if (data.updated) $("note-markets").textContent = `indexes ${ago(Date.parse(data.updated))} · 1mo trend`;
    sysReport("markets", !!(data.us?.length));
  } catch (e) {
    console.error("markets.json load failed:", e);
    $("mkt-us").innerHTML = $("mkt-global").innerHTML =
      `<div class="empty">Index data unavailable — it appears after the first Action run.</div>`;
    sysReport("markets", false);
  }
}

/* ---------- markets tabs ---------- */
function initTabs() {
  const tabs = document.querySelectorAll("#panel-markets .tab");
  tabs.forEach((btn) => btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.toggle("active", b === btn));
    for (const pane of document.querySelectorAll("#panel-markets .tabpane"))
      pane.hidden = pane.id !== `mkt-${btn.dataset.tab}`;
  }));
}

/* ---------- FX (Frankfurter / ECB, CORS-open, no key) ---------- */
const FX_SYMBOLS = ["EUR", "GBP", "JPY", "CNY", "CHF", "CAD", "AUD", "MXN", "INR", "BRL", "KRW", "SGD"];
async function loadFX() {
  try {
    const to = new Date(), from = new Date(Date.now() - 14 * 864e5);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const res = await fetch(`https://api.frankfurter.dev/v1/${fmt(from)}..${fmt(to)}?base=USD&symbols=${FX_SYMBOLS.join(",")}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dates = Object.keys(data.rates).sort();
    $("mkt-fx").innerHTML = FX_SYMBOLS.map((sym) => {
      const series = dates.map((d) => data.rates[d]?.[sym]).filter((v) => v != null);
      if (!series.length) return "";
      const last = series[series.length - 1];
      const prev = series.length > 1 ? series[series.length - 2] : last;
      const chgPct = prev ? ((last - prev) / prev) * 100 : 0;
      const cls = chgPct >= 0 ? "up" : "down";
      const sign = chgPct >= 0 ? "+" : "−";
      return `<div class="tile">` +
        `<span class="name">USD / ${sym}</span>` +
        `${sparkSVG(series)}` +
        `<span class="price">${last.toLocaleString(undefined, { maximumSignificantDigits: 5 })} ` +
        `<span class="chg ${cls}">${sign}${Math.abs(chgPct).toFixed(2)}%</span></span>` +
        `</div>`;
    }).join("");
    sysReport("fx", true);
  } catch (e) {
    console.error("FX load failed:", e);
    $("mkt-fx").innerHTML = `<div class="empty">Currency feed unavailable right now.</div>`;
    sysReport("fx", false);
  }
}

/* ---------- space weather (NOAA SWPC, CORS-open) ---------- */
async function loadKp() {
  try {
    const res = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json(); // [header, ...rows]; row = [time_tag, Kp, a_running, station_count]
    const last = rows[rows.length - 1];
    const kp = parseFloat(last[1]);
    $("kp-value").textContent = kp.toFixed(1);
    const status = kp < 4 ? "QUIET" : kp < 5 ? "ACTIVE" : kp < 6 ? "MINOR STORM (G1)" : kp < 7 ? "MODERATE STORM (G2)" : "STRONG STORM (G3+)";
    $("kp-status").textContent = status;
    $("kp-label").textContent = `Planetary K-index · ${last[0].slice(0, 16)}Z`;
    sysReport("kp", true);
  } catch (e) {
    console.error("NOAA load failed:", e);
    $("kp-status").textContent = "feed unavailable";
    sysReport("kp", false);
  }
}

/* ---------- overlays: news, quakes, tankers, tension, nuclear, military, choke, + live layers ---------- */
const OVL = { news: true, quakes: true, ships: false, tension: false, nuclear: false, military: false, choke: false,
              milair: false, sats: false, cables: false, dc: false };
const OVL_KEYS = Object.keys(OVL);

/* =====================================================================
   LIVE MILITARY AIRCRAFT — adsb.lol /v2/mil (keyless, CORS-open), with
   airplanes.live as a fallback source. Polled every 20 s; positions are
   dead-reckoned between polls from ground speed + track so tracked
   contacts glide instead of jumping.
   ===================================================================== */
const MILAIR_SOURCES = ["https://api.adsb.lol/v2/mil", "https://api.airplanes.live/v2/mil"];
const MILAIR_POLL_MS = 20000;
const milAir = { updated: 0, source: null, error: null, byHex: new Map(), points: [] };
function altColor(ft) {
  if (ft == null || ft === "ground") return "#ffb347";   // on the ground / no baro alt
  if (ft < 10000) return "#7fd4ff";
  if (ft < 30000) return "#4d9fff";
  return "#e0f4ff";
}
function fmtAlt(a) { return a == null ? "—" : a === "ground" ? "GROUND" : `${Math.round(a).toLocaleString()} ft`; }
function milLabel(p) {
  const a = p.ac;
  return `<b>✈ ${esc(a.flight || a.r || a.hex)}</b>` +
    `${a.t ? ` <span class="lbl-dim">${esc(a.t)}</span>` : ""}` +
    `<br>${fmtAlt(a.alt)} · ${a.gs != null ? Math.round(a.gs) + " kn" : "—"} · hdg ${a.track != null ? Math.round(a.track) + "°" : "—"}` +
    `<br><i>${esc(a.desc || "military transponder")} · click to track</i>`;
}
async function loadMilAir() {
  // poll only while the layer is on (the first call at boot just probes the feed)
  if (milAir.updated && !OVL.milair) return;
  let json = null, used = null;
  for (const url of MILAIR_SOURCES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json(); used = url; break;
    } catch (e) { milAir.error = e; }
  }
  if (!json) { sysReport("milair", false); return; }
  milAir.updated = Date.now(); milAir.source = used; milAir.error = null;
  const seen = new Set();
  for (const a of json.ac ?? []) {
    if (a.lat == null || a.lon == null) continue;
    const alt = a.alt_baro ?? a.alt_geom ?? null;
    const rec = {
      hex: a.hex, flight: (a.flight || "").trim(), r: a.r || "", t: a.t || "", desc: a.desc || "",
      lat: a.lat, lng: a.lon, alt, gs: a.gs ?? null, track: a.track ?? null, squawk: a.squawk || "",
      ownOp: a.ownOp || "", cat: a.category || "", seenAt: Date.now() - (a.seen_pos ?? 0) * 1000,
    };
    seen.add(a.hex);
    let p = milAir.byHex.get(a.hex);
    if (!p) {
      p = { lat: rec.lat, lng: rec.lng, size: 0.01, r: 0.32, color: "#4d9fff", ac: rec, label: null,
            __track: { kind: "air", id: a.hex }, trail: [] };
      p.label = () => milLabel(p);
      milAir.byHex.set(a.hex, p);
    } else {
      p.ac = rec;
    }
    p.lat = rec.lat; p.lng = rec.lng;
    p.size = alt === "ground" || alt == null ? 0.004 : 0.004 + Math.min(alt, 50000) / 50000 * 0.05;
    p.color = altColor(alt);
    if (!p.trail.length || Math.abs(p.trail[p.trail.length - 1][0] - rec.lat) > 0.0005 || Math.abs(p.trail[p.trail.length - 1][1] - rec.lng) > 0.0005) {
      p.trail.push([rec.lat, rec.lng]);
      if (p.trail.length > 400) p.trail.shift();
    }
  }
  for (const hex of [...milAir.byHex.keys()]) if (!seen.has(hex)) milAir.byHex.delete(hex);
  milAir.points = [...milAir.byHex.values()];
  sysReport("milair", true);
  if (OVL.milair) {
    $("view-note").textContent = `${milAir.points.length} military aircraft · ${used.includes("adsb.lol") ? "adsb.lol" : "airplanes.live"} · ${ago(milAir.updated)}`;
    refreshGlobe();
    if (satMapInstance && satLayers.milair) renderMilAirInto(satLayers.milair);
  }
}
/* advance aircraft along their track by dt seconds (called from the 2 s tick) */
function deadReckonMilAir(dtSec) {
  for (const p of milAir.points) {
    const a = p.ac;
    if (a.gs == null || a.track == null || a.gs < 30 || a.alt === "ground") continue;
    const distDeg = (a.gs * dtSec / 3600) / 60;
    const rad = (a.track * Math.PI) / 180;
    p.lat += distDeg * Math.cos(rad);
    p.lng += (distDeg * Math.sin(rad)) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
    if (p.lng > 180) p.lng -= 360; else if (p.lng < -180) p.lng += 360;
  }
}
function planeDivIcon(track, color) {
  return L.divIcon({
    className: "plane-icon",
    html: `<svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${Math.round(track ?? 0)}deg)">` +
      `<path d="M12 2 L14 9 L22 13 L22 15 L14 13 L14 18 L17 20 L17 22 L12 21 L7 22 L7 20 L10 18 L10 13 L2 15 L2 13 L10 9 Z" fill="${color}" stroke="#071a2a" stroke-width="1"/></svg>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  });
}
function milPopup(p) {
  const a = p.ac;
  return `<b>✈ ${esc(a.flight || a.r || a.hex)}</b>${a.t ? ` · ${esc(a.t)}` : ""}<br>${esc(a.desc || "military transponder")}` +
    `<br>${fmtAlt(a.alt)} · ${a.gs != null ? Math.round(a.gs) + " kn" : "—"} · hdg ${a.track != null ? Math.round(a.track) + "°" : "—"}` +
    `${a.squawk ? `<br>squawk ${esc(a.squawk)}` : ""}<br><i>hex ${esc(a.hex)} · ${ago(milAir.updated)}</i>`;
}
const PLANE_ICON_ZOOM = 4;
function renderMilAirInto(group) {
  group.clearLayers();
  const map = satMapInstance;
  if (!map) return;
  if (map.getZoom() < PLANE_ICON_ZOOM) {
    for (const p of milAir.points)
      group.addLayer(L.circleMarker([p.lat, p.lng], { radius: 2.5, color: p.color, weight: 1, fillColor: p.color, fillOpacity: 0.85 }).bindPopup(milPopup(p)));
  } else {
    const bounds = map.getBounds().pad(0.25);
    let n = 0;
    for (const p of milAir.points) {
      if (!bounds.contains([p.lat, p.lng])) continue;
      if (++n > 500) break;
      if (p.trail.length >= 2) group.addLayer(L.polyline(p.trail, { color: p.color, weight: 1.2, opacity: 0.45 }));
      group.addLayer(L.marker([p.lat, p.lng], { icon: planeDivIcon(p.ac.track, p.color) }).bindPopup(milPopup(p)));
    }
  }
}

/* =====================================================================
   SATELLITES — CelesTrak TLEs propagated in the browser with SGP4
   (satellite.js). TLEs come from data/tles.json (refreshed by the
   GitHub Action, so CelesTrak sees one fetch per 6 h instead of one per
   visitor); if that file is missing the browser asks CelesTrak directly.
   Groups: space stations, the brightest "visual" satellites, GPS.
   ===================================================================== */
const TLE_GROUPS = { stations: "#00e5ff", visual: "#9dffb0", "gps-ops": "#d98cff" };
const TLE_CACHE_KEY = "gm:tles:v1";
const TLE_TTL_MS = 6 * 3600 * 1000;
const EARTH_R_KM = 6371;
const sats = { list: [], points: [], updated: 0, iss: null, issTrack: [], error: null };
function parseTLE(text, group) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim(), l1 = lines[i + 1], l2 = lines[i + 2];
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) { i -= 2; continue; }
    try {
      const satrec = satellite.twoline2satrec(l1, l2);
      out.push({ name, norad: parseInt(l1.slice(2, 7), 10), group, satrec, inc: parseFloat(l2.slice(8, 16)), period: 1440 / parseFloat(l2.slice(52, 63)) });
    } catch (_) { /* skip malformed */ }
  }
  return out;
}
async function fetchTLEs() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(TLE_CACHE_KEY) || "null"); } catch (_) { /* ignore */ }
  if (cached && Date.now() - cached.at < TLE_TTL_MS) return cached;
  let data = null;
  try {
    const res = await fetch(`data/tles.json?cb=${Math.floor(Date.now() / 3600000)}`);
    if (res.ok) {
      const j = await res.json();
      if (j.groups && Object.keys(j.groups).length) data = { at: Date.parse(j.updated) || Date.now(), groups: j.groups, via: "action" };
    }
  } catch (_) { /* fall through */ }
  if (!data) {
    const groups = {};
    for (const g of Object.keys(TLE_GROUPS)) {
      try {
        const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`);
        if (res.ok) groups[g] = await res.text();
      } catch (_) { /* group unavailable */ }
    }
    if (Object.keys(groups).length) data = { at: Date.now(), groups, via: "celestrak" };
  }
  if (!data && cached) return cached;               // stale beats nothing
  if (data) { try { localStorage.setItem(TLE_CACHE_KEY, JSON.stringify(data)); } catch (_) { /* quota */ } }
  return data;
}
async function loadSats() {
  if (typeof satellite === "undefined") { sats.error = "satellite.js not loaded"; sysReport("sats", false); return; }
  const data = await fetchTLEs();
  if (!data) { sats.error = "no TLE source reachable"; sysReport("sats", false); return; }
  const list = [];
  const seen = new Set();
  for (const [g, text] of Object.entries(data.groups)) {
    for (const s of parseTLE(text, g)) { if (!seen.has(s.norad)) { seen.add(s.norad); list.push(s); } }
  }
  const byNorad = new Map(sats.points.map((p) => [p.sat.norad, p]));
  sats.list = list;
  sats.points = list.map((s) => {
    const p = byNorad.get(s.norad) ?? { lat: 0, lng: 0, size: 0.05, r: 0.22, color: TLE_GROUPS[s.group] ?? "#fff",
      __track: { kind: "sat", id: s.norad }, trail: [], label: null };
    p.sat = s; p.altKm = 0; p.velKmS = 0;
    p.label = () => `<b>🛰 ${esc(s.name)}</b><br>${s.group === "stations" ? "space station" : s.group === "gps-ops" ? "GPS constellation" : "bright satellite"}` +
      `<br>${Math.round(p.altKm).toLocaleString()} km · ${p.velKmS.toFixed(2)} km/s · inc ${s.inc.toFixed(1)}°<br><i>NORAD ${s.norad} · click to track</i>`;
    return p;
  });
  sats.iss = sats.points.find((p) => /ISS \(ZARYA\)/i.test(p.sat.name)) ?? sats.points.find((p) => /^ISS/i.test(p.sat.name)) ?? null;
  sats.updated = data.at;
  propagateSats(new Date());
  buildIssTrack();
  updateIssPass();
  sysReport("sats", true);
  if (OVL.sats) refreshGlobe();
}
function geodetic(satrec, date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv.position || typeof pv.position !== "object") return null;
  const gmst = satellite.gstime(date);
  const g = satellite.eciToGeodetic(pv.position, gmst);
  const v = pv.velocity;
  return { lat: satellite.degreesLat(g.latitude), lng: satellite.degreesLong(g.longitude), alt: g.height,
           vel: v ? Math.hypot(v.x, v.y, v.z) : 0 };
}
function propagateSats(date) {
  for (const p of sats.points) {
    const g = geodetic(p.sat.satrec, date);
    if (!g || !isFinite(g.lat)) continue;
    p.lat = g.lat; p.lng = g.lng; p.altKm = g.alt; p.velKmS = g.vel;
    p.size = Math.max(0.02, Math.min(g.alt / EARTH_R_KM, 0.35));   // true scale to ~2,200 km, compressed above (GPS/MEO)
  }
}
/* ISS ground track: 20 min behind to 90 min ahead, one point per minute */
function buildIssTrack() {
  sats.issTrack = [];
  if (!sats.iss) return;
  const now = Date.now();
  let seg = [];
  for (let m = -20; m <= 90; m += 1) {
    const g = geodetic(sats.iss.sat.satrec, new Date(now + m * 60000));
    if (!g) continue;
    if (seg.length && Math.abs(g.lng - seg[seg.length - 1][1]) > 180) { sats.issTrack.push(seg); seg = []; }   // split at antimeridian
    seg.push([g.lat, g.lng]);
  }
  if (seg.length > 1) sats.issTrack.push(seg);
}

/* ---- ISS pass predictor (observer location from geolocation or typed lat,lng) ---- */
const OBS_KEY = "gm:observer:v1";
let observer = null;
try { observer = JSON.parse(localStorage.getItem(OBS_KEY) || "null"); } catch (_) { /* ignore */ }
function compass(deg) { return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
function findPasses(satrec, obs, hours = 48, minEl = 10) {
  const obsGd = { latitude: satellite.degreesToRadians(obs.lat), longitude: satellite.degreesToRadians(obs.lng), height: 0.05 };
  const passes = [];
  let cur = null;
  const stepMs = 20000;
  const end = Date.now() + hours * 3600000;
  for (let t = Date.now(); t < end; t += stepMs) {
    const date = new Date(t);
    const pv = satellite.propagate(satrec, date);
    if (!pv.position || typeof pv.position !== "object") break;
    const ecf = satellite.eciToEcf(pv.position, satellite.gstime(date));
    const la = satellite.ecfToLookAngles(obsGd, ecf);
    const el = satellite.radiansToDegrees(la.elevation), az = satellite.radiansToDegrees(la.azimuth);
    if (el > 0) {
      if (!cur) cur = { start: t, riseAz: az, maxEl: el, maxAt: t, setAz: az };
      if (el > cur.maxEl) { cur.maxEl = el; cur.maxAt = t; }
      cur.setAz = az; cur.end = t;
    } else if (cur) {
      if (cur.maxEl >= minEl) passes.push(cur);
      cur = null;
      if (passes.length >= 5) break;
    }
  }
  return passes;
}
/* Is the observer in darkness while the ISS is sunlit? (naive: sun elevation < -6°) */
function sunElevation(lat, lng, date) {
  const d = (date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5;
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (d + 10)) * Math.PI / 180;
  const solarTime = ((date.getUTCHours() + date.getUTCMinutes() / 60) + lng / 15 + 24) % 24;
  const ha = (solarTime - 12) * 15 * Math.PI / 180;
  const la = lat * Math.PI / 180;
  return Math.asin(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha)) * 180 / Math.PI;
}
function updateIssPass() {
  const el = $("iss-pass");
  if (!el) return;
  if (!sats.iss) { el.innerHTML = `<span class="iss-dim">ISS elements unavailable</span>`; return; }
  if (!observer) { el.innerHTML = `<span class="iss-dim">set a location to predict the next pass</span>`; return; }
  const passes = findPasses(sats.iss.sat.satrec, observer);
  if (!passes.length) { el.innerHTML = `<span class="iss-dim">no pass above 10° in the next 48 h</span>`; return; }
  const p = passes[0];
  const visible = sunElevation(observer.lat, observer.lng, new Date(p.maxAt)) < -6;
  const fmt = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const inMin = Math.round((p.start - Date.now()) / 60000);
  el.innerHTML =
    `<span class="iss-when">${fmt(p.start)}</span><span class="iss-in">in ${inMin < 60 ? inMin + " min" : (inMin / 60).toFixed(1) + " h"}</span>` +
    `<span class="iss-detail">rises ${compass(p.riseAz)} · peak ${Math.round(p.maxEl)}° · sets ${compass(p.setAz)} · ${Math.round((p.end - p.start) / 60000)} min` +
    ` · ${visible ? "<b class='iss-vis'>VISIBLE (dark sky)</b>" : "daylight / not naked-eye"}</span>` +
    `<span class="iss-obs">observer ${observer.lat.toFixed(2)}, ${observer.lng.toFixed(2)}${observer.name ? " · " + esc(observer.name) : ""}</span>`;
}
function setObserver(lat, lng, name) {
  observer = { lat, lng, name: name || "" };
  try { localStorage.setItem(OBS_KEY, JSON.stringify(observer)); } catch (_) { /* ignore */ }
  updateIssPass();
}
function initIssPassUI() {
  const geoBtn = $("iss-geo"), form = $("iss-form"), input = $("iss-input");
  if (geoBtn) geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) { $("iss-pass").textContent = "geolocation not available in this browser"; return; }
    geoBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { geoBtn.disabled = false; setObserver(+pos.coords.latitude.toFixed(3), +pos.coords.longitude.toFixed(3), "my location"); },
      () => { geoBtn.disabled = false; $("iss-pass").innerHTML = `<span class="iss-dim">location denied — type lat, lng instead</span>`; },
      { timeout: 10000, maximumAge: 600000 });
  });
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const m = String(input.value).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) { $("iss-pass").innerHTML = `<span class="iss-dim">enter as "lat, lng" e.g. 32.78, -96.80</span>`; return; }
    setObserver(parseFloat(m[1]), parseFloat(m[2]), "");
    input.value = "";
  });
  updateIssPass();
}

/* =====================================================================
   STATIC INFRASTRUCTURE — submarine cables (TeleGeography, CC BY-NC-SA)
   and data centers (OpenStreetMap, ODbL). Loaded lazily on first toggle.
   ===================================================================== */
const infra = { cables: null, dc: null, cablePaths: [], landingPoints: [], dcPoints: [] };
async function ensureCables() {
  if (infra.cables) return infra.cables;
  const res = await fetch("data/cables.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  infra.cables = await res.json();
  infra.cablePaths = [];
  for (const c of infra.cables.cables)
    for (const seg of c.s) infra.cablePaths.push({ pts: seg.map(([lng, lat]) => [lat, lng]), color: c.c, name: c.n, __cable: true });
  infra.landingPoints = infra.cables.landings.map((l) => ({
    lat: l.lat, lng: l.lng, size: 0.002, r: 0.12, color: "#5ec8ff",
    label: `<b>⚓ ${esc(l.n)}</b><br><i>cable landing point</i>`,
  }));
  return infra.cables;
}
async function ensureDatacenters() {
  if (infra.dc) return infra.dc;
  const res = await fetch("data/datacenters.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  infra.dc = await res.json();
  infra.dcPoints = infra.dc.dc.map((d) => ({
    lat: d.lat, lng: d.lng, size: 0.004, r: 0.14, color: "#ff6ec7",
    label: `<b>▣ ${esc(d.n)}</b>${d.o ? `<br>${esc(d.o)}` : ""}<br><i>data center · OpenStreetMap</i>`,
  }));
  return infra.dc;
}

/* =====================================================================
   CLICK-TO-TRACK — click an aircraft, satellite or tanker on the globe:
   the camera locks on, a trail draws behind it and a telemetry card opens.
   Esc, the card's × or clicking empty globe releases the lock.
   ===================================================================== */
const track = { target: null, kind: null, alt: null };
function trackedPoint() {
  if (!track.target) return null;
  if (track.kind === "air") return milAir.byHex.get(track.target.__track.id) ?? null;
  if (track.kind === "sat") return sats.points.find((p) => p.sat.norad === track.target.__track.id) ?? null;
  if (track.kind === "ship") return (shipData.ships ?? []).find((s) => s.mmsi === track.target.__track.id) ?? null;
  return null;
}
function startTrack(point) {
  if (!point?.__track || !globeInstance) return;
  track.target = point; track.kind = point.__track.kind;
  globeInstance.controls().autoRotate = false;
  const pov = globeInstance.pointOfView();
  track.alt = Math.min(pov.altitude, track.kind === "sat" ? 1.6 : 0.6);
  globeInstance.pointOfView({ lat: point.lat, lng: point.lng, altitude: track.alt }, 900);
  $("track-card").hidden = false;
  document.body.classList.add("tracking");
  renderTrackCard();
  refreshGlobe();
}
function stopTrack() {
  if (!track.target) return;
  track.target = null; track.kind = null;
  $("track-card").hidden = true;
  document.body.classList.remove("tracking");
  if (globeInstance) globeInstance.controls().autoRotate = true;
  refreshGlobe();
}
function followTrack() {
  const p = trackedPoint();
  if (!p || !globeInstance) { if (track.target) { $("track-status").textContent = "CONTACT LOST"; } return; }
  const pov = globeInstance.pointOfView();
  track.alt = pov.altitude;   // user may zoom while locked; keep their altitude
  globeInstance.pointOfView({ lat: p.lat, lng: p.lng, altitude: pov.altitude }, 0);
  renderTrackCard();
}
function row(k, v) { return `<div class="tk-row"><span>${k}</span><b>${v}</b></div>`; }
function renderTrackCard() {
  const card = $("track-card");
  if (!card || !track.target) return;
  const p = trackedPoint();
  const k = track.kind;
  let title = "", sub = "", rows = "";
  if (k === "air") {
    const a = p?.ac ?? track.target.ac;
    title = a.flight || a.r || a.hex; sub = `${a.t || "MIL"} · ${a.desc || "military transponder"}`;
    rows = row("ALT", fmtAlt(a.alt)) + row("GS", a.gs != null ? `${Math.round(a.gs)} kn` : "—") +
      row("HDG", a.track != null ? `${Math.round(a.track)}° ${compass(a.track)}` : "—") +
      row("REG", a.r || "—") + row("HEX", a.hex) + row("SQK", a.squawk || "—") +
      (a.ownOp ? row("OPR", esc(a.ownOp)) : "") +
      row("POS", p ? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}` : "—") +
      row("FIX", ago(a.seenAt) || "now");
  } else if (k === "sat") {
    const s = p?.sat ?? track.target.sat;
    title = s.name; sub = s.group === "stations" ? "SPACE STATION" : s.group === "gps-ops" ? "GPS CONSTELLATION" : "BRIGHT SATELLITE";
    rows = row("ALT", p ? `${Math.round(p.altKm).toLocaleString()} km` : "—") + row("VEL", p ? `${p.velKmS.toFixed(2)} km/s` : "—") +
      row("INC", `${s.inc.toFixed(2)}°`) + row("PERIOD", `${s.period.toFixed(1)} min`) + row("NORAD", s.norad) +
      row("SUBPT", p ? `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}` : "—") + row("TLE", ago(sats.updated) || "—");
  } else if (k === "ship") {
    const s = p ?? track.target.ship;
    title = s.name || `MMSI ${s.mmsi}`; sub = shipTypeName(s.t).toUpperCase();
    rows = row("SOG", s.sog != null ? `${s.sog.toFixed(1)} kn` : "—") + row("COG", s.cog != null ? `${Math.round(s.cog)}° ${compass(s.cog)}` : "—") +
      row("MMSI", s.mmsi) + row("POS", `${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}`) + row("SNAP", shipData.updated ? ago(Date.parse(shipData.updated)) : "—");
  }
  card.querySelector(".tk-title").textContent = title;
  card.querySelector(".tk-sub").textContent = sub;
  card.querySelector(".tk-rows").innerHTML = rows;
  $("track-status").textContent = p ? "TRACKING · LOCKED" : "CONTACT LOST";
}
function trackTrailPaths() {
  const p = trackedPoint();
  if (!p) return [];
  let pts = null, color = "#00e5ff";
  if (track.kind === "air") { pts = p.trail; color = "#ffd166"; }
  else if (track.kind === "sat") { pts = p.trail; color = p.color; }
  else if (track.kind === "ship") { pts = shipTrail(p); color = "#ff9e3d"; }
  if (!pts || pts.length < 2) return [];
  // split at the antimeridian so the trail never spans the globe
  const segs = []; let seg = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][1] - pts[i - 1][1]) > 180) { segs.push(seg); seg = []; }
    seg.push(pts[i]);
  }
  segs.push(seg);
  return segs.filter((s) => s.length > 1).map((s) => ({ pts: s, color, __trail: true }));
}
function initTracking() {
  $("track-close")?.addEventListener("click", stopTrack);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stopTrack();
    const t = e.target;
    if (t && (/TEXTAREA|SELECT/.test(t.tagName) || (t.tagName === "INPUT" && !/checkbox|radio|button/.test(t.type)))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-5]$/.test(e.key) && typeof Sensors !== "undefined") Sensors.set(Sensors.NAMES[+e.key - 1]);
  });
}

/* one 2 s tick drives satellite propagation, aircraft dead reckoning and the camera lock */
const TICK_MS = 2000;
let lastTick = Date.now();
let issTrackBuiltAt = 0;
function liveTick() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (document.hidden) return;
  let dirty = false;
  if (OVL.sats && sats.points.length) {
    propagateSats(new Date(now));
    if (now - issTrackBuiltAt > 60000) { buildIssTrack(); issTrackBuiltAt = now; }
    if (track.kind === "sat") { const p = trackedPoint(); if (p) { p.trail.push([p.lat, p.lng]); if (p.trail.length > 240) p.trail.shift(); } }
    dirty = true;
  }
  if (OVL.milair && milAir.points.length) {
    deadReckonMilAir(dt); dirty = true;
    if (track.kind === "air") { const p = trackedPoint(); if (p?.ac.gs > 30) { p.trail.push([p.lat, p.lng]); if (p.trail.length > 400) p.trail.shift(); } }
  }
  if (dirty && globeInstance && !$("globe").hidden) refreshGlobe();
  if (track.target) followTrack();
}
let tensionPlaces = [];
async function loadTension() {
  try {
    const res = await fetch(`data/tension.json?cb=${Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tensionPlaces = (await res.json()).places ?? [];
  } catch (e) {
    console.error("tension.json load failed:", e);
  }
}

/* ---------- tanker snapshot (data/shipping.json, refreshed by the Action) ---------- */
let shipData = { updated: null, note: null, ships: [] };
let shipTracks = {};
async function loadShips() {
  try {
    const res = await fetch(`data/shipping.json?cb=${Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    shipData = await res.json();
  } catch (e) {
    console.error("shipping.json load failed:", e);
  }
  try {
    const res = await fetch(`data/ship-tracks.json?cb=${Math.floor(Date.now() / 600000)}`);
    if (res.ok) shipTracks = await res.json();
  } catch { /* trails are optional */ }
}
/* dead-reckoning: project a position forward along course cog (deg) by sog knots for hrs hours */
function projectPos(lat, lng, cog, sog, hrs) {
  const distDeg = (sog * hrs) / 60; // nautical miles -> degrees latitude
  const rad = (cog * Math.PI) / 180;
  const dLat = distDeg * Math.cos(rad);
  const dLng = (distDeg * Math.sin(rad)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}
function shipTrail(s) {
  const hist = shipTracks[s.mmsi];
  if (!hist || hist.length < 1) return null;
  const pts = [...hist];
  const last = pts[pts.length - 1];
  if (!last || Math.abs(last[0] - s.lat) > 0.001 || Math.abs(last[1] - s.lng) > 0.001) pts.push([s.lat, s.lng]);
  return pts.length >= 2 ? pts : null;
}
function shipTypeName(t) {
  if (t === 84) return "LNG/LPG gas carrier";
  if (t >= 80 && t <= 89) return "Oil/chemical tanker";
  return "Tanker";
}

/* ---------- country polygons for the tension choropleth ---------- */
let countriesFeatures = null;
let countriesPromise = null;
function ensureCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((topo) => {
        countriesFeatures = topojson.feature(topo, topo.objects.countries).features;
      })
      .catch((e) => { console.error("country boundaries load failed:", e); countriesPromise = null; });
  }
  return countriesPromise;
}
/* Map geocoder place names (cities, regions) onto world-atlas country names.
   Places mapping to null (seas, straits, blocs) are left out of the choropleth. */
const PLACE_COUNTRY = {
  "Kyiv": "Ukraine", "Ukraine's": "Ukraine", "Moscow": "Russia", "Beijing": "China",
  "Hong Kong": "China", "Washington": "United States of America", "U.S.": "United States of America",
  "US": "United States of America", "United States": "United States of America",
  "New York": "United States of America", "California": "United States of America",
  "Texas": "United States of America", "Tehran": "Iran", "Gaza": "Palestine",
  "West Bank": "Palestine", "London": "United Kingdom", "UK": "United Kingdom",
  "Britain": "United Kingdom", "Paris": "France", "Berlin": "Germany", "Tokyo": "Japan",
  "Seoul": "South Korea", "Korea": "South Korea", "Brussels": "Belgium",
  "Congo": "Dem. Rep. Congo", "Czech": "Czechia", "Bosnia": "Bosnia and Herz.",
  "UAE": "United Arab Emirates", "Suez": "Egypt",
  "NATO": null, "European Union": null, "Red Sea": null, "South China Sea": null,
  "Black Sea": null, "Persian Gulf": null, "Strait of Hormuz": null, "Arctic": null,
};
function countryTension() {
  const byCountry = new Map();
  for (const p of tensionPlaces) {
    const key = p.place in PLACE_COUNTRY ? PLACE_COUNTRY[p.place] : p.place.trim();
    if (!key) continue;
    const cur = byCountry.get(key) ?? { raw: 0, count: 0 };
    cur.raw += p.raw ?? p.score * 10;  // older data files lack raw — approximate
    cur.count += p.count;
    byCountry.set(key, cur);
  }
  for (const c of byCountry.values()) {
    c.score = conflictIntensity(c.raw);
    c.tier = conflictTier(c.score);
  }
  return byCountry;
}
function tensionFeatures() {
  if (!countriesFeatures) return [];
  const byCountry = countryTension();
  const out = [];
  for (const f of countriesFeatures) {
    const t = byCountry.get(f.properties.name);
    if (t) out.push({ ...f, __t: { ...t, name: f.properties.name } });
  }
  return out;
}
function hexToRgba(hex, a) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
/* green (low) -> gold (mid) -> red (war) */
function tensionColor(s) {
  return s < 0.5 ? lerpHex("#35c98f", "#ffc65c", s * 2) : lerpHex("#ffc65c", "#e5484d", (s - 0.5) * 2);
}
/* Absolute conflict scale: raw = keyword-weighted headline volume over the
   trailing 30 days. WAR_RAW is the volume at which a country reads as an
   active war zone (full red). */
const WAR_RAW = 60;
function conflictIntensity(raw) { return Math.min(1, raw / WAR_RAW); }
function conflictTier(i) {
  if (i >= 0.75) return "ACTIVE CONFLICT / WAR";
  if (i >= 0.4) return "HIGH TENSION";
  if (i >= 0.15) return "ELEVATED";
  return "LOW";
}
const OVL_COLORS = { nuclear: "#ff4d6d", military: "#4d9fff", choke: "#d98cff" };
/* Operating country -> ISO flag code, from the base's country/operator label */
function operatorFlag(c) {
  if (c.includes("US weapons")) return "us";   // NATO-sharing sites: the weapons are US
  if (/^(US|United States)/.test(c)) return "us";
  if (/^United Kingdom/.test(c)) return "gb";
  if (/^France/.test(c)) return "fr";
  if (/^Russia/.test(c)) return "ru";
  if (/^China/.test(c)) return "cn";
  if (/^India/.test(c)) return "in";
  if (/^Cambodia/.test(c)) return "kh";
  if (/^Turkey/.test(c)) return "tr";
  if (/^Israel/.test(c)) return "il";
  if (/^North Korea/.test(c)) return "kp";
  if (/^Pakistan/.test(c)) return "pk";
  if (/^Italy/.test(c)) return "it";
  if (/^Germany/.test(c)) return "de";
  if (/^Belgium/.test(c)) return "be";
  if (/^Netherlands/.test(c)) return "nl";
  return null;
}
function overlayDefs() {
  const defs = [];
  if (OVL.ships) defs.push(...(shipData.ships ?? []).slice(0, 2000).map((s) => ({
    lat: s.lat, lng: s.lng, color: "#ff9e3d", r: 0.28, size: 0.02, __track: { kind: "ship", id: s.mmsi }, ship: s,
    label: `<b>⛴ ${esc(s.name)}</b><br>${shipTypeName(s.t)}` +
           `<br><i>${s.sog != null ? s.sog.toFixed(1) + " kn · " : ""}snapshot ${shipData.updated ? ago(Date.parse(shipData.updated)) : ""}</i>`,
  })));
  if (OVL.nuclear) defs.push(...NUCLEAR_SITES.map((s) => ({
    lat: s.lat, lng: s.lng, color: OVL_COLORS.nuclear, r: 0.5, size: 0.05,
    label: `<b>☢ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>publicly reported, approximate</i>`,
  })));
  if (OVL.military) defs.push(...MILITARY_BASES.map((s) => ({
    lat: s.lat, lng: s.lng, color: OVL_COLORS.military, r: 0.5, size: 0.05,
    label: `<b>▲ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>major base, curated list</i>`,
  })));
  if (OVL.choke) defs.push(...CHOKE_POINTS.map((s) => ({
    lat: s.lat, lng: s.lng, color: OVL_COLORS.choke, r: 0.6, size: 0.06,
    label: `<b>⬖ ${esc(s.n)}</b><br>${esc(s.note)}`,
  })));
  return defs;
}

/* ---------- globe ---------- */
let globeInstance = null;
function globePoints() {
  return [
    ...(OVL.news ? newsEvents.map((e) => ({
      lat: e.lat, lng: e.lng, size: 0.45, r: 0.55, color: "#00e5ff",
      label: `<b>${esc(e.place)}</b><br>${esc(e.t)}<br><i>${esc(e.s)}</i>`,
    })) : []),
    ...(OVL.quakes ? quakePoints.map((q) => ({
      lat: q.lat, lng: q.lng, size: Math.max(0.25, (q.mag ?? 3) / 10), r: 0.55, color: "#ffc65c",
      label: `<b>M${q.mag?.toFixed(1)}</b> ${esc(q.place ?? "")}<br><i>${ago(q.time)}</i>`,
    })) : []),
    ...overlayDefs(),
    ...(OVL.milair ? milAir.points : []),
    ...(OVL.sats ? sats.points : []),
    ...(OVL.cables ? infra.landingPoints : []),
    ...(OVL.dc ? infra.dcPoints : []),
  ];
}
function shipPaths() {
  if (!OVL.ships) return [];
  const paths = [];
  for (const s of shipData.ships ?? []) {
    const pts = shipTrail(s);
    if (pts) paths.push({ pts });
    if (paths.length >= 600) break;
  }
  return paths;
}
function refreshGlobe() {
  if (!globeInstance) return;
  globeInstance.pointsData(globePoints());
  globeInstance.polygonsData(OVL.tension ? tensionFeatures() : []);
  globeInstance.pathsData([
    ...shipPaths(),
    ...(OVL.cables ? infra.cablePaths : []),
    ...(OVL.sats ? sats.issTrack.map((pts) => ({ pts, color: "rgba(0,229,255,0.55)", __iss: true })) : []),
    ...trackTrailPaths(),
  ]);
}
function initGlobe() {
  const el = $("globe");
  if (typeof Globe !== "function") {
    el.innerHTML = `<div class="globe-fallback">3D globe library could not be loaded.<br>Check your connection and reload.</div>`;
    return;
  }
  const globe = Globe({ rendererConfig: { preserveDrawingBuffer: true, antialias: true } })(el)
    .globeImageUrl("https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png")
    .backgroundColor("#020a12")
    .atmosphereColor("#00e5ff")
    .atmosphereAltitude(0.18)
    .pointsData(globePoints())
    .pointAltitude("size")
    .pointColor("color")
    .pointRadius("r")
    .pointLabel("label")
    .polygonsData([])
    .polygonAltitude(0.012)
    .polygonCapColor((d) => hexToRgba(tensionColor(d.__t.score), 0.55))
    .polygonSideColor(() => "rgba(0, 229, 255, 0.06)")
    .polygonStrokeColor(() => "#0b2a38")
    .pathsData([])
    .pathPoints("pts")
    .pathPointAlt((d) => d.__iss ? 0.065 : d.__trail && track.kind === "sat" ? 0.06 : d.__trail && track.kind === "air" ? 0.012 : 0.002)
    .pathColor((d) => d.__trail ? d.color : d.__cable ? d.color : d.__iss ? d.color : "rgba(255, 158, 61, 0.5)")
    .pathStroke((d) => d.__trail ? 2.2 : d.__cable ? 0.9 : d.__iss ? 1.6 : 1.5)
    .pathLabel((d) => d.__cable ? `<b>⌇ ${esc(d.name)}</b><br><i>submarine cable · TeleGeography</i>` : d.__iss ? "<b>ISS ground track</b><br><i>−20 min → +90 min</i>" : "")
    .pathTransitionDuration(0)
    .pointsTransitionDuration(0)
    .onPointClick((d) => { if (d?.__track) startTrack(d); })
    .onGlobeClick(() => stopTrack())
    .polygonLabel((d) =>
      `<b>${esc(d.__t.name)}</b><br>Conflict level: ${d.__t.tier} (${(d.__t.score * 100).toFixed(0)}/100)` +
      `<br><i>${d.__t.count} conflict-related headline${d.__t.count === 1 ? "" : "s"}, trailing 30 days</i>`)
    .width(el.clientWidth)
    .height(el.clientHeight);
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.55;
  globe.pointOfView({ lat: 25, lng: 10, altitude: 2.1 });
  window.addEventListener("resize", () => {
    if (!el.hidden) globe.width(el.clientWidth).height(el.clientHeight);
  });
  globeInstance = globe;
  // sensor post-processing reads the globe's canvas each frame
  const fx = $("sensor-fx");
  if (fx && typeof Sensors !== "undefined") {
    const ok = Sensors.init(fx, () => el.querySelector("canvas"));
    if (ok) { Sensors.restore(); initSensorBar(); }
    else document.querySelector(".sensor-bar")?.setAttribute("hidden", "");
  }
}
function initSensorBar() {
  document.querySelectorAll(".sensor-bar [data-sensor]").forEach((b) =>
    b.addEventListener("click", () => Sensors.set(b.dataset.sensor)));
}

/* ---------- flat satellite map (Leaflet + Esri imagery + RainViewer live layers) ----------
   Lazily initialized the first time the user picks "Satellite Flat Map" in the
   view dropdown, since Leaflet needs a visible container to size itself. */
let satMapInstance = null;
function initSatMap() {
  if (satMapInstance) return satMapInstance;
  const el = $("satmap");
  if (typeof L === "undefined") {
    el.innerHTML = `<div class="globe-fallback">Map library could not be loaded.<br>Check your connection and reload.</div>`;
    return null;
  }
  const map = L.map(el, { worldCopyJump: true, minZoom: 2, zoomControl: true, preferCanvas: true })
    .setView([25, 10], 2);

  const imagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Imagery © Esri, Maxar, Earthstar Geographics", maxZoom: 17 }
  ).addTo(map);
  const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Labels © Esri", maxZoom: 17, opacity: 0.85 }
  ).addTo(map);

  // Marker layers — visibility is driven by the legend toggles
  satLayers.news = L.layerGroup(newsEvents.map((e) =>
    L.circleMarker([e.lat, e.lng], {
      radius: 6, color: "#00e5ff", weight: 1.5, fillColor: "#00e5ff", fillOpacity: 0.5,
    }).bindPopup(`<b>${esc(e.place)}</b><br>${esc(e.t)}<br><i>${esc(e.s)}</i>`)
  ));
  satLayers.quakes = L.layerGroup(quakePoints.map((q) =>
    L.circleMarker([q.lat, q.lng], {
      radius: Math.max(4, (q.mag ?? 3) * 1.6), color: "#ffc65c", weight: 1.5,
      fillColor: "#ffc65c", fillOpacity: 0.45,
    }).bindPopup(`<b>M${q.mag?.toFixed(1)}</b> ${esc(q.place ?? "")}<br>` +
      `<a href="${esc(q.url)}" target="_blank" rel="noopener">USGS detail</a> · ${ago(q.time)}`)
  ));

  const control = L.control.layers({}, {}, { collapsed: true }).addTo(map);

  // Near-live layers from RainViewer (updated ~every 10 minutes)
  fetch("https://api.rainviewer.com/public/weather-maps.json")
    .then((r) => r.json())
    .then((wm) => {
      const host = wm.host || "https://tilecache.rainviewer.com";
      const sat = wm.satellite?.infrared?.at(-1);
      const radar = wm.radar?.past?.at(-1);
      if (sat) {
        const irLayer = L.tileLayer(`${host}${sat.path}/256/{z}/{x}/{y}/0/0_0.png`,
          { opacity: 0.65, attribution: "Clouds © RainViewer" }).addTo(map);
        control.addOverlay(irLayer, "IR satellite clouds (live)");
      }
      if (radar) {
        const radarLayer = L.tileLayer(`${host}${radar.path}/256/{z}/{x}/{y}/2/1_1.png`,
          { opacity: 0.7, attribution: "Radar © RainViewer" });
        control.addOverlay(radarLayer, "Precipitation radar (live)");
      }
    })
    .catch((e) => console.error("RainViewer load failed:", e));

  // Toggleable overlay layers (driven by the legend checkboxes)
  satLayers.nuclear = L.layerGroup(NUCLEAR_SITES.map((s) => {
    const code = operatorFlag(s.c);
    const popup = `<b>☢ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>publicly reported, approximate</i>`;
    if (code) {
      return L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: "flag-icon flag-nuclear",
          html: `<img src="https://flagcdn.com/w40/${code}.png" alt="${esc(s.c)}">`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        }),
      }).bindPopup(popup);
    }
    return L.circleMarker([s.lat, s.lng], {
      radius: 5, color: OVL_COLORS.nuclear, weight: 1.5, fillColor: OVL_COLORS.nuclear, fillOpacity: 0.55,
    }).bindPopup(popup);
  }));
  satLayers.military = L.layerGroup(MILITARY_BASES.map((s) => {
    const code = operatorFlag(s.c);
    const popup = `<b>▲ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>major base, curated list</i>`;
    if (code) {
      return L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: "flag-icon",
          html: `<img src="https://flagcdn.com/w40/${code}.png" alt="${esc(s.c)}">`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        }),
      }).bindPopup(popup);
    }
    return L.circleMarker([s.lat, s.lng], {
      radius: 5, color: OVL_COLORS.military, weight: 1.5, fillColor: OVL_COLORS.military, fillOpacity: 0.55,
    }).bindPopup(popup);
  }));
  satLayers.choke = L.layerGroup(CHOKE_POINTS.map((s) =>
    L.circleMarker([s.lat, s.lng], {
      radius: 7, color: OVL_COLORS.choke, weight: 1.5, fillColor: OVL_COLORS.choke, fillOpacity: 0.5,
    }).bindPopup(`<b>⬖ ${esc(s.n)}</b><br>${esc(s.note)}`)
  ));

  // re-render ships / aircraft at the right detail level as the user pans/zooms
  let shipRedraw = null;
  map.on("zoomend moveend", () => {
    clearTimeout(shipRedraw);
    shipRedraw = setTimeout(() => {
      if (OVL.ships && satLayers.ships) renderShipsInto(satLayers.ships);
      if (OVL.milair && satLayers.milair) renderMilAirInto(satLayers.milair);
    }, 150);
  });

  satMapInstance = map;
  applyMapOverlays();
  return map;
}

const satLayers = {};
/* Leaflet draws polygons that cross the 180° antimeridian (Russia, Fiji) as a
   band across the whole map. Shift such rings into the 0..360 range so they
   wrap correctly. The globe view needs no fix. */
function unwrapAntimeridian(feature) {
  const fixRing = (ring) => {
    const lngs = ring.map((c) => c[0]);
    if (Math.max(...lngs) - Math.min(...lngs) > 180) {
      return ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]);
    }
    return ring;
  };
  const g = feature.geometry;
  let geom = g;
  if (g?.type === "Polygon") geom = { type: "Polygon", coordinates: g.coordinates.map(fixRing) };
  else if (g?.type === "MultiPolygon") geom = { type: "MultiPolygon", coordinates: g.coordinates.map((poly) => poly.map(fixRing)) };
  return { ...feature, geometry: geom };
}
function buildMapTension() {
  return L.geoJSON(tensionFeatures().map(unwrapAntimeridian), {
    style: (f) => ({
      color: "#0b2a38", weight: 1,
      fillColor: tensionColor(f.__t.score), fillOpacity: 0.5,
    }),
    onEachFeature: (f, layer) => layer.bindPopup(
      `<b>${esc(f.__t.name)}</b><br>Conflict level: ${f.__t.tier} (${(f.__t.score * 100).toFixed(0)}/100)` +
      `<br><i>${f.__t.count} conflict-related headline${f.__t.count === 1 ? "" : "s"}, trailing 30 days</i>`),
  });
}
function shipDivIcon(cog) {
  return L.divIcon({
    className: "ship-icon",
    html: `<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(${Math.round(cog ?? 0)}deg)">` +
      `<path d="M12 1 L17 10 L17 18 L12 23 L7 18 L7 10 Z" fill="#ff9e3d" stroke="#3d2506" stroke-width="1.5"/></svg>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
}
/* Ships render adaptively: thousands of tankers as fast canvas dots when
   zoomed out; full ship icons + trails + projections for the visible area
   once zoomed in. Rebuilt on pan/zoom while the layer is on. */
const SHIP_ICON_ZOOM = 5;      // zoom level where dots become icons
const SHIP_ICON_MAX = 400;     // max detailed ships drawn at once
function shipPopup(s) {
  return `<b>⛴ ${esc(s.name)}</b><br>${shipTypeName(s.t)}` +
    `${s.sog != null ? `<br>${s.sog.toFixed(1)} kn${s.cog != null ? ` · course ${Math.round(s.cog)}°` : ""}` : ""}` +
    `<br><i>snapshot ${shipData.updated ? ago(Date.parse(shipData.updated)) : ""}</i>`;
}
function renderShipsInto(group) {
  group.clearLayers();
  const map = satMapInstance;
  if (!map) return;
  const ships = shipData.ships ?? [];
  if (map.getZoom() < SHIP_ICON_ZOOM) {
    // overview: lightweight canvas dots (handles thousands smoothly)
    for (const s of ships) {
      group.addLayer(L.circleMarker([s.lat, s.lng], {
        radius: 2.5, color: "#ff9e3d", weight: 1, fillColor: "#ff9e3d", fillOpacity: 0.75,
      }).bindPopup(shipPopup(s)));
    }
  } else {
    // zoomed in: icons, trails, and projections for what's on screen
    const bounds = map.getBounds().pad(0.25);
    let n = 0;
    for (const s of ships) {
      if (!bounds.contains([s.lat, s.lng])) continue;
      if (++n > SHIP_ICON_MAX) break;
      const trail = shipTrail(s);
      if (trail) group.addLayer(L.polyline(trail, { color: "#ff9e3d", weight: 1.5, opacity: 0.45 }));
      if (s.cog != null && s.sog > 1) {
        group.addLayer(L.polyline([[s.lat, s.lng], projectPos(s.lat, s.lng, s.cog, s.sog, 2)],
          { color: "#ff9e3d", weight: 1.5, opacity: 0.8, dashArray: "3 5" }));
      }
      group.addLayer(L.marker([s.lat, s.lng], { icon: shipDivIcon(s.cog) }).bindPopup(shipPopup(s)));
    }
  }
}
function buildMapShips() {
  const group = L.layerGroup();
  renderShipsInto(group);
  return group;
}
function buildMapCables() {
  const group = L.layerGroup();
  for (const p of infra.cablePaths)
    group.addLayer(L.polyline(p.pts, { color: p.color, weight: 1.2, opacity: 0.7 }).bindPopup(`<b>⌇ ${esc(p.name)}</b><br><i>submarine cable · © TeleGeography</i>`));
  for (const l of infra.landingPoints)
    group.addLayer(L.circleMarker([l.lat, l.lng], { radius: 2.5, color: "#5ec8ff", weight: 1, fillColor: "#5ec8ff", fillOpacity: 0.8 }).bindPopup(l.label));
  return group;
}
function buildMapDatacenters() {
  const group = L.layerGroup();
  for (const d of infra.dcPoints)
    group.addLayer(L.circleMarker([d.lat, d.lng], { radius: 3, color: "#ff6ec7", weight: 1, fillColor: "#ff6ec7", fillOpacity: 0.6 }).bindPopup(d.label));
  return group;
}
function buildMapMilAir() {
  const group = L.layerGroup();
  renderMilAirInto(group);
  return group;
}
function applyMapOverlays() {
  if (!satMapInstance) return;
  if (OVL.tension && !satLayers.tension && countriesFeatures) satLayers.tension = buildMapTension();
  if (OVL.ships && !satLayers.ships && shipData.ships?.length) satLayers.ships = buildMapShips();
  if (OVL.milair && !satLayers.milair && milAir.points.length) satLayers.milair = buildMapMilAir();
  if (OVL.cables && !satLayers.cables && infra.cablePaths.length) satLayers.cables = buildMapCables();
  if (OVL.dc && !satLayers.dc && infra.dcPoints.length) satLayers.dc = buildMapDatacenters();
  for (const key of OVL_KEYS) {
    const layer = satLayers[key];
    if (!layer) continue;
    if (OVL[key]) layer.addTo(satMapInstance);
    else satMapInstance.removeLayer(layer);
  }
}

/* ---------- overlay toggle wiring ---------- */
function initOverlayToggles() {
  for (const key of OVL_KEYS) {
    const box = $(`tog-${key}`);
    if (!box) continue;
    box.addEventListener("change", async () => {
      OVL[key] = box.checked;
      if (key === "milair" && box.checked) {
        if (!milAir.points.length || Date.now() - milAir.updated > MILAIR_POLL_MS * 2) await loadMilAir();
        $("view-note").textContent = milAir.points.length
          ? `${milAir.points.length} military aircraft · live ADS-B · ${ago(milAir.updated)}`
          : "military aircraft feed unavailable right now";
      }
      if (key === "sats" && box.checked) {
        if (!sats.points.length) await loadSats();
        $("view-note").textContent = sats.points.length
          ? `${sats.points.length} satellites · SGP4 · TLEs ${ago(sats.updated)}`
          : `satellites unavailable · ${sats.error ?? ""}`;
        satLayers.sats = null; // globe only; flat map shows no satellites
      }
      if (key === "cables" && box.checked) {
        try { await ensureCables(); $("view-note").textContent = `${infra.cables.cables.length} submarine cables · ${infra.landingPoints.length} landings · © TeleGeography`; }
        catch (e) { console.error(e); $("view-note").textContent = "cable data failed to load"; }
      }
      if (key === "dc" && box.checked) {
        try { await ensureDatacenters(); $("view-note").textContent = `${infra.dcPoints.length} data centers · OpenStreetMap`; }
        catch (e) { console.error(e); $("view-note").textContent = "data center data failed to load"; }
      }
      if (!box.checked && track.kind && ((key === "milair" && track.kind === "air") || (key === "sats" && track.kind === "sat") || (key === "ships" && track.kind === "ship"))) stopTrack();
      if (key === "tension") {
        $("tension-scale").hidden = !box.checked;
        if (box.checked) await ensureCountries();
      }
      if (key === "ships" && box.checked) {
        if (!(shipData.ships?.length)) {
          $("view-note").textContent = shipData.note === "no-key"
            ? "tanker layer needs a free AISSTREAM_KEY — see README"
            : "no tanker snapshot yet — appears after the next data refresh";
        } else {
          $("view-note").textContent = `${shipData.ships.length} tankers · zoom in for ship icons & trails`;
        }
      }
      refreshGlobe();
      applyMapOverlays();
    });
  }
}

/* ---------- view switcher (Orbital View <-> Satellite Flat Map) ---------- */
function initViewSwitcher() {
  const sel = $("view-select");
  if (!sel) return;
  sel.addEventListener("change", () => {
    const showMap = sel.value === "satmap";
    const globeEl = $("globe"), mapEl = $("satmap");
    globeEl.hidden = showMap;
    mapEl.hidden = !showMap;
    $("view-note").textContent = showMap
      ? "Esri imagery · IR clouds & radar ~10 min refresh"
      : "news events · earthquakes M2.5+ (24h)";
    $("view-hint").textContent = showMap
      ? "layers toggle top-right · click markers for detail"
      : "drag to rotate · scroll to zoom · hover for detail";
    if (showMap) {
      const m = initSatMap();
      if (m) setTimeout(() => m.invalidateSize(), 60);
    } else if (globeInstance) {
      globeInstance.width(globeEl.clientWidth).height(globeEl.clientHeight);
    }
  });
}

/* ---------- boot ---------- */
(async function boot() {
  await Promise.allSettled([loadNews(), loadQuakes(), loadTension(), loadShips()]);
  initGlobe();
  initViewSwitcher();
  initTabs();
  initOverlayToggles();
  initTracking();
  initIssPassUI();
  loadMilAir();
  loadSats();
  setInterval(loadMilAir, MILAIR_POLL_MS);
  setInterval(loadSats, TLE_TTL_MS);
  setInterval(updateIssPass, 10 * 60 * 1000);
  setInterval(liveTick, TICK_MS);
  loadMarkets();
  loadCrypto();
  loadFX();
  loadKp();
  // periodic refresh while the tab stays open
  setInterval(loadNews, 10 * 60 * 1000);
  setInterval(loadQuakes, 10 * 60 * 1000);
  setInterval(loadMarkets, 10 * 60 * 1000);
  setInterval(async () => {
    await Promise.allSettled([loadTension(), loadShips()]);
    for (const key of ["tension", "ships", "milair"]) {   // rebuild these from fresh data
      if (satLayers[key] && satMapInstance) satMapInstance.removeLayer(satLayers[key]);
      satLayers[key] = null;
    }
    refreshGlobe();
    applyMapOverlays();
  }, 10 * 60 * 1000);
  setInterval(loadCrypto, 5 * 60 * 1000);
  setInterval(loadKp, 15 * 60 * 1000);
})();
