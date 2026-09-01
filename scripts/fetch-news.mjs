// Fetches RSS/Atom feeds, geocodes country mentions for globe markers,
// and writes data/news.json. Runs on Node 18+ (no dependencies).
// Executed every 30 minutes by .github/workflows/refresh-data.yml.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FEEDS = [
  { cat: "world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { cat: "world", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { cat: "world", name: "Guardian World", url: "https://www.theguardian.com/world/rss" },
  { cat: "world", name: "DW", url: "https://rss.dw.com/rdf/rss-en-world" },
  { cat: "world", name: "France 24", url: "https://www.france24.com/en/rss" },
  { cat: "geopolitics", name: "Defense One", url: "https://www.defenseone.com/rss/all/" },
  { cat: "geopolitics", name: "War on the Rocks", url: "https://warontherocks.com/feed/" },
  { cat: "geopolitics", name: "Breaking Defense", url: "https://breakingdefense.com/feed/" },
  { cat: "geopolitics", name: "Foreign Policy", url: "https://foreignpolicy.com/feed/" },
  { cat: "tech", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { cat: "tech", name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { cat: "tech", name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { cat: "finance", name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { cat: "finance", name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { cat: "finance", name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
];

// Coarse geocoder: country/region name -> [lat, lng]
const PLACES = {
  "Ukraine": [49, 32], "Russia": [56, 44], "Moscow": [55.7, 37.6], "Kyiv": [50.45, 30.5],
  "China": [35, 105], "Beijing": [39.9, 116.4], "Taiwan": [23.7, 121], "Hong Kong": [22.3, 114.2],
  "United States": [39, -98], "Washington": [38.9, -77], "U.S.": [39, -98], "US ": [39, -98],
  "Israel": [31.4, 35], "Gaza": [31.4, 34.35], "West Bank": [31.9, 35.3], "Lebanon": [33.9, 35.9],
  "Iran": [32, 53], "Tehran": [35.7, 51.4], "Iraq": [33, 44], "Syria": [35, 38.5],
  "Saudi Arabia": [24, 45], "Yemen": [15.5, 48], "Qatar": [25.3, 51.2], "UAE": [24, 54],
  "Turkey": [39, 35], "Egypt": [26.8, 30], "Libya": [27, 17], "Sudan": [15, 30],
  "Ethiopia": [9, 39], "Somalia": [5, 46], "Kenya": [0.4, 37.9], "Nigeria": [9.6, 8],
  "South Africa": [-29, 24], "Congo": [-2.9, 23.7], "Mali": [17.6, -4], "Niger": [17.6, 8.1],
  "India": [22, 79], "Pakistan": [30, 69], "Afghanistan": [33.9, 67.7], "Bangladesh": [23.7, 90.4],
  "Sri Lanka": [7.9, 80.8], "Nepal": [28.4, 84.1], "Myanmar": [21.9, 95.9], "Thailand": [15.9, 101],
  "Vietnam": [16.2, 107.8], "Philippines": [12.9, 121.8], "Indonesia": [-2.5, 118], "Malaysia": [4.2, 102],
  "Singapore": [1.35, 103.8], "Japan": [36.2, 138.3], "Tokyo": [35.7, 139.7],
  "South Korea": [36.5, 127.9], "North Korea": [40.3, 127.5], "Seoul": [37.55, 127],
  "Australia": [-25.3, 133.8], "New Zealand": [-41.8, 172.8],
  "United Kingdom": [54, -2.5], "Britain": [54, -2.5], "London": [51.5, -0.13], "UK ": [54, -2.5],
  "France": [46.6, 2.4], "Paris": [48.85, 2.35], "Germany": [51.1, 10.4], "Berlin": [52.52, 13.4],
  "Italy": [42.8, 12.8], "Spain": [40.3, -3.7], "Portugal": [39.6, -8], "Greece": [39.3, 22.5],
  "Poland": [52, 19.3], "Romania": [45.9, 25], "Hungary": [47.2, 19.5], "Czech": [49.8, 15.5],
  "Netherlands": [52.2, 5.5], "Belgium": [50.6, 4.6], "Switzerland": [46.8, 8.2], "Austria": [47.6, 14.1],
  "Sweden": [62.2, 17.6], "Norway": [64.5, 12.7], "Finland": [64.9, 26], "Denmark": [56, 9.6],
  "Ireland": [53.3, -8.2], "Iceland": [64.9, -18.6], "Estonia": [58.7, 25], "Latvia": [56.9, 24.9],
  "Lithuania": [55.3, 23.9], "Belarus": [53.5, 28], "Moldova": [47.2, 28.5], "Georgia ": [42, 43.5],
  "Armenia": [40.3, 45], "Azerbaijan": [40.3, 47.8], "Kazakhstan": [48, 66.9],
  "Serbia": [44, 20.9], "Kosovo": [42.6, 20.9], "Bosnia": [44, 17.8], "Croatia": [45.2, 15.5],
  "Bulgaria": [42.8, 25.2], "Slovakia": [48.7, 19.7], "Ukraine's": [49, 32],
  "Canada": [56.1, -106.3], "Mexico": [23.6, -102.5], "Brazil": [-10.8, -52.9],
  "Argentina": [-35.4, -65.2], "Chile": [-31.8, -71], "Peru": [-9.2, -75], "Colombia": [4.1, -73.1],
  "Venezuela": [7.1, -66.2], "Bolivia": [-16.3, -63.5], "Ecuador": [-1.4, -78.4],
  "Cuba": [21.5, -78], "Haiti": [19, -72.7], "Panama": [8.5, -80.1], "Guatemala": [15.7, -90.2],
  "Greenland": [72, -40], "Antarctica": [-82, 0], "Arctic": [80, 0],
  "New York": [40.7, -74], "California": [36.8, -119.4], "Texas": [31.5, -99.3],
  "Red Sea": [20, 38.5], "South China Sea": [13.5, 114], "Black Sea": [43.4, 34.3],
  "Persian Gulf": [26.5, 52], "Strait of Hormuz": [26.6, 56.5], "Suez": [30.5, 32.4],
  "NATO": [50.9, 4.4], "European Union": [50.9, 4.4], "Brussels": [50.85, 4.35],
};

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/<[^>]+>/g, "").trim();

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decode(m[1]) : "";
}

function parseFeed(xml) {
  const out = [];
  if (/<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml)) {
    // Atom
    for (const block of xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []) {
      const linkM =
        block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) ||
        block.match(/<link[^>]*href="([^"]+)"/i);
      out.push({
        title: pick(block, "title"),
        link: linkM ? decode(linkM[1]) : "",
        date: pick(block, "updated") || pick(block, "published"),
      });
    }
  } else {
    // RSS 2.0 / RDF
    for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
      out.push({
        title: pick(block, "title"),
        link: pick(block, "link") || (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? ""),
        date: pick(block, "pubDate") || pick(block, "dc:date"),
      });
    }
  }
  return out.filter((i) => i.title && i.link);
}

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; GlobalMonitor/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml).slice(0, 20).map((i) => ({ ...i, source: feed.name, cat: feed.cat }));
  } catch (e) {
    console.error(`FAIL ${feed.name}: ${e.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function geocode(title) {
  for (const [name, [lat, lng]] of Object.entries(PLACES)) {
    if (title.includes(name)) return { lat, lng, place: name.trim() };
  }
  return null;
}

const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();

const categories = { world: [], geopolitics: [], tech: [], finance: [] };
const seen = new Set();
for (const item of all) {
  const key = item.title.toLowerCase().slice(0, 80);
  if (seen.has(key)) continue;
  seen.add(key);
  const ts = Date.parse(item.date) || 0;
  categories[item.cat].push({ t: item.title, u: item.link, s: item.source, ts });
}
for (const cat of Object.keys(categories)) {
  categories[cat].sort((a, b) => b.ts - a.ts);
  categories[cat] = categories[cat].slice(0, 40);
}

// Globe markers from world + geopolitics headlines
const events = [];
for (const item of [...categories.world, ...categories.geopolitics]) {
  const geo = geocode(item.t);
  if (geo) events.push({ t: item.t, s: item.s, lat: geo.lat, lng: geo.lng, place: geo.place });
  if (events.length >= 60) break;
}

const payload = { updated: new Date().toISOString(), categories, events };
mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(join(ROOT, "data", "news.json"), JSON.stringify(payload));
const counts = Object.entries(categories).map(([k, v]) => `${k}:${v.length}`).join(" ");
console.log(`Wrote data/news.json  (${counts}, events:${events.length})`);
