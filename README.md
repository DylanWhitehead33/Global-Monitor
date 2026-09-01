# J.A.R.V.I.S. — Central Intelligence Hub

A personal real-time situational-awareness dashboard with a holographic HUD theme,
inspired by [worldmonitor](https://github.com/koala73/worldmonitor) but rebuilt from
scratch as a simple static site. No servers, no build step, no API keys — it runs
entirely on **GitHub Pages** for free.

**What it shows**

- Rotating 3D night-lights globe with markers for geolocated news events and earthquakes
- Flat satellite map (Leaflet + Esri World Imagery) with near-live infrared cloud and
  precipitation radar overlays (RainViewer, ~10 min refresh) plus news/quake markers
- Bloomberg TV live stream embed (YouTube)
- Four live news panels: World, Geopolitics/Defense, Tech, Finance (15 RSS sources)
- Live earthquakes M2.5+ from USGS
- Crypto prices with 7-day sparklines (CoinGecko) and FX rates (ECB via Frankfurter)
- Space weather: NOAA planetary K-index
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
