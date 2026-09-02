// Generates the spoken debrief as an MP3 using ElevenLabs, with per-character
// timestamps so the page can sync the transcript and orb to the real audio.
// Requires the ELEVENLABS_KEY repository secret — without it, exits cleanly
// and the site falls back to the browser voice.
//
// Cost control: regenerates at most once every VOICE_MIN_HOURS (default 12),
// and only if the debrief text actually changed. Uses the efficient turbo
// model (~0.5 credits/character): one debrief ≈ 500 credits, so twice daily
// fits ElevenLabs' $5 Starter tier; on the free tier set VOICE_MIN_HOURS to
// 36 or more in the workflow.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => join(ROOT, "data", f);

const KEY = process.env.ELEVENLABS_KEY;
if (!KEY) {
  console.log("ELEVENLABS_KEY not set — skipping voice generation (browser voice will be used).");
  process.exit(0);
}
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // "George" — warm British male
const MIN_HOURS = +(process.env.VOICE_MIN_HOURS || 12);

let prev = null;
if (existsSync(DATA("debrief.json"))) {
  try { prev = JSON.parse(readFileSync(DATA("debrief.json"), "utf8")); } catch { prev = null; }
}
if (prev?.updated && Date.now() - Date.parse(prev.updated) < MIN_HOURS * 3600e3) {
  console.log(`Voice debrief is fresh (< ${MIN_HOURS}h) — skipping generation.`);
  process.exit(0);
}

/* ---------- build the same flowing debrief the page uses ---------- */
const readJSON = (f) => { try { return JSON.parse(readFileSync(DATA(f), "utf8")); } catch { return null; } };
const clean = (s) => s.replace(/\s+/g, " ").replace(/&amp;/g, "and").replace(/["“”]/g, "").trim().replace(/[.…]+$/, "");
const naturalList = (a, j = "and") => a.length <= 1 ? (a[0] ?? "") : a.slice(0, -1).join(", ") + `, ${j} ` + a[a.length - 1];
const lowerFirst = (s) =>
  (/^[A-Z]{2,}/.test(s) || /^(US|UK|EU|UN|NATO|China|Russia|Ukraine|Israel|Iran|India|Japan|Britain|Europe|America|African|Asian|Israeli|Russian|Ukrainian|Chinese|American|British|Iranian|Indian|French|German)\b/.test(s))
    ? s : s.charAt(0).toLowerCase() + s.slice(1);
const tier = (raw) => {
  const i = Math.min(1, raw / 60);
  if (i >= 0.75) return "at active conflict levels";
  if (i >= 0.4) return "under high tension";
  if (i >= 0.15) return "elevated but contained";
  return "relatively quiet";
};

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "GlobalMonitor/1.0" }, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const parts = ["Good evening, sir."];

const news = readJSON("news.json");
const world = (news?.categories?.world ?? []).slice(0, 3).map((i) => clean(i.t));
if (world.length) {
  parts.push(`Over the last twenty-four hours, the story leading the world is this: ${world[0]}.`);
  if (world[1]) parts.push(`Elsewhere, ${lowerFirst(world[1])}.`);
  if (world[2]) parts.push(`And ${lowerFirst(world[2])}.`);
} else {
  parts.push("Over the last twenty-four hours, the news picture has been unusually quiet.");
}

const tension = readJSON("tension.json");
if (tension?.places?.length) {
  const ranked = [...tension.places].sort((a, b) => (b.raw ?? b.score * 10) - (a.raw ?? a.score * 10)).slice(0, 3);
  let line = `All of which keeps the conflict picture centred on ${ranked[0].place}, ${tier(ranked[0].raw ?? ranked[0].score * 10)}`;
  const rest = ranked.slice(1).map((p) => p.place);
  if (rest.length) line += `, though ${naturalList(rest)} ${rest.length > 1 ? "are" : "is"} worth keeping an eye on as well`;
  parts.push(line + ".");
}

const mkts = readJSON("markets.json");
if (mkts?.us?.length) {
  const phrase = (m) => `the ${m.name.replace(/\s*·.*/, "").replace(/\s*\(.*\)/, "")} ${m.chgPct >= 0 ? "up" : "down"} ${Math.abs(m.chgPct).toFixed(1)} percent`;
  const tone = mkts.us[0].chgPct >= 0 ? "took it in stride" : "felt the weight of it";
  parts.push(`The markets, for their part, ${tone} — ${naturalList(mkts.us.slice(0, 3).map(phrase))}.`);
}

const quakes = await fetchJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
if (quakes?.features?.length) {
  const sorted = quakes.features.map((f) => f.properties).sort((a, b) => b.mag - a.mag);
  let line = `The earth itself has been busier, with ${sorted.length} tremors above magnitude two and a half`;
  if (sorted[0]?.mag >= 5) line += ` — the strongest a ${sorted[0].mag.toFixed(1)} near ${clean(sorted[0].place ?? "")}`;
  parts.push(line + ".");
}

const kpRows = await fetchJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
if (Array.isArray(kpRows) && kpRows.length > 1) {
  const kp = parseFloat(kpRows[kpRows.length - 1][1]);
  parts.push(kp >= 5
    ? "And overhead, conditions are less settled — a geomagnetic storm is in progress, so expect some noise in the upper atmosphere."
    : "And overhead, space weather is calm — nothing of concern.");
}

parts.push("That is the shape of the day, sir. The board is yours.");
const text = parts.join(" ");

if (prev?.text === text && existsSync(DATA("debrief.mp3"))) {
  console.log("Debrief text unchanged — keeping the existing recording.");
  process.exit(0);
}

/* ---------- generate audio with character timestamps ---------- */
console.log(`Generating voice debrief (${text.length} chars)…`);
const res = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_22050_32`,
  {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    }),
    signal: AbortSignal.timeout(120000),
  }
);
if (!res.ok) {
  console.error(`ElevenLabs error HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.error("Keeping previous recording (if any); browser voice covers the gap.");
  process.exit(0);   // never fail the whole workflow over the voice
}
const out = await res.json();
writeFileSync(DATA("debrief.mp3"), Buffer.from(out.audio_base64, "base64"));
const times = (out.alignment?.character_start_times_seconds ?? []).map((t) => +t.toFixed(2));
writeFileSync(DATA("debrief.json"), JSON.stringify({ updated: new Date().toISOString(), text, times }));
console.log(`Wrote data/debrief.mp3 and data/debrief.json (${times.length} timing points).`);
