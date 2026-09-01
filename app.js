/* GLOBAL MONITOR — client logic
 * News comes from data/news.json (refreshed by GitHub Actions every 30 min).
 * Quakes, crypto, FX, and space weather are fetched live from open CORS APIs.
 */
"use strict";

const $ = (id) => document.getElementById(id);

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
  } catch (e) {
    console.error("news.json load failed:", e);
    $("data-age").textContent = "unavailable";
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
  } catch (e) {
    console.error("USGS load failed:", e);
    $("feed-quakes").innerHTML = `<li class="empty">Seismic feed unavailable right now.</li>`;
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
    $("crypto-tiles").innerHTML = coins.map((c) => {
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
  } catch (e) {
    console.error("CoinGecko load failed:", e);
    $("crypto-tiles").innerHTML = `<div class="tile"><span class="name">Crypto feed unavailable right now.</span></div>`;
  }
}

/* ---------- FX (Frankfurter / ECB, CORS-open, no key) ---------- */
async function loadFX() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CNY,MXN,CHF");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $("fx-strip").innerHTML = Object.entries(data.rates).map(([sym, rate]) =>
      `<div class="fx"><span class="pair">USD/${sym}</span><span class="rate">${rate.toLocaleString(undefined, { maximumSignificantDigits: 5 })}</span></div>`
    ).join("");
  } catch (e) {
    console.error("FX load failed:", e);
    $("fx-strip").innerHTML = `<div class="fx"><span class="pair">FX feed unavailable right now.</span></div>`;
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
  } catch (e) {
    console.error("NOAA load failed:", e);
    $("kp-status").textContent = "feed unavailable";
  }
}

/* ---------- globe ---------- */
function initGlobe() {
  const el = $("globe");
  if (typeof Globe !== "function") {
    el.innerHTML = `<div class="globe-fallback">3D globe library could not be loaded.<br>Check your connection and reload.</div>`;
    return;
  }
  const points = [
    ...newsEvents.map((e) => ({
      lat: e.lat, lng: e.lng, size: 0.45, color: "#3fd0e0",
      label: `<b>${esc(e.place)}</b><br>${esc(e.t)}<br><i>${esc(e.s)}</i>`,
    })),
    ...quakePoints.map((q) => ({
      lat: q.lat, lng: q.lng, size: Math.max(0.25, (q.mag ?? 3) / 10), color: "#f5a524",
      label: `<b>M${q.mag?.toFixed(1)}</b> ${esc(q.place ?? "")}<br><i>${ago(q.time)}</i>`,
    })),
  ];
  const globe = Globe()(el)
    .globeImageUrl("https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png")
    .backgroundColor("#070b11")
    .atmosphereColor("#3fd0e0")
    .atmosphereAltitude(0.18)
    .pointsData(points)
    .pointAltitude("size")
    .pointColor("color")
    .pointRadius(0.55)
    .pointLabel("label")
    .width(el.clientWidth)
    .height(el.clientHeight);
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.55;
  globe.pointOfView({ lat: 25, lng: 10, altitude: 2.1 });
  window.addEventListener("resize", () =>
    globe.width(el.clientWidth).height(el.clientHeight));
}

/* ---------- boot ---------- */
(async function boot() {
  await Promise.allSettled([loadNews(), loadQuakes()]);
  initGlobe();
  loadCrypto();
  loadFX();
  loadKp();
  // periodic refresh while the tab stays open
  setInterval(loadNews, 10 * 60 * 1000);
  setInterval(loadQuakes, 10 * 60 * 1000);
  setInterval(loadCrypto, 5 * 60 * 1000);
  setInterval(loadKp, 15 * 60 * 1000);
})();
