# R1 ⇄ PC Routing Handoff — Route the Rabbit R1 to Freebuff / ZCode / Cursor

> **Purpose:** Full context dump of a live project so a *new* conversation/agent can pick up exactly where this one left off without re-deriving anything.
> **Created:** 2026-09-03. **Status:** Mid-project — blocked on one physical action from the user (R1 page capture).
> **Repo this lives in:** `R1-Apps` (static R1 Creations web apps). This file is project notes, not a Creation.
> **Repo path / shell:** `C:\Users\Home\Desktop\Dev\R1-Apps`; agent commands run in Git Bash (MINGW64) on Windows — Windows PowerShell 5.x available at `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`, **no `pwsh`**.
> **Repo hygiene:** this file is untracked/uncommitted. There are also UNRELATED uncommitted changes in `dungeon/` (js + test files) — do not stage, commit, or touch them unless the user asks.

---

## 1. THE GOAL (restated — read carefully, earlier turns got this wrong)

The user wants: **when their Rabbit R1 is connected to their computer (rabbit agent node), its queries should route to one of THEIR agents — Freebuff (the Codebuff/“Buffy” agent runtime), ZCode, or Cursor — instead of routing to Hermes as it normally does.**

Full verbatim opening message (typos preserved):
> *“I want to figure out a way to make it so that way when I connect a RabbitR1 to my computer, instead of Routing to Hermes as it typically does, I want it to be able to route to either Freebuff (you) ZCode or Cursor but I dont know the best way to get started as we will need to trick it into thinking its connecting to hermes I think.”*

Key follow-ups: *“R1 agent is now installed”*; *“I do not want to use Claude Code, Hermes or openclaw”*; for Cursor *“we can use the CLI if that would work better for the agent”*; ZCode *“I do not know about ZCode tbh, I believe I only have the windows app”*; final request = save this whole conversation to an md file so a new conversation can pick it up directly.

**CRITICAL CONSTRAINT — do not repeat this mistake:** the user **explicitly rejected** using Claude Code, Hermes Agent, or OpenClaw as the actual agent or as a carrier:
> *“I do not want to use Claude Code, Hermes or openclaw.”*

So: no proposing those as the runtime. They may only appear as *spoofed labels* (the R1 screen will still say “Hermes Agent” — that is accepted and expected; it is the whole point of the hijack).

**Decisions the user has already made (do not re-ask):**
1. **Approach = “Hijack the Hermes Agent page.”** Install a local shim that satisfies Rabbit’s “Hermes Agent is installed” check but actually dispatches to the user’s agents. R1 label stays “Hermes Agent”; the work happens in the user’s agents.
2. **First target = Cursor**, via **Cursor CLI** (user confirmed: *“we can use the CLI if that would work better for the agent”*).
3. ZCode = probably only the Windows desktop app (user unsure; no CLI known). Freebuff = this agent runtime (entry point unknown — investigate later).

---

## 2. WHAT THE USER ALREADY DID

- Ran Rabbit’s official **rabbit agent** installer on this Windows PC (their command, token from rabbithole):
  ```
  powershell -NoProfile -c "& ([scriptblock]::Create((irm https://agent.rabbit.tech/install.ps1))) --token=0081d942-f119-4d41-85b1-9ab7dea152cf"
  ```
  - **The token is a credential.** If re-install is ever needed the token is above, but recommend rotating/regenerating a new node token in rabbithole (hole.rabbit.tech → Settings → Nodes → Register node) rather than trusting this chat copy.
- Install **completed successfully**; node shows `connected` in `~/.rabbit-agent/runtime/rabbit-agent.status.json`.
- The user has **NOT yet done the R1 capture steps** (see §8) — that is the current blocker.

---

## 3. VERIFIED ARCHITECTURE (evidence from this machine + Rabbit docs)

### What rabbit agent actually is
- Installer script (v0.1.7, fetched from `https://agent.rabbit.tech/install.ps1`, **verified Authenticode + SHA256**): downloads a **Bun-compiled** `rabbit-agent.exe` (~97 MB, v0.1.9), installs to `~/.rabbit-agent` (here: `C:\Users\Home\.rabbit-agent`), registers node, starts background process, creates scheduled task `\rabbit-agent update` (Interactive only).
- No admin needed. No registry hacks / Defender exclusions / persistence tricks. Telemetry to Datadog (`http-intake.logs.us5.datadoghq.com`, public client token) — benign analytics.
- **Node identity:** Ed25519 keypair in `~/.rabbit-agent/private.key`; `connection.json` holds `nodeId: 8a5e599c-8b16-451e-97d7-c0f9a4b946ab`. Clock-skew detection with signed timestamps (`CLOCK_SKEW_DETECTED`, offsetMs -5690) ⇒ messages are time-signed; **do not attempt to forge cloud→node traffic**.
- **Connectivity:** pure OUTBOUND. Registers with `https://os3-ns.rabbit.tech`, then holds one control WebSocket: `wss://os3-ns-567efd75846c67ffc318660e4a402d1f.rabbit.tech/ws/agent/control/<nodeId>`. **No listening sockets observed** in `netstat` at capture (only two outbound ESTABLISHED :443 to CloudFront for PID 6648) — the R1 never talks to the PC directly; every request transits Rabbit’s cloud and is pushed to the node.
- **Capabilities (install “doctor” checks + binary strings):** terminal command execution (`cmd /c`, `powershell -ExecutionPolicy Bypass -File`), file read/write/delete, PTY/tty handling (`conpty`, `setRawMode`), a `jobs/` work queue. It reported environment on startup: `os=win32-10.0.26200, arch=x64, shell=C:\WINDOWS\system32\cmd.exe, runtimes: node@24.20.0, python@3.14.7`.
- **KEY FINDING (binary string scan of rabbit-agent.exe v0.1.9):** *no* hardcoded agent names (`hermes`, `openclaw`, `claude`, `codex` all absent — the `cursor`/`claude` hits were CSS/npm noise). ⇒ **the node is a generic executor; which agent CLI runs is decided by Rabbit’s cloud and resolved against whatever is on the PC’s PATH.** This is the injection surface.

### How Rabbit’s “agent pages” work (rabbitOS)
- Swipe left from the R1 home screen → agent pages. rabbitOS 2.2 (Jun 18, 2026): **Claude Code on R1** + **terminal mode** (“direct access to rabbit agent, openclaw, claude code…”) + agents manager in settings. rabbitOS 2.3 (Jul 10, 2026): **Hermes Agent on R1**, DLAM moves to **BYOK with Anthropic/OpenAI keys**, OpenClaw protocol v4 “rebuilt through rabbit agent”, proactive rabbit, creations gallery 1.5. (Source: rabbit.tech/updates.)
- **Cursor is NOT a native page as of rabbitOS 2.3.** Hermes Agent / Claude Code / OpenClaw / DLAM / terminal mode are the routes.
- Rabbit support article (rabbit.tech/support/article/agents-on-rabbit-r1) — critical quotes:
  - *“You must already have Claude Code CLI, Hermes Agent and/or OpenClaw set up in the terminal on your computer in order to use them on your r1”* — **the CLIs run locally; Rabbit relays.**
  - *“Do not run the rabbit agent install command inside any agent view directly, it must be straight to the terminal”* — vendor says agents must not run the installer; user ran it themselves in PowerShell.
  - Uninstall: rabbithole → Settings → Nodes → remove (auto-uninstalls within 30 min), or `powershell -NoProfile -c "& ([scriptblock]::Create((irm https://agent.rabbit.tech/install.ps1))) --uninstall"`.
- **Interpretation (the core reasoning):** there is no Hermes *endpoint* on the PC to spoof — the default PTT assistant is Rabbit’s cloud brain, and the agent-page “agents” are local BYOK CLIs that the node spawns on the cloud’s instruction. So “routing to Freebuff/ZCode/Cursor” = making the local process Rabbit launches for a page be *your* dispatcher. User’s “trick it into thinking it’s connecting to Hermes” instinct is correct but belongs at the **local CLI slot**, not the network/device layer. (Device-level Hermes MITM would need rooting + TLS breaking — rejected.)

---

## 4. MACHINE STATE (this PC, `C:\Users\Home`)

| Item | State |
|---|---|
| rabbit agent | v0.1.9, running (PID 6648 as of 2026-09-03 19:09Z), status `connected` |
| `~/.rabbit-agent` | bin/, downloads/, versions/0.1.9/, jobs/ (+ .creation/.deletion), logs/ (agent.log, install.log), runtime/ (pid + status json), connection.json, current.json, private.key, install.ps1 |
| agent.log | JSON-lines; records register, env detection, WS connect. **Probe/launch commands for agent pages should appear here when the R1 acts — this is the capture target.** |
| Cursor editor | v3.19.7 at `C:\Program Files\cursor\resources\app\bin\cursor` (+ cursor.cmd, code-tunnel.exe). **Editor launcher only** — no agent subcommand works (`cursor agent --help` prints main help). `~/.cursor/` has agents/, skills/, plugins/, plans/ |
| Cursor CLI agent | **NOT installed.** Official Windows install: `irm 'https://cursor.com/install?win32=true' | iex`. Pending user OK. |
| Hermes Agent CLI | **NOT installed** (by design — see plan §6). Nous Research open-source agent; Windows CLI command is `hermes`, data under `%LOCALAPPDATA%\hermes`. TUI agent with providers incl. self-hosted/Ollama. Docs: hermes-agent.nousresearch.com, github.com/NousResearch/hermes-agent. |
| Claude / OpenClaw / Codex / Freebuff CLIs | NOT installed |
| ZCode | `~/.zcode` config dir exists (app has run). Z.ai GLM desktop coding agent (launched ~Apr 2026). No CLI found; Reddit (r/ZaiGLM, ~Aug 2026) suggests no official CLI. |
| npm global | empty |
| Shell/tooling | Git Bash (MINGW64) for agent commands; Windows PowerShell 5.x (no `pwsh`); `HOME=C:\Users\Home`. Local scratch copy of install.ps1 + greps: `/tmp/rabbit-inspect/` (vanishes on reboot — see re-download note below). |

### Rabbit agent inspection cheatsheet (re-run anytime, read-only)
```bash
BIN=~/.rabbit-agent/bin/rabbit-agent.exe
cat ~/.rabbit-agent/connection.json ~/.rabbit-agent/runtime/rabbit-agent.status.json
tail -50 ~/.rabbit-agent/logs/agent.log
file $BIN && ls -la $BIN          # PE32+ x86-64, ~97 MB bun single-file
grep -aoE 'wss?://[a-zA-Z0-9./_-]+' $BIN | sort -u   # endpoints
grep -aoiE 'hermes|openclaw|claude|codex|cursor' $BIN | sort | uniq -c  # expect noise only
```
A copy of install.ps1 + scratch greps was kept at `/tmp/rabbit-inspect/` (temp — will vanish on reboot; re-download with `curl -sS -o install.ps1 https://agent.rabbit.tech/install.ps1` if needed).

---

## 5. TARGET AGENTS — WHAT WE KNOW

### Cursor CLI (first target) — confirmed real & documented
- Official docs: cursor.com/docs/cli/overview + cursor.com/docs/cli/headless.
- Windows install: `irm 'https://cursor.com/install?win32=true' | iex`
- **Distribution caution:** Cursor CLI is NOT on npm. An unrelated `cursor-cli` v1.0.0 exists on the npm registry — ignore it. Install only via the official cursor.com installer; official docs invoke it as `agent` (do not assume a separate `cursor-agent` binary name).
- Command: **`agent`** (interactive TUI), `agent "initial prompt"`, **headless**: `agent -p "prompt" [--model X] --output-format text` (ideal for R1 relay), sessions: `agent ls`, `agent resume`, `agent --continue`, `--resume="chat-id"`; modes: agent (default) / plan (`--plan`) / ask (`--mode=ask`); cloud-agent handoff with `& task` prefix; requires a Cursor account/subscription (user must be logged in).
- Next step after user OK: install it, verify `agent --version` + login state.

### Hermes Agent (the slot we fake) — what Rabbit expects
- **Identity inference (NOT yet 100% confirmed):** Rabbit’s support article treats “Hermes Agent” as a third-party CLI the user installs, and the only publicly documented product by that name is **Nous Research’s open-source hermes-agent** — CLI command **`hermes`** on Windows (PowerShell installer; state under `%LOCALAPPDATA%\hermes`), TUI, BYOK providers incl. self-hosted/Ollama. Rabbit’s marketing (rabbitOS 2.3 “hermes agent on r1 … connect hermes”) could be the same tool or a Rabbit-first-party wrapper — **confirm against the R1 page wording and the captured launch command before committing to the `hermes` executable name.**
- Detection probe = plausibly something like `hermes --version`; session launch = `hermes …`. **Unknown whether Rabbit drives the interactive TUI through a PTY or calls a headless/print mode — the capture (§8) must answer this, because it decides whether the fake CLI must emulate a TUI or can just speak plain stdout.**
- Side benefit of the hijack: real Hermes needs an LLM provider + API keys (Rabbit: “you must provide your own API keys”) — **the fake `hermes` needs none.**

### ZCode & Freebuff (later targets)
- ZCode: desktop app; entry point unknown → investigate CLI/API/automation when reached. User: *“I do not know about ZCode tbh, I believe I only have the windows app.”*
- Freebuff: the Codebuff agent runtime (this conversation’s host). No public CLI/API confirmed — needs discovery (ask user / check Freebuff install) when we route there. **Freebuff = “you” from the user’s perspective; keep this the eventual flagship target.**

---

## 6. THE PLAN (agreed)

1. Capture what Rabbit runs for the Hermes page (probe + session launch) — needs user’s R1 (§8). ✅ pending
2. Build a fake **`hermes`** CLI on PATH (ahead of any real install; the shim’s dir must sort FIRST in PATH and survive any later real install) that:
   - passes Rabbit’s detection probe convincingly (exact contract from step 1);
   - on a real session launch, dispatches to **Cursor CLI `agent`** — headless `agent -p "<prompt>" --output-format text` if Rabbit expects plain stdout, or transparent TUI-in-PTY passthrough if Rabbit drives an interactive session (exact contract from the capture); streams output back;
   - is a small dispatcher so **Freebuff / ZCode** can be added as routing targets later (route keyword or config file).
3. Install standalone Cursor CLI on the PC, log the user into Cursor, verify `agent` works standalone first.
4. Verify end-to-end: R1 voice → (Rabbit thinks: Hermes session) → fake `hermes` → Cursor CLI → reply spoken on R1.
5. Extend dispatcher to Freebuff / ZCode.

**Fallback if Rabbit refuses to show/activate the Hermes page without a real Hermes CLI installed:** temporarily install the real open-source hermes-agent (`hermes`) to unlock the page + capture the launch contract, then replace it with the dispatcher. User was told this and only objects if they say so.

**If the R1 shows NO Hermes Agent page at all** (e.g., rabbitOS < 2.3 or different labeling): options are (a) hijack whichever agent page DOES exist (same fake-CLI technique, different executable name), (b) update the R1 to rabbitOS 2.3 first, or (c) use terminal mode. Do not silently switch slots — ask the user which they want.

---

## 7. CURRENT TODO STATE

- [x] Identify Cursor’s agent-mode CLI entry point — **done**: standalone Cursor CLI `agent` (+ headless `-p`); standalone CLI NOT yet installed (needs user OK)
- [x] Decide capture method — **done**: post-hoc read of `~/.rabbit-agent/logs/agent.log` (+ optional child-process snapshot, §8) is primary; a live background watcher is NOT required — the node logs its own actions
- [ ] **USER ACTION: R1 page capture (BLOCKING)** — user said they’ll do it (§8); do not build the shim until the probe/launch contract is captured
- [ ] Confirm Rabbit’s “Hermes Agent” = the `hermes` CLI name (identity inference — §5) from captured commands/page wording
- [ ] Build the fake-`hermes` dispatcher shim → Cursor CLI `agent` (§6)
- [ ] Install + log in Cursor CLI, verify standalone (`agent -p` smoke test)
- [ ] Verify end-to-end R1 voice → Cursor session on this PC
- [ ] Extend dispatcher to Freebuff and ZCode

---

## 8. IMMEDIATE NEXT ACTIONS (what happens next)

### User must do this on the R1 (already instructed once — follow up)
1. Swipe left on R1 home → agent pages.
2. **Report exact page labels/wording** (Hermes Agent? Claude Code? terminal mode? anything saying “install needed”/“not installed”?). Also report rabbitOS version (Settings → About) if findable.
3. Tap **“click to refresh”** if present.
4. If a Hermes page opens a session: hold PTT, say *“hello test.”*
5. **User must NOT install anything on the R1 side**, even if prompted.

Note: agent pages require rabbitOS 2.2+ (2.3 introduced the Hermes Agent page). If NO pages appear at all, the R1 probably needs an OTA update — ask the user before assuming anything else is wrong.

### Agent must then do (capture procedure)
1. `tail -n +1 ~/.rabbit-agent/logs/agent.log` and diff against known startup entries (2026-09-03 19:09Z) — new entries = the probe/launch commands Rabbit pushed.
2. If ambiguous or the log is silent: snapshot the node’s child processes just before and just after the R1 action (parent PID from `runtime/rabbit-agent.pid`), and check the `jobs/` dirs:
   ```powershell
   Get-CimInstance Win32_Process -Filter "ParentProcessId=<PID from ~/.rabbit-agent/runtime/rabbit-agent.pid>" | Select-Object ProcessId,Name,CommandLine | Format-List
   ```
   Diff the two snapshots by PID/CommandLine; also `netstat -ano | grep <PID>` to catch new outbound connections.
3. Reconstruct: (a) the detection probe command + expected output, (b) the session-launch command + args + whether it expects an interactive PTY (TUI) or plain stdout.
4. Then build the fake `hermes` shim to satisfy both, dispatching to `cursor agent`.

### Open questions for the user (ask at next contact if unanswered)
- What did the R1 actually show (page labels, OTA version)?
- Is Cursor CLI install OK now? (`irm 'https://cursor.com/install?win32=true' | iex` — pending approval)
- Is the user logged into a Cursor account/subscription on this PC (required for `agent`)?
- Later: how does the user want voice routed to Freebuff (what does Freebuff expose locally)? Same for ZCode (desktop-app automation vs API).

---

## 9. MISTAKES / CORRECTIONS LOG (so the next session doesn’t repeat them)

1. **Turn 1 error:** I suggested making Claude Code the carrier/router for R1→Freebuff. **Wrong** — user explicitly wants none of Rabbit’s supported trio; they want their own agents only. The correct frame is *hijacking a slot*, not *using a supported agent*.
2. **“Trick Hermes” layer error:** user proposed network-level Hermes impersonation. Correct answer: Rabbit’s architecture makes the **local CLI slot** the injection point; no endpoint spoofing needed (and device-level spoofing would require root/TLS break — rejected).
3. Do not re-ask questions already answered (approach = hijack; first target = Cursor CLI).
4. The installed `cursor` editor binary is NOT the Cursor agent CLI — don’t confuse them again. (`cursor agent --help` in v3.19.7 prints the editor’s main help; real agent comes from the standalone installer.)

---

## 10. RESUME PROMPT (paste this into a new conversation)

> Continue the R1 routing project in **R1-REROUTE-HANDOFF.md** at the repo root. Read that file first. Status: rabbit agent v0.1.9 is installed and connected on this Windows PC; we’re hijacking the R1’s “Hermes Agent” page slot with a fake local `hermes` CLI that dispatches to Cursor CLI (`cursor agent`), then Freebuff and ZCode. The blocker is the live capture of what Rabbit’s cloud makes the node run for the Hermes page — the user was asked to swipe left on the R1, report the page labels, tap “click to refresh,” and PTT a test phrase. Check `~/.rabbit-agent/logs/agent.log` for new entries since the 2026-09-03 19:09Z startup, reconstruct the probe/launch contract, then build the fake-`hermes` dispatcher shim (target: `agent -p "<prompt>" --output-format text`, or interactive TUI if that’s the contract). Do NOT install or use real Claude Code / Hermes Agent / OpenClaw as the agent, and do not re-ask the user’s already-made decisions (see §1).

---

## 11. KEY REFERENCE MATERIAL

- Rabbit rabbit agent install/uninstall + third-party agents: https://www.rabbit.tech/support/article/agents-on-rabbit-r1
- rabbitOS changelog (2.2, 2.3): https://www.rabbit.tech/updates
- Hermes Agent (Nous, open-source; the CLI we fake): https://hermes-agent.nousresearch.com/docs / https://github.com/NousResearch/hermes-agent
- Cursor CLI docs: https://cursor.com/docs/cli/overview and https://cursor.com/docs/cli/headless
- rabbit agent installer: https://agent.rabbit.tech/install.ps1 (Windows) / install.sh (macOS/Linux)
- Local records: `~/.rabbit-agent/logs/install.log` (“rabbit-agent started successfully … Return to your browser to continue”) and `~/.rabbit-agent/logs/agent.log` (JSON-lines runtime log — **the capture target for probe/launch commands**)

---

## 12. CONVERSATION TIMELINE (compressed)

1. User asked how to route their R1 from “Hermes” to Freebuff/ZCode/Cursor, suspected a Hermes-impersonation trick, and provided the rabbit agent install command (see §2).
2. Agent verified the installer was Rabbit’s official one (Authenticode/SHA256 + docs match) but misfired by proposing Claude Code as a carrier — corrected in §9.
3. User: “you misunderstood … I do not want to use Claude Code, Hermes or openclaw. R1 agent is now installed.” Agent re-read the task and tore down the installed node: logs, install record, binary strings, endpoints (see §3).
4. Research phase: Rabbit support article, rabbitOS changelog 2.2/2.3, Nous hermes-agent docs, Cursor CLI docs. Conclusion: agent pages = local BYOK CLIs; node = cloud-pushed executor; injection point = the local CLI slot (see §3).
5. User chose: hijack the Hermes Agent page; Cursor first via Cursor CLI; ZCode = windows app only (user unsure of a CLI).
6. Agent confirmed Cursor CLI details (Windows installer, `agent` command, headless `-p`) and gave the user R1 capture steps (§8). User: “Okay will do … run the R1 and report back.”
7. User asked to save the whole conversation to an md so a new conversation can resume directly → this file; then ran the final-stop quality gate on it (2026-09-03).

---

## 13. KNOWN UNKNOWNS / RISK REGISTER

- **[Blocker] Hermes-page launch contract** — the probe command, session-launch args, and TUI-vs-headless behavior are unknown until the R1 capture (§8). Everything downstream depends on it.
- **Hermes identity** — “Hermes Agent” = Nous hermes-agent is an inference (see §5); confirm from page wording / captured command before committing to the `hermes` name.
- **R1 OTA version unknown** — pages differ between rabbitOS 2.2 and 2.3; user to report. rabbitOS < 2.2 = no agent pages at all.
- **Rabbit agent auto-updates** — scheduled task `\rabbit-agent update` + cloud-side changes can alter the launch contract; if routing breaks later, re-run the §8 capture and re-verify the shim. (The fake `hermes` lives outside the node, so node updates don’t touch it.)
- **Rabbit may ship native pages later** — if Cursor (or others) becomes a native rabbitOS page, the native route likely beats the hijack; reassess with the user then.
- **PATH precedence** — the fake `hermes` must keep winning over any future real install (shim dir first in PATH; document the install so it survives reboots/updates).
- **ToS gray area** — Rabbit’s own support article flags third-party agent use as “at your own risk”; hijacking a page slot with a fake CLI is undocumented behavior but is entirely local to the user’s own PC (no cloud or firmware tampering). User chose this knowingly.
- **Credentials** — the registration token in §2 and `~/.rabbit-agent/private.key` are credentials: do not paste them into chats or repos; regenerate in rabbithole if exposed.
- **Cursor CLI login** — `agent` requires a logged-in Cursor account/subscription; verify before end-to-end testing.
- **ZCode / Freebuff entry points** — unknown; need CLI/API discovery before routing to them.
- **File staleness** — this doc is a snapshot dated 2026-09-03. Append new facts with dates and keep §7/§8 current as the project advances.
