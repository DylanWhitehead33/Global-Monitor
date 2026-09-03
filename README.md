# Global Monitoring System

A personal real-time situational-awareness dashboard with a holographic HUD theme,
inspired by [worldmonitor](https://github.com/koala73/worldmonitor) but rebuilt from
scratch as a simple static site. No servers, no build step, no API keys — it runs
entirely on **GitHub Pages** for free.

**What it shows**

- Rotating 3D night-lights globe with markers for geolocated news events and earthquakes,
  with a dropdown to switch the same panel to a flat satellite map (Leaflet + Esri World
  Imagery) with near-live infrared cloud and precipitation radar overlays (RainViewer,
  ~10 min refresh) plus news/quake markers
- Bloomberg TV live stream embed (YouTube) as the main top-right panel
- Four live news panels: World, Geopolitics/Defense, Tech, Finance (15 RSS sources)
- Live earthquakes M2.5+ from USGS
- Crypto prices with 7-day sparklines (CoinGecko) and FX rates (ECB via Frankfurter)
- Space weather: NOAA planetary K-index
- **Live military aircraft** worldwide from public ADS-B (adsb.lol, airplanes.live fallback),
  polled every 20 s and dead-reckoned between polls, on the globe and the flat map
- **Satellites** (space stations, the brightest visual satellites, GPS) propagated in the
  browser with SGP4 from CelesTrak elements, with the ISS ground track drawn on the globe
  and a **next ISS pass** predictor for your location in the Space panel
- **Click-to-track**: click any aircraft, satellite or tanker on the globe and the camera
  locks on, a trail draws behind it and a telemetry card opens (Esc releases)
- **Sensor styles** for the globe: RGB, CRT, NVG, FLIR (ironbow thermal) and Noir GLSL
  post-processing, keys `1`–`5` or the buttons on the globe
- Static infrastructure layers: **submarine cables** and landing points (TeleGeography) and
  **data centers** (OpenStreetMap)
- UTC + local clocks, data freshness, and a systems-status readout

**How it stays fresh with no server:** a GitHub Action (`.github/workflows/refresh-data.yml`)
runs every 30 minutes, fetches all the RSS feeds, geocodes country mentions for the globe,
and commits the result to `data/news.json`. GitHub Pages redeploys automatically on each
commit. Earthquakes, crypto, FX, and space weather are fetched live in the visitor's
browser from open CORS-friendly APIs.

## Set it up (about 5 minutes)

1. **Create the repo.** On GitHub click **New repository**, name it (e.g. `global-monitor`),
   set it to **Public** (required for free Pages), and create it.

2. **Upload these files.** Easiest way: on the new repo page choose
   **uploading an existing file**, then drag the entire contents of this folder in
   (including the `.github` folder — if your OS hides it, use git instead:
   `git init && git add -A && git commit -m "initial" && git branch -M main &&
   git remote add origin https://github.com/YOURNAME/global-monitor.git && git push -u origin main`).

3. **Enable Pages.** Repo → **Settings → Pages** → under *Build and deployment* set
   Source to **Deploy from a branch**, branch **main**, folder **/ (root)** → Save.
   Your site appears at `https://YOURNAME.github.io/global-monitor/` in a minute or two.

4. **Enable the auto-refresh Action.** Repo → **Actions** tab → if prompted, click
   **"I understand my workflows, enable them"**. Then open *Refresh news data* →
   **Run workflow** to do the first fetch immediately. After that it runs every
   30 minutes on its own.

5. *(One check if commits fail)*: Settings → Actions → General → Workflow permissions →
   select **Read and write permissions**.

## Tanker layer (optional, free API key)

The "Oil & Gas Tankers" toggle shows a global snapshot of tanker positions (AIS ship
types 80–89) captured by the refresh Action. It needs a free key from
[aisstream.io](https://aisstream.io):

1. Sign up at aisstream.io (free), then create an API key in their dashboard.
2. In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: `AISSTREAM_KEY` · Secret: paste the key → **Add secret**.
4. Actions tab → Refresh news data → **Run workflow**. Tankers appear on the next load.

Without the secret the workflow still succeeds — the tanker layer just stays empty.
Positions are a snapshot refreshed every 30 minutes, not a continuous live stream.

## Live layers (no keys needed)

- **Military aircraft** come straight from `https://api.adsb.lol/v2/mil` in the visitor's browser
  (CORS-open, no key), with `https://api.airplanes.live/v2/mil` as a fallback. The feed is only
  polled while the layer is switched on.
- **Satellites** read orbital elements from `data/tles.json`, which the refresh Action rebuilds
  from CelesTrak at most every 6 hours (CelesTrak asks for no more than one fetch per group every
  2 hours). If the file is missing the browser asks CelesTrak directly and caches the result in
  `localStorage` for 6 hours. Positions are propagated client-side with
  [satellite.js](https://github.com/shashwatak/satellite-js) (SGP4). Satellite spike heights are true
  scale up to about 2,200 km and compressed above that so GPS orbits stay on screen.
- **ISS pass predictor**: set a location with *USE MY LOCATION* (browser geolocation, never sent
  anywhere) or type `lat, lng`. It scans the next 48 hours for passes peaking above 10° and flags
  whether the pass falls in a dark sky (naked-eye visible). Prediction accuracy depends on TLE age.
- **Submarine cables** (`data/cables.json`) are TeleGeography's public cable geometry, simplified,
  under **CC BY-NC-SA 3.0** — fine for a personal site, remove the file for any commercial use.
  **Data centers** (`data/datacenters.json`) are OpenStreetMap-derived centroids under ODbL.
- Satellites are drawn on the 3D globe only; aircraft, cables and data centers also appear on the
  flat satellite map.

## Notes

- GitHub pauses scheduled workflows after ~60 days with no repo activity; the Action's own
  commits normally keep it alive, but if it ever stops, one click of **Run workflow**
  restarts it.
- Add or swap news sources by editing the `FEEDS` list at the top of
  `scripts/fetch-news.mjs`. Add globe geocoding entries in `PLACES` in the same file.
- Colors and layout live in `styles.css`; panels in `index.html`; client logic in `app.js`.
- `scripts/seed-once.mjs` only exists to create the first `data/news.json`; safe to delete.
- To preview locally: `python3 -m http.server` (or any static server) in this folder,
  then open http://localhost:8000. Opening `index.html` directly from disk won't load
  the news JSON due to browser file:// restrictions.

## License

Your own code — all of it was written from scratch, so license it however you like.
It shares no code with worldmonitor (which is AGPL-3.0), only the general idea.
