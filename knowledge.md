# knowledge.md — Rabbit R1 Creations

## What this is

Home repo for Rabbit R1 "Creations": small static HTML/CSS/JS web apps that run inside the R1's WebView on rabbitOS. **Not** native Android apps. Viewport is fixed **240×282px** portrait, no zoom, `overflow: hidden`. See `AGENTS.md` for the full agent guidance.

## Layout

- `dice/` — first-party Creation: dice/coin roller (`index.html`, `css/styles.css`, `js/app.js`). The reference pattern to mirror for new apps.
- `metronome/` — first-party Creation: tap-tempo + metronome (`index.html`, `css/styles.css`, `js/app.js`). Web Audio lookahead clock, tap-to-BPM via median interval, scroll = BPM ±1 in BEAT mode / mode switch in TAP mode.
- `weather/` — first-party Creation: weather forecast dashboard (`index.html`, `css/styles.css`, `js/app.js`). Open-Meteo live weather in browser; on R1, LLM fallback when direct fetch fails. Scroll wheel for views (Current → Hourly → 5-Day → Location), side button for °C/°F toggle. Location view: on-screen 5-digit US ZIP pad (no system keyboard), zippopotam.us postal lookup for ZIPs, Open-Meteo name search for cities, LLM geocode fallback via `PluginMessageHandler`. Last set location and units persist via `creationStorage.plain` (Base64) plus `localStorage` (raw JSON) backup; New York is first-run default only.
- `synth/` — first-class Web Audio synth (`index.html`, `css/styles.css`, `js/app.js`). 1-octave piano keyboard (8 white + 5 black keys, chromatic, glissando), low-pass filter, FX view with 3 pages: FX (independent reverb / delay / chorus toggles), ADSR (drag sliders for attack / decay / sustain / release driving the per-voice envelope), and TUNES (loop recorder + arpeggiator).
- `familiar/` — Tamagotchi-style companion creature (Bit). Features 5 distinct species (`bunny|drake|ghost|mecha|neko`) with custom 32×32 ASCII pixel art rasterization and tailored color palettes. 5 evolution stages (`EGG` → `BABY` → `TEEN` → `ADULT` → `ASCENDED` with gold crown), dynamically driven by care choices (play, walk, train, sleep, feed). Full 11-activity care system: **FEED** (6-item menu with favorites/dislikes, zoomies, spices, tea), **PLAY** (Mini-Game Hub: "Catch the Berry" & "Rhythm Pulse" beat timing), **TRAIN** (Trick mastery: Spin, High-Five, Backflip, Astral Beam with discipline stars), **CLEAN** (bubble soap bath & poop hygiene cleanup), **HEAL** (clinic medicine for illness & neglect recovery), **WALK** (forage for 8 collectible artifacts in **BAG**), **SLEEP** (nightcap dream mode with lullaby), **SIGN** (3-move secret handshake), **STATS** (Pet Passport ID card with Generation, Species, Trait, Age, Bond %, Discipline), and **SETTINGS** (Sound toggle, Camera toggle, Rename, Handshake reset, Rebirth / Prestige `GEN +1`, and 2-step safe Factory Reset / Wipe Data). Persists state via `creationStorage.plain` (Base64) + `localStorage` JSON backup. R1 hardware: scroll wheel, side click, long press LLM speak (`wantsR1Response`), accelerometer shake, camera window, mic soothing, and desktop click/keyboard/wheel fallbacks.
- `creations-sdk-main/` — upstream rabbit opensource SDK drop (MIT). **Read-only**: never edit; use as docs/examples only. Never place new apps inside it.
  - `plugin-demo/reference/creation-triggers.md` — canonical SDK API notes.
  - `plugin-demo/` — feature demo of SDK APIs (hardware, LLM, TTS, storage).
  - `qr/` — self-hostable QR helper for Creation links.

Each new Creation gets its own top-level folder (sibling of `dice/`), typically:

```text
my-app/
├── index.html
├── icon.png          # optional
├── css/styles.css
└── js/app.js
```

## Commands

There is **no package.json, build step, or test/lint pipeline** — this repo is pure static files. Verification is manual:

1. Open the app's `index.html` in a browser (layout + keyboard/click fallbacks).
2. Confirm the hosted URL (GitHub Pages or Netlify) serves the same static assets.
3. Exercise hardware + storage + LLM paths on actual R1 hardware against the deployed URL.
4. Consult `creations-sdk-main/plugin-demo/` (read-only) when unsure how an SDK API behaves.

State clearly when something was only browser-checked, not verified on R1 hardware.

## Deployment

Apps are static HTML/CSS/JS. Host them on **GitHub Pages**. `.github/workflows/pages.yml` deploys the repo root on every push to `main`. Preserve relative asset paths so a folder can serve as the publish root.

GitHub Pages:

- Hub: `https://kory111111111111111111.github.io/R1-Apps/`
- Dice: `https://kory111111111111111111.github.io/R1-Apps/dice/`
- Metronome: `https://kory111111111111111111.github.io/R1-Apps/metronome/`
- Weather: `https://kory111111111111111111.github.io/R1-Apps/weather/`
- Synth: `https://kory111111111111111111.github.io/R1-Apps/synth/`
- Familiar: `https://kory111111111111111111.github.io/R1-Apps/familiar/`

## Conventions & gotchas

- **Static only**: no React/Vue/bundlers unless the user explicitly asks.
- **SDK access**: `PluginMessageHandler.postMessage(JSON.stringify({...}))` for LLM/server messages; `window.onPluginMessage` for replies (`data.message`, optional `data.data` JSON string); LLM flags `wantsR1Response` (speak via R1 speaker) and `wantsJournalEntry` (log to journal), both default false.
- **Storage**: `window.creationStorage.plain` / `.secure` — values are **Base64-encoded**, isolated per plugin. Base64 ≠ encryption; use `.secure` for sensitive values. Use `localStorage` fallback for browser testing.
- **Hardware events**: `scrollUp`, `scrollDown`, `sideClick`, `longPressStart`, `longPressEnd`; `closeWebView.postMessage("")` to exit; `creationSensors.accelerometer` (`isAvailable`, `start`, `stop`).
- ⚠️ `sideClick` double-fires (~50ms) — debounce when a single action is intended (see `dice/js/app.js`).
- **Desktop safety**: never assume SDK globals exist in a browser — feature-detect and degrade gracefully.
- **UI**: ≥44×44px hit targets; sparse UI; prefer CSS `transform`/`opacity` transitions over heavy animations (constrained device).
- **LLM**: when asking for structured UI data, prompt for **valid JSON only**; parse both `data.data` and `data.message` defensively.
- If SDK docs and demos disagree, follow the more conservative pattern in first-party apps (e.g. `dice/`).

## Out of scope

- Editing `creations-sdk-main/` without an explicit request.
- Native Android/Kotlin work, general Node/React monorepo patterns.
- Anything conflicting with the 240×282 Creation model or requiring non-SDK native APIs — stop and ask first.