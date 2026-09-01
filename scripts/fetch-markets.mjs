// Fetches major stock-index quotes (1 month of daily closes) from Yahoo
// Finance's public chart endpoint and writes data/markets.json.
// Runs in the GitHub Action every 30 minutes; no API key needed.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const US_INDEXES = [
  { sym: "^GSPC", name: "S&P 500" },
  { sym: "^DJI", name: "Dow Jones Industrial" },
  { sym: "^IXIC", name: "Nasdaq Composite" },
  { sym: "^RUT", name: "Russell 2000" },
  { sym: "^VIX", name: "VIX (volatility)" },
];
const GLOBAL_INDEXES = [
  { sym: "^FTSE", name: "FTSE 100 · UK" },
  { sym: "^GDAXI", name: "DAX · Germany" },
  { sym: "^FCHI", name: "CAC 40 · France" },
  { sym: "^STOXX50E", name: "Euro Stoxx 50" },
  { sym: "^N225", name: "Nikkei 225 · Japan" },
  { sym: "^HSI", name: "Hang Seng · Hong Kong" },
  { sym: "000001.SS", name: "Shanghai Composite" },
  { sym: "^BSESN", name: "Sensex · India" },
  { sym: "^KS11", name: "KOSPI · South Korea" },
  { sym: "^AXJO", name: "ASX 200 · Australia" },
  { sym: "^GSPTSE", name: "TSX · Canada" },
  { sym: "^BVSP", name: "Bovespa · Brazil" },
  { sym: "^MXX", name: "IPC · Mexico" },
];

async function fetchIndex({ sym, name }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; GlobalMonitor/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const r = j?.chart?.result?.[0];
    const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter((c) => c != null);
    if (closes.length < 2) throw new Error("no data");
    const price = r.meta?.regularMarketPrice ?? closes[closes.length - 1];
    const prev = r.meta?.chartPreviousClose ?? closes[closes.length - 2];
    const chgPct = prev ? ((price - prev) / prev) * 100 : 0;
    // thin the sparkline to ~20 points
    const step = Math.max(1, Math.floor(closes.length / 20));
    const spark = closes.filter((_, i) => i % step === 0);
    return { sym, name, price: +price.toFixed(2), chgPct: +chgPct.toFixed(2), spark };
  } catch (e) {
    console.error(`FAIL ${sym} (${name}): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const [us, global] = await Promise.all([
  Promise.all(US_INDEXES.map(fetchIndex)),
  Promise.all(GLOBAL_INDEXES.map(fetchIndex)),
]);

const payload = {
  updated: new Date().toISOString(),
  us: us.filter(Boolean),
  global: global.filter(Boolean),
};
mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(join(ROOT, "data", "markets.json"), JSON.stringify(payload));
console.log(`Wrote data/markets.json (us:${payload.us.length} global:${payload.global.length})`);
