/* Landing / voice debrief overlay for the Global Monitoring System.
 * Speaks with the browser's best British English voice (waits for voices to
 * load), sentence by sentence at a natural pace. Shown once per visit.
 * The orb pulses on each spoken word; if no voice is available the
 * transcript still types out.
 */
"use strict";
(function () {
  const landing = document.getElementById("landing");
  if (!landing) return;

  let seen = false;
  try { seen = sessionStorage.getItem("gms-landing-seen") === "1"; } catch (_) { /* private mode */ }
  if (seen) return;               // straight to the dashboard
  landing.hidden = false;

  const salute = "Good evening, sir.";

  const textEl = document.getElementById("lp-text");
  const subEl = document.getElementById("lp-sub");
  const statusEl = document.getElementById("lp-status");
  const orb = document.getElementById("lp-orb");
  const core = landing.querySelector(".lcore");
  const waveEl = document.getElementById("lp-wave");
  const briefBtn = document.getElementById("lp-brief");
  const skipBtn = document.getElementById("lp-skip");

  textEl.textContent = `${salute} You are connected to the Global Monitoring System. All feeds are operational — ready for your debrief when you are.`;

  // status clock
  setInterval(() => {
    statusEl.textContent = `SECURE CHANNEL · ${new Date().toISOString().slice(11, 19)} UTC`;
  }, 1000);

  // waveform bars (idle flat, animated while speaking)
  const bars = [];
  for (let i = 0; i < 28; i++) {
    const b = document.createElement("i");
    waveEl.appendChild(b);
    bars.push(b);
  }
  let waveTimer = null;
  function waveOn() {
    if (waveTimer) return;
    waveTimer = setInterval(() => {
      for (const b of bars) b.style.height = (4 + Math.random() * 26).toFixed(0) + "px";
    }, 110);
  }
  function waveOff() {
    clearInterval(waveTimer); waveTimer = null;
    for (const b of bars) b.style.height = "4px";
  }

  // orb pulse: called on each spoken word
  let pulseTimer = null;
  function pulse(strength) {
    const s = 1 + Math.min(0.16, 0.05 + strength * 0.012);
    orb.style.transform = `scale(${s})`;
    core.style.boxShadow = `0 0 ${40 + strength * 10}px var(--accent), 0 0 ${90 + strength * 20}px rgba(0,229,255,.6)`;
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => {
      orb.style.transform = "scale(1)";
      core.style.boxShadow = "";
    }, 130);
  }

  /* ---------- voice selection: wait for voices, prefer natural British ---------- */
  function voicesReady() {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) return resolve([]);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(synth.getVoices());
      };
      const v = synth.getVoices();
      if (v.length) return finish();
      synth.addEventListener?.("voiceschanged", finish, { once: true });
      setTimeout(finish, 1500);   // don't wait forever
    });
  }
  function pickVoice(voices) {
    const rank = [
      (v) => /Google UK English Male/i.test(v.name),
      (v) => /en[-_]GB/i.test(v.lang) && /natural|neural|online/i.test(v.name),
      (v) => /en[-_]GB/i.test(v.lang) && /ryan|thomas|daniel|george|arthur|brian|male/i.test(v.name),
      (v) => /Google UK English/i.test(v.name),
      (v) => /en[-_]GB/i.test(v.lang),
      (v) => /Google US English/i.test(v.name),
      (v) => v.lang?.startsWith("en") && /natural|neural|online/i.test(v.name),
      (v) => v.lang?.startsWith("en"),
    ];
    for (const test of rank) {
      const v = voices.find(test);
      if (v) return v;
    }
    return null;
  }

  /* ---------- speech: sentence-by-sentence queue for natural pacing ---------- */
  let speaking = false;
  let cancelled = false;
  // Split into sentences WITHOUT breaking on decimal points ("2.9 percent").
  // A sentence ends only at . ! ? followed by whitespace and a capital/quote.
  // Returns segments with their start index in the full text, for transcript sync.
  function splitSentences(text) {
    let re;
    try { re = new RegExp('(?<=[.!?…])\\s+(?=[A-Z"“])', "g"); }
    catch (_) { return [{ s: text, start: 0 }]; }   // old Safari: speak as one piece
    const out = [];
    let start = 0;
    for (const m of text.matchAll(re)) {
      out.push({ s: text.slice(start, m.index), start });
      start = m.index + m[0].length;
    }
    out.push({ s: text.slice(start), start });
    return out.filter((seg) => seg.s.trim());
  }
  async function present(text, done) {
    speaking = true;
    cancelled = false;
    waveOn();
    textEl.textContent = "";
    const finish = () => {
      if (!cancelled) textEl.textContent = text;
      speaking = false;
      waveOff();
      done?.();
    };

    const synth = window.speechSynthesis;
    const voices = await voicesReady();
    const voice = pickVoice(voices);
    if (!synth || typeof SpeechSynthesisUtterance === "undefined" || !voices.length) {
      // no speech engine: type it out at reading pace
      let i = 0;
      const t = setInterval(() => {
        i += 3;
        textEl.textContent = text.slice(0, i);
        pulse(4);
        if (i >= text.length || cancelled) { clearInterval(t); finish(); }
      }, 40);
      return;
    }

    const sentences = splitSentences(text);
    let spokenChars = 0;   // for the first-sentence watchdog
    let idx = 0;
    const speakNext = () => {
      if (cancelled || idx >= sentences.length) return finish();
      const seg = sentences[idx++];
      const u = new SpeechSynthesisUtterance(seg.s.trim());
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "en-GB";
      u.rate = 1.14;     // brisk, conversational pace
      u.pitch = 1.0;     // no artificial deepening — sounds far less synthetic
      let progressed = false;
      u.onboundary = (ev) => {
        progressed = true;
        const ci = seg.start + (ev.charIndex ?? 0);
        spokenChars = ci;
        textEl.textContent = text.slice(0, ci);
        const word = text.slice(ci).split(/\s/)[0] ?? "";
        pulse(word.length);
      };
      const advance = () => {
        spokenChars = seg.start + seg.s.length;
        textEl.textContent = text.slice(0, spokenChars);
        setTimeout(speakNext, 30);   // near-seamless hand-off between sentences
      };
      u.onend = advance;
      u.onerror = advance;
      synth.speak(u);
      // watchdog for the first sentence only: if nothing is actually voiced,
      // fall back to typing the whole script
      if (idx === 1) {
        setTimeout(() => {
          if (!progressed && !cancelled && spokenChars === 0) {
            try { synth.cancel(); } catch (_) { /* ignore */ }
            let i = 0;
            const t = setInterval(() => {
              i += 3;
              textEl.textContent = text.slice(0, i);
              pulse(4);
              if (i >= text.length || cancelled) { clearInterval(t); finish(); }
            }, 40);
            idx = sentences.length;   // stop the queue
          }
        }, 3000);
      }
    };
    try { synth.cancel(); } catch (_) { /* ignore */ }
    speakNext();
  }

  /* ---------- debrief script: flowing sentences, assembled from live data ---------- */
  function cleanForSpeech(s) {
    return s.replace(/\s+/g, " ").replace(/&amp;/g, "and").replace(/["“”]/g, "").trim().replace(/[.…]+$/, "");
  }
  function naturalList(items, joiner = "and") {
    if (items.length <= 1) return items[0] ?? "";
    return items.slice(0, -1).join(", ") + `, ${joiner} ` + items[items.length - 1];
  }
  async function fetchJSON(path) {
    try {
      const r = await fetch(`${path}?cb=${Math.floor(Date.now() / 600000)}`);
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }
  async function buildDebrief() {
    // One continuous thought: greeting, then the last 24 hours woven together
    // with connective phrasing — no numbered items, no section labels.
    const parts = [salute];

    const news = await fetchJSON("data/news.json");
    const world = (news?.categories?.world ?? []).slice(0, 3).map((i) => cleanForSpeech(i.t));
    if (world.length) {
      parts.push(`Over the last twenty-four hours, the story leading the world is this: ${world[0]}.`);
      if (world[1]) parts.push(`Elsewhere, ${lowerFirst(world[1])}.`);
      if (world[2]) parts.push(`And ${lowerFirst(world[2])}.`);
    } else {
      parts.push("Over the last twenty-four hours, the news picture has been unusually quiet.");
    }

    try {
      if (typeof countryTension === "function" && tensionPlaces.length) {
        const ranked = [...countryTension().entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 3);
        if (ranked.length) {
          const [topName, topT] = ranked[0];
          const tierWords = { "ACTIVE CONFLICT / WAR": "at active conflict levels", "HIGH TENSION": "under high tension", "ELEVATED": "elevated but contained", "LOW": "relatively quiet" };
          let line = `All of which keeps the conflict picture centred on ${topName}, ${tierWords[topT.tier] ?? "elevated"}`;
          const rest = ranked.slice(1).map(([n]) => n);
          if (rest.length) line += `, though ${naturalList(rest)} ${rest.length > 1 ? "are" : "is"} worth keeping an eye on as well`;
          parts.push(line + ".");
        }
      }
    } catch (_) { /* dashboard not ready — skip */ }

    const mkts = await fetchJSON("data/markets.json");
    if (mkts?.us?.length) {
      const phrase = (m) => {
        const name = m.name.replace(/\s*·.*/, "").replace(/\s*\(.*\)/, "");
        return `the ${name} ${m.chgPct >= 0 ? "up" : "down"} ${Math.abs(m.chgPct).toFixed(1)} percent`;
      };
      const tone = mkts.us[0].chgPct >= 0 ? "took it in stride" : "felt the weight of it";
      parts.push(`The markets, for their part, ${tone} — ${naturalList(mkts.us.slice(0, 3).map(phrase))}.`);
    }

    try {
      if (typeof quakePoints !== "undefined" && quakePoints.length) {
        const top = quakePoints[0];
        let line = `The earth itself has been busier, with ${quakePoints.length} tremors above magnitude two and a half`;
        if (top?.mag >= 5) line += ` — the strongest a ${top.mag.toFixed(1)} near ${cleanForSpeech(top.place ?? "")}`;
        parts.push(line + ".");
      }
    } catch (_) { /* skip */ }

    const kpStatus = document.getElementById("kp-status")?.textContent?.trim();
    if (kpStatus && !/unavailable/i.test(kpStatus)) {
      const k = kpStatus.toLowerCase();
      parts.push(k.includes("storm")
        ? "And overhead, conditions are less settled — a geomagnetic storm is in progress, so expect some noise in the upper atmosphere."
        : "And overhead, space weather is calm — nothing of concern.");
    }

    parts.push("That is the shape of the day, sir. The board is yours.");
    return parts.join(" ");
  }
  function lowerFirst(s) {
    // don't lowercase proper nouns/acronyms at the start (e.g. "US", "NATO", "Israeli")
    if (/^[A-Z]{2,}/.test(s) || /^(US|UK|EU|UN|NATO|China|Russia|Ukraine|Israel|Iran|India|Japan|Britain|Europe|America|African|Asian|Israeli|Russian|Ukrainian|Chinese|American|British|Iranian|Indian|French|German)\b/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  /* ---------- flow ---------- */
  function dismiss() {
    cancelled = true;
    try { sessionStorage.setItem("gms-landing-seen", "1"); } catch (_) { /* ignore */ }
    try { window.speechSynthesis?.cancel(); } catch (_) { /* ignore */ }
    waveOff();
    landing.classList.add("dismissing");
    setTimeout(() => { landing.hidden = true; }, 850);
  }

  briefBtn.addEventListener("click", async () => {
    if (speaking) return;
    briefBtn.disabled = true;
    subEl.textContent = "SECURE VOICE CHANNEL · DELIVERING DEBRIEF";
    const script = await buildDebrief();
    present(script, () => {
      subEl.textContent = "SECURE VOICE CHANNEL · DEBRIEF COMPLETE";
      briefBtn.disabled = false;
      briefBtn.innerHTML = "↻ &nbsp;REPEAT DEBRIEF";
      skipBtn.textContent = "ENTER DASHBOARD";
      skipBtn.classList.remove("ghost");
    });
  });

  skipBtn.addEventListener("click", dismiss);
})();
