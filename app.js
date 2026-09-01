/* GLOBAL MONITOR — client logic
 * News comes from data/news.json (refreshed by GitHub Actions every 30 min).
 * Quakes, crypto, FX, and space weather are fetched live from open CORS APIs.
 */
"use strict";

const $ = (id) => document.getElementById(id);

/* ---------- system status readout ---------- */
const SYS = { news: null, quakes: null, markets: null, crypto: null, fx: null, kp: null };
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

/* ---------- overlays: news, quakes, tankers, tension, nuclear, military, choke ---------- */
const OVL = { news: true, quakes: true, ships: false, tension: false, nuclear: false, military: false, choke: false };
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
  if (OVL.ships) defs.push(...(shipData.ships ?? []).map((s) => ({
    lat: s.lat, lng: s.lng, color: "#ff9e3d", r: 0.28, size: 0.02,
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
  ];
}
function shipPaths() {
  if (!OVL.ships) return [];
  const paths = [];
  for (const s of shipData.ships ?? []) {
    const pts = shipTrail(s);
    if (pts) paths.push({ pts });
    if (paths.length >= 2500) break;
  }
  return paths;
}
function refreshGlobe() {
  if (!globeInstance) return;
  globeInstance.pointsData(globePoints());
  globeInstance.polygonsData(OVL.tension ? tensionFeatures() : []);
  globeInstance.pathsData(shipPaths());
}
function initGlobe() {
  const el = $("globe");
  if (typeof Globe !== "function") {
    el.innerHTML = `<div class="globe-fallback">3D globe library could not be loaded.<br>Check your connection and reload.</div>`;
    return;
  }
  const globe = Globe()(el)
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
    .pathPointAlt(0.002)
    .pathColor(() => "rgba(255, 158, 61, 0.5)")
    .pathStroke(1.5)
    .pathTransitionDuration(0)
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
  const map = L.map(el, { worldCopyJump: true, minZoom: 2, zoomControl: true })
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
function buildMapShips() {
  const items = [];
  for (const s of shipData.ships ?? []) {
    const popup = `<b>⛴ ${esc(s.name)}</b><br>${shipTypeName(s.t)}` +
      `${s.sog != null ? `<br>${s.sog.toFixed(1)} kn${s.cog != null ? ` · course ${Math.round(s.cog)}°` : ""}` : ""}` +
      `<br><i>snapshot ${shipData.updated ? ago(Date.parse(shipData.updated)) : ""}</i>`;
    // trailing line: where it came from
    const trail = shipTrail(s);
    if (trail) items.push(L.polyline(trail, { color: "#ff9e3d", weight: 1.5, opacity: 0.45 }));
    // dashed projection: where it's going (dead reckoning, next ~2h)
    if (s.cog != null && s.sog > 1) {
      items.push(L.polyline([[s.lat, s.lng], projectPos(s.lat, s.lng, s.cog, s.sog, 2)],
        { color: "#ff9e3d", weight: 1.5, opacity: 0.8, dashArray: "3 5" }));
    }
    items.push(L.marker([s.lat, s.lng], { icon: shipDivIcon(s.cog) }).bindPopup(popup));
  }
  return L.layerGroup(items);
}
function applyMapOverlays() {
  if (!satMapInstance) return;
  if (OVL.tension && !satLayers.tension && countriesFeatures) satLayers.tension = buildMapTension();
  if (OVL.ships && !satLayers.ships && shipData.ships?.length) satLayers.ships = buildMapShips();
  for (const key of ["news", "quakes", "ships", "tension", "nuclear", "military", "choke"]) {
    const layer = satLayers[key];
    if (!layer) continue;
    if (OVL[key]) layer.addTo(satMapInstance);
    else satMapInstance.removeLayer(layer);
  }
}

/* ---------- overlay toggle wiring ---------- */
function initOverlayToggles() {
  for (const key of ["news", "quakes", "ships", "tension", "nuclear", "military", "choke"]) {
    const box = $(`tog-${key}`);
    if (!box) continue;
    box.addEventListener("change", async () => {
      OVL[key] = box.checked;
      if (key === "tension") {
        $("tension-scale").hidden = !box.checked;
        if (box.checked) await ensureCountries();
      }
      if (key === "ships" && box.checked && !(shipData.ships?.length)) {
        $("view-note").textContent = shipData.note === "no-key"
          ? "tanker layer needs a free AISSTREAM_KEY — see README"
          : "no tanker snapshot yet — appears after the next data refresh";
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
    for (const key of ["tension", "ships"]) {   // rebuild these from fresh data
      if (satLayers[key] && satMapInstance) satMapInstance.removeLayer(satLayers[key]);
      satLayers[key] = null;
    }
    refreshGlobe();
    applyMapOverlays();
  }, 10 * 60 * 1000);
  setInterval(loadCrypto, 5 * 60 * 1000);
  setInterval(loadKp, 15 * 60 * 1000);
})();
