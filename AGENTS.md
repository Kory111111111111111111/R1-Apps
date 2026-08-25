# AGENTS.md — R1-Apps

Guidance for AI agents working in this repository.

## What this repo is

The home repo for **all Rabbit R1 Creations** owned here: small static web apps that run inside the R1’s WebView on rabbitOS.

Creations are **not** native Android apps. They are HTML/CSS/JS pages constrained to a **240×282px** portrait viewport, talking to the device only through the **R1 Creations SDK** (injected JS bridges). Sound and LLM replies come from the R1 / rabbitOS stack — do not add local audio synthesis unless the user explicitly asks.

## Layout

| Path | Role |
|------|------|
| `dice/` | First-party Creation: dice / coin roller |
| `<app-name>/` | Each future Creation gets its **own top-level folder** (sibling of `dice/`) |
| `creations-sdk-main/` | Upstream rabbit opensource SDK drop (MIT) — **read-only reference** |
| `creations-sdk-main/plugin-demo/` | Feature demo of SDK APIs (hardware, LLM, TTS, storage) |
| `creations-sdk-main/plugin-demo/reference/creation-triggers.md` | Canonical SDK API notes — prefer this over guessing |
| `creations-sdk-main/qr/` | Self-hostable QR helper for Creation links |

**Do not edit** `creations-sdk-main/` (no fixes, refactors, or “improvements” unless the user explicitly asks). Use it only as documentation and examples. Never put new apps inside the SDK tree.

## Deployment

Creations are typically **hosted on Netlify** (static publish of the app folder’s files). Keep each app self-contained and static so a Netlify site (or site-per-app / publish-directory) can serve `index.html` and assets with no build step unless the user opts into one.

When adding or changing an app, preserve relative asset paths that work when that folder is the Netlify publish root.

## Stack conventions

- **Static only**: `index.html`, `css/`, `js/` — no React/Vue/build step unless the user requests one.
- **Viewport**: `width=240`, fixed `240×282`, `overflow: hidden`, no user zoom.
- **Touch**: Prefer ≥44×44px hit targets; keep UI sparse for the tiny screen.
- **Perf**: Prefer CSS `transform` / `opacity` and CSS transitions; minimize DOM churn; avoid heavy particles/animations (device is constrained).
- **Desktop preview**: Support click/keyboard fallbacks so apps can be checked in a normal browser; gate R1-only APIs with existence checks.

## Creations SDK (do / don’t)

**Do** use:

- `PluginMessageHandler.postMessage(JSON.stringify({...}))` for LLM / server messages
- `window.onPluginMessage` for replies (`data.message`, optional `data.data` JSON string)
- `window.creationStorage.plain` / `.secure` (values **Base64**-encoded; isolate per plugin)
- `window.creationSensors.accelerometer` (`isAvailable`, `start`, `stop`)
- Hardware events: `scrollUp`, `scrollDown`, `sideClick`, `longPressStart`, `longPressEnd`
- `closeWebView.postMessage("")` to exit
- Standard web mic / camera / speaker APIs when needed

**Don’t**:

- Edit or “sync” files under `creations-sdk-main/`
- Open raw WebSockets or invent alternate bridges “around” the SDK
- Assume SDK globals exist in desktop browsers — always feature-detect and degrade
- Ignore `sideClick` double-fire (~50ms); debounce when a single action is intended (see `dice/js/app.js`)
- Store secrets in plain storage; use `creationStorage.secure` for sensitive values

LLM flags when `useLLM: true`:

- `wantsR1Response` — speak through R1 speaker (default false)
- `wantsJournalEntry` — log to journal (default false)

When asking the LLM for structured UI data, prompt for **valid JSON only** and parse both `data.data` and `data.message` defensively.

## App patterns (mirror `dice/`)

Typical Creation shape:

```text
my-app/
├── index.html
├── icon.png          # optional Creation icon
├── css/styles.css
└── js/app.js
```

- One folder = one Creation; do not share runtime code across apps unless the user asks for a shared module.
- Keep logic small and readable; one screen, one job.
- Persist prefs via `creationStorage.plain` with `localStorage` fallback for browser testing.
- Wire scroll wheel / side button for primary interactions; touch as secondary.

## Verification

There is no Gradle/npm pipeline here. Verify by:

1. Opening the Creation’s `index.html` in a browser (layout + fallback input).
2. Confirming the Netlify-hosted URL loads the same static assets.
3. Exercising hardware + storage + LLM paths on an R1 against the deployed URL.
4. Consulting `plugin-demo` (read-only) when unsure how an SDK API is meant to behave.

State clearly when something was only browser-checked and **not** verified on R1 hardware.

## Change discipline

- Prefer surgical edits; do not rewrite whole apps for small fixes.
- Do not add frameworks or bundlers without an explicit ask.
- Do not commit secrets; Base64 is encoding, not encryption (secure storage is for that).
- If SDK docs and demos disagree, call it out and follow the more conservative, working pattern in first-party apps (e.g. `dice/`).

## Out of scope

- Modifying `creations-sdk-main/` without an explicit request.
- Native Android / Kotlin MIDI controller work (different project context).
- Treating this as a general Node/React monorepo.

When a request conflicts with the 240×282 Creation model or requires non-SDK native APIs, stop and ask before implementing.

## Current Apps:
- Dice - cerulean-chaja-15bd05.netlify.app
