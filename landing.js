/* Landing / voice debrief overlay for the Global Monitoring System.
 * Uses the browser's built-in speech synthesis (British English voice when
 * available). Shown once per visit (sessionStorage). The orb pulses on each
 * spoken word; if no voice is available the transcript still types out.
 */
"use strict";
(function () {
  const landing = document.getElementById("landing");
  if (!landing) return;

  let seen = false;
  try { seen = sessionStorage.getItem("gms-landing-seen") === "1"; } catch (_) { /* private mode */ }
  if (seen) return;               // straight to the dashboard
  landing.hidden = false;

  const hourNow = new Date().getHours();
  const salute = hourNow < 12 ? "Good morning." : hourNow < 18 ? "Good afternoon." : "Good evening.";

  const textEl = document.getElementById("lp-text");
  const subEl = document.getElementById("lp-sub");
  const statusEl = document.getElementById("lp-status");
  const orb = document.getElementById("lp-orb");
  const core = landing.querySelector(".lcore");
  const waveEl = document.getElementById("lp-wave");
  const briefBtn = document.getElementById("lp-brief");
  const skipBtn = document.getElementById("lp-skip");

  textEl.textContent = `${salute} You are connected to the Global Monitoring System. All feeds are operational. Stand by for your situation debrief.`;

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

  /* ---------- voice ---------- */
  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    const prefer = [
      (v) => v.lang === "en-GB" && /male|ryan|daniel|george|arthur|brian/i.test(v.name),
      (v) => v.lang === "en-GB",
      (v) => /en[-_]GB/i.test(v.lang),
      (v) => v.lang?.startsWith("en"),
    ];
    for (const test of prefer) {
      const v = voices.find(test);
      if (v) return v;
    }
    return null;
  }

  let speaking = false;
  function speak(text, { onWord, onDone }) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") { onDone?.(); return false; }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.96;
    u.pitch = 0.82;   // measured, lower register
    u.onboundary = (ev) => { if (ev.name === "word" || ev.charIndex != null) onWord?.(ev.charIndex ?? 0); };
    u.onend = () => onDone?.();
    u.onerror = () => onDone?.();
    synth.cancel();
    synth.speak(u);
    return true;
  }

  // typed transcript synced to speech boundaries (or timed, as fallback)
  function present(text, done) {
    speaking = true;
    waveOn();
    textEl.textContent = "";
    let fallbackTimer = null;
    let progressed = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      speaking = false;
      waveOff();
      clearInterval(fallbackTimer);
      textEl.textContent = text;
      done?.();
    };
    const typeOut = () => {
      let i = 0;
      fallbackTimer = setInterval(() => {
        i += 3;
        textEl.textContent = text.slice(0, i);
        pulse(4);
        if (i >= text.length) finish();
      }, 40);
    };
    const ok = speak(text, {
      onWord: (charIndex) => {
        progressed = true;
        textEl.textContent = text.slice(0, charIndex);
        const word = text.slice(charIndex).split(/\s/)[0] ?? "";
        pulse(word.length);
      },
      onDone: finish,
    });
    if (!ok) {
      typeOut();  // no speech engine: type it out at reading pace
    } else {
      // watchdog: some engines accept the utterance but never speak — fall
      // back to the typed transcript so the debrief always plays out
      setTimeout(() => {
        if (!progressed && !finished) {
          try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ }
          typeOut();
        }
      }, 3000);
    }
  }

  /* ---------- debrief script, assembled from live dashboard data ---------- */
  function cleanForSpeech(s) {
    return s.replace(/['’]s?\b/g, (m) => m).replace(/\s+/g, " ").replace(/&amp;/g, "and").trim();
  }
  async function fetchJSON(path) {
    try {
      const r = await fetch(`${path}?cb=${Math.floor(Date.now() / 600000)}`);
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }
  async function buildDebrief() {
    const parts = [];
    parts.push(`Commencing debrief at ${new Date().toISOString().slice(11, 16).replace(":", "")} hours zulu.`);

    const news = await fetchJSON("data/news.json");
    const world = news?.categories?.world ?? [];
    if (world.length) {
      parts.push("Item one. Principal headlines. " +
        world.slice(0, 3).map((i) => cleanForSpeech(i.t)).join(". ") + ".");
    }

    // conflict assessment from the same data the map uses
    try {
      if (typeof countryTension === "function" && tensionPlaces.length) {
        const ranked = [...countryTension().entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 3);
        if (ranked.length) {
          parts.push("Item two. Conflict assessment. Highest activity: " +
            ranked.map(([name, t]) => `${name}, ${t.tier.toLowerCase()}`).join("; ") +
            ". Based on the trailing thirty days of reporting.");
        }
      }
    } catch (_) { /* dashboard not ready — skip item */ }

    const mkts = await fetchJSON("data/markets.json");
    if (mkts?.us?.length) {
      const line = mkts.us.slice(0, 3).map((m) =>
        `${m.name.replace(/·.*/, "")} ${m.chgPct >= 0 ? "up" : "down"} ${Math.abs(m.chgPct).toFixed(1)} percent`).join(", ");
      parts.push(`Item three. Markets. ${line}.`);
    }

    try {
      if (typeof quakePoints !== "undefined" && quakePoints.length) {
        const top = quakePoints[0];
        parts.push(`Item four. Seismic. ${quakePoints.length} events above magnitude two point five in the last day` +
          (top?.mag >= 5 ? `, the strongest a magnitude ${top.mag.toFixed(1)} near ${cleanForSpeech(top.place ?? "")}` : "") + ".");
      }
    } catch (_) { /* skip */ }

    const kpStatus = document.getElementById("kp-status")?.textContent?.trim();
    if (kpStatus && !/unavailable/i.test(kpStatus)) {
      parts.push(`Item five. Space weather: ${kpStatus.toLowerCase()}.`);
    }

    parts.push(`That concludes your debrief. The board is yours. ${salute}`);
    return parts.join(" ");
  }

  /* ---------- flow ---------- */
  function dismiss() {
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
    // voices load asynchronously in some browsers — nudge once
    try { window.speechSynthesis?.getVoices(); } catch (_) { /* ignore */ }
    const script = `${salute} You are connected to the Global Monitoring System. ` + await buildDebrief();
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
