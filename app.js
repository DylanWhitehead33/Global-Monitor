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

/* ---------- overlays: tension heatmap, nuclear, military, choke points ---------- */
const OVL = { tension: false, nuclear: false, military: false, choke: false };
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
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
/* green (low) -> gold (mid) -> red (high) */
function tensionColor(s) {
  return s < 0.5 ? lerpHex("#35c98f", "#ffc65c", s * 2) : lerpHex("#ffc65c", "#f0716e", (s - 0.5) * 2);
}
const OVL_COLORS = { nuclear: "#ff4d6d", military: "#4d9fff", choke: "#d98cff" };
function overlayDefs() {
  const defs = [];
  if (OVL.tension) defs.push(...tensionPlaces.map((p) => ({
    lat: p.lat, lng: p.lng, color: tensionColor(p.score), r: 0.7 + p.score * 1.5, size: 0.03,
    label: `<b>${esc(p.place)}</b><br>Tension index: ${(p.score * 100).toFixed(0)} / 100` +
           `<br><i>${p.count} conflict-related headline${p.count === 1 ? "" : "s"}, trailing 30 days</i>`,
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
    ...newsEvents.map((e) => ({
      lat: e.lat, lng: e.lng, size: 0.45, r: 0.55, color: "#00e5ff",
      label: `<b>${esc(e.place)}</b><br>${esc(e.t)}<br><i>${esc(e.s)}</i>`,
    })),
    ...quakePoints.map((q) => ({
      lat: q.lat, lng: q.lng, size: Math.max(0.25, (q.mag ?? 3) / 10), r: 0.55, color: "#ffc65c",
      label: `<b>M${q.mag?.toFixed(1)}</b> ${esc(q.place ?? "")}<br><i>${ago(q.time)}</i>`,
    })),
    ...overlayDefs(),
  ];
}
function refreshGlobe() {
  if (globeInstance) globeInstance.pointsData(globePoints());
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

  // Markers
  const newsLayer = L.layerGroup(newsEvents.map((e) =>
    L.circleMarker([e.lat, e.lng], {
      radius: 6, color: "#00e5ff", weight: 1.5, fillColor: "#00e5ff", fillOpacity: 0.5,
    }).bindPopup(`<b>${esc(e.place)}</b><br>${esc(e.t)}<br><i>${esc(e.s)}</i>`)
  )).addTo(map);
  const quakeLayer = L.layerGroup(quakePoints.map((q) =>
    L.circleMarker([q.lat, q.lng], {
      radius: Math.max(4, (q.mag ?? 3) * 1.6), color: "#ffc65c", weight: 1.5,
      fillColor: "#ffc65c", fillOpacity: 0.45,
    }).bindPopup(`<b>M${q.mag?.toFixed(1)}</b> ${esc(q.place ?? "")}<br>` +
      `<a href="${esc(q.url)}" target="_blank" rel="noopener">USGS detail</a> · ${ago(q.time)}`)
  )).addTo(map);

  const overlays = { "News events": newsLayer, "Earthquakes": quakeLayer };
  const control = L.control.layers({}, overlays, { collapsed: true }).addTo(map);

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
        overlays["IR satellite clouds (live)"] = irLayer;
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
  satLayers.tension = L.layerGroup(tensionPlaces.map((p) =>
    L.circleMarker([p.lat, p.lng], {
      radius: 6 + p.score * 14, color: tensionColor(p.score), weight: 1.5,
      fillColor: tensionColor(p.score), fillOpacity: 0.45,
    }).bindPopup(`<b>${esc(p.place)}</b><br>Tension index: ${(p.score * 100).toFixed(0)} / 100` +
      `<br><i>${p.count} conflict-related headline${p.count === 1 ? "" : "s"}, trailing 30 days</i>`)
  ));
  satLayers.nuclear = L.layerGroup(NUCLEAR_SITES.map((s) =>
    L.circleMarker([s.lat, s.lng], {
      radius: 5, color: OVL_COLORS.nuclear, weight: 1.5, fillColor: OVL_COLORS.nuclear, fillOpacity: 0.55,
    }).bindPopup(`<b>☢ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>publicly reported, approximate</i>`)
  ));
  satLayers.military = L.layerGroup(MILITARY_BASES.map((s) =>
    L.circleMarker([s.lat, s.lng], {
      radius: 5, color: OVL_COLORS.military, weight: 1.5, fillColor: OVL_COLORS.military, fillOpacity: 0.55,
    }).bindPopup(`<b>▲ ${esc(s.n)}</b><br>${esc(s.c)}<br><i>major base, curated list</i>`)
  ));
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
function applyMapOverlays() {
  if (!satMapInstance) return;
  for (const key of ["tension", "nuclear", "military", "choke"]) {
    const layer = satLayers[key];
    if (!layer) continue;
    if (OVL[key]) layer.addTo(satMapInstance);
    else satMapInstance.removeLayer(layer);
  }
}

/* ---------- overlay toggle wiring ---------- */
function initOverlayToggles() {
  for (const key of ["tension", "nuclear", "military", "choke"]) {
    const box = $(`tog-${key}`);
    if (!box) continue;
    box.addEventListener("change", () => {
      OVL[key] = box.checked;
      if (key === "tension") $("tension-scale").hidden = !box.checked;
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
  await Promise.allSettled([loadNews(), loadQuakes(), loadTension()]);
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
  setInterval(loadCrypto, 5 * 60 * 1000);
  setInterval(loadKp, 15 * 60 * 1000);
})();
