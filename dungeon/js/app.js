(function () {
    const PD = window.PocketDungeon;
    const STORAGE_KEY = "dungeonState";
    const SIDE_CLICK_DEBOUNCE_MS = 120;
    const LLM_TIMEOUT_MS = 20000;
    const SPEAK_COOLDOWN_MS = 15000;
    const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const hudEl = document.getElementById("hud");
    const hudFloorEl = document.getElementById("hudFloor");
    const hudStatsEl = document.getElementById("hudStats");
    const logEl = document.getElementById("log");
    const panelEl = document.getElementById("panel");
    const panelTitleEl = document.getElementById("panelTitle");
    const panelBodyEl = document.getElementById("panelBody");
    const panelMetaEl = document.getElementById("panelMeta");
    const hintEl = document.getElementById("hint");
    const statusEl = document.getElementById("status");
    const stageEl = document.getElementById("stage");

    let save = PD.createEmptySave();
    let mode = "title";
    let titleIndex = 0;
    let classIndex = 0;
    let invIndex = 0;
    let animFrame = 0;
    let spriteTimer = null;
    let lastSideClickAt = 0;
    let lastShakeAt = 0;
    let lastAccel = null;
    let accelStarted = false;
    let holdTimer = null;
    let holdFired = false;
    let logLines = [];
    let deathLine = "";
    let winLine = "";
    let audioCtx = null;
    let pendingLlmResolve = null;
    let pendingLlmReject = null;
    let pendingLlmKind = null;
    let llmTimeoutId = null;
    let lastDeathSpeakAt = 0;
    let walkTimer = null;
    let walkGen = 0;
    const WALK_STEP_MS = 120;

    function setStatus(text) {
        if (statusEl) {
            statusEl.textContent = text;
        }
    }

    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToUtf8(b64) {
        try {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        } catch (error) {
            return b64;
        }
    }

    async function loadState() {
        try {
            if (window.creationStorage && window.creationStorage.plain) {
                const stored = await window.creationStorage.plain.getItem(STORAGE_KEY);
                if (stored) {
                    const decoded = base64ToUtf8(stored);
                    try {
                        save = PD.applySnapshot(JSON.parse(decoded));
                        return;
                    } catch (error) {
                        save = PD.applySnapshot(JSON.parse(stored));
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn("creationStorage read failed", error);
        }
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                save = PD.applySnapshot(JSON.parse(stored));
            }
        } catch (error) {
            console.warn("localStorage read failed", error);
        }
    }

    async function saveState() {
        const payload = JSON.stringify(PD.snapshot(save));
        try {
            if (window.creationStorage && window.creationStorage.plain) {
                await window.creationStorage.plain.setItem(STORAGE_KEY, utf8ToBase64(payload));
            }
        } catch (error) {
            console.warn("creationStorage write failed", error);
        }
        try {
            window.localStorage.setItem(STORAGE_KEY, payload);
        } catch (error) {
            console.warn("localStorage write failed", error);
        }
    }

    function ensureAudio() {
        if (audioCtx) {
            if (audioCtx.state === "suspended" && audioCtx.resume) {
                audioCtx.resume().catch(function () {});
            }
            return audioCtx;
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) {
            return null;
        }
        try {
            audioCtx = new Ctor();
        } catch (error) {
            audioCtx = null;
        }
        return audioCtx;
    }

    function chirp(freq, duration) {
        const ctxAudio = ensureAudio();
        if (!ctxAudio) {
            return;
        }
        try {
            const t0 = ctxAudio.currentTime;
            const osc = ctxAudio.createOscillator();
            const gain = ctxAudio.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(freq, t0);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
            osc.connect(gain);
            gain.connect(ctxAudio.destination);
            osc.start(t0);
            osc.stop(t0 + duration + 0.02);
        } catch (error) {
            console.warn("chirp failed", error);
        }
    }

    function hasPluginHandler() {
        return typeof PluginMessageHandler !== "undefined" && PluginMessageHandler && PluginMessageHandler.postMessage;
    }

    function stripMarkdownFences(text) {
        return String(text)
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
    }

    function parseLlmJson(data) {
        const sources = [data && data.data, data && data.message, data].filter(function (value) {
            return value != null && value !== "" && typeof value !== "function";
        });
        for (let i = 0; i < sources.length; i += 1) {
            const source = sources[i];
            if (typeof source === "object") {
                if (typeof source.line === "string" && source.line.trim()) {
                    return { line: source.line.trim().slice(0, 80) };
                }
            }
            const raw = String(source).trim();
            const text = stripMarkdownFences(raw);
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
                    return { line: parsed.line.trim().slice(0, 80) };
                }
            } catch (error) {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    try {
                        const parsed = JSON.parse(match[0]);
                        if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
                            return { line: parsed.line.trim().slice(0, 80) };
                        }
                    } catch (inner) {}
                }
            }
            if (raw && !raw.startsWith("<")) {
                const cleaned = raw.replace(/^["']|["']$/g, "").trim();
                if (cleaned) {
                    return { line: cleaned.slice(0, 80) };
                }
            }
        }
        throw new Error("Could not parse LLM JSON");
    }

    function sendLlmRequest(message, wantsVoice, wantsJournal) {
        return new Promise(function (resolve, reject) {
            if (!hasPluginHandler()) {
                reject(new Error("PluginMessageHandler not available"));
                return;
            }
            if (pendingLlmResolve) {
                clearTimeout(llmTimeoutId);
                pendingLlmReject(new Error("Superseded LLM request"));
            }
            pendingLlmResolve = resolve;
            pendingLlmReject = reject;
            llmTimeoutId = setTimeout(function () {
                pendingLlmResolve = null;
                pendingLlmReject = null;
                llmTimeoutId = null;
                reject(new Error("LLM timeout"));
            }, LLM_TIMEOUT_MS);
            try {
                PluginMessageHandler.postMessage(JSON.stringify({
                    message: message,
                    useLLM: true,
                    wantsR1Response: !!wantsVoice,
                    wantsJournalEntry: !!wantsJournal
                }));
            } catch (error) {
                clearTimeout(llmTimeoutId);
                pendingLlmResolve = null;
                pendingLlmReject = null;
                llmTimeoutId = null;
                reject(error);
            }
        });
    }

    window.onPluginMessage = function onPluginMessage(data) {
        if (!pendingLlmResolve) {
            return;
        }
        clearTimeout(llmTimeoutId);
        llmTimeoutId = null;
        const resolve = pendingLlmResolve;
        const reject = pendingLlmReject;
        pendingLlmResolve = null;
        pendingLlmReject = null;
        try {
            resolve(parseLlmJson(data));
        } catch (error) {
            reject(error);
        }
    };

    function roomFlavorPrompt(run) {
        const room = PD.currentRoom(run);
        const foes = room && room.enemies ? room.enemies.map(function (e) {
            return e.type;
        }).join(",") : "none";
        const chest = room && room.chest && !room.chest.open ? "yes" : "no";
        return [
            "You narrate one room of a tiny pixel dungeon on a rabbit R1.",
            "Floor " + run.floor + ", class " + run.classId + ", enemies: " + foes + ", chest: " + chest + ".",
            "Reply ONLY with valid JSON: {\"line\":\"...\"}",
            "The line must be <= 80 characters, terse dark fantasy, no markdown."
        ].join(" ");
    }

    function deathPrompt(run, canned) {
        return [
            "Write a one-line epitaph for a rabbit R1 dungeon crawl.",
            "Class " + run.classId + ", died on floor " + run.floor + ".",
            "Fallback tone: " + canned,
            "Reply ONLY with valid JSON: {\"line\":\"...\"}",
            "The line must be <= 80 characters, no markdown."
        ].join(" ");
    }

    function requestRoomFlavor() {
        if (!save.run || mode !== "play") {
            return;
        }
        const canned = PD.cannedRoomLine(save.run);
        pushLog([canned]);
        render();
        const run = save.run;
        pendingLlmKind = "room";
        sendLlmRequest(roomFlavorPrompt(run), false, false).then(function (parsed) {
            if (pendingLlmKind !== "room" || mode !== "play" || save.run !== run) {
                return;
            }
            if (parsed && parsed.line) {
                pushLog([parsed.line]);
                render();
            }
        }).catch(function (error) {
            console.warn("room flavor llm failed", error);
        });
    }

    function requestDeathFlavor(runSnapshot, canned) {
        pendingLlmKind = "death";
        const now = Date.now();
        if (now - lastDeathSpeakAt < SPEAK_COOLDOWN_MS) {
            return;
        }
        lastDeathSpeakAt = now;
        sendLlmRequest(deathPrompt(runSnapshot, canned), true, true).then(function (parsed) {
            if (!parsed || !parsed.line) {
                return;
            }
            deathLine = parsed.line;
            if (save.meta.epitaphs[0]) {
                save.meta.epitaphs[0].line = parsed.line;
            }
            saveState();
            render();
        }).catch(function (error) {
            console.warn("death flavor llm failed", error);
        });
    }

    function pushLog(entries) {
        for (let i = 0; i < entries.length; i += 1) {
            const line = entries[i];
            if (!line || line === "ENTER") {
                continue;
            }
            logLines.push(line);
        }
        logLines = logLines.slice(-2);
    }

    function titleOptions() {
        if (save.run) {
            return ["CONTINUE", "NEW RUN"];
        }
        return ["START"];
    }

    function drawMap() {
        if (!ctx || !PD.drawRoom) {
            return;
        }
        if (save.run && (mode === "play" || mode === "inventory")) {
            PD.drawRoom(ctx, PD.getDrawState(save.run), animFrame);
            return;
        }
        PD.drawRoom(ctx, {
            tiles: [
                "#######",
                "#.....#",
                "#.....#",
                "#.....#",
                "#.....#",
                "#.....#",
                "#######"
            ],
            hero: { x: 3, y: 3, facing: "S", classId: PD.CLASS_ORDER[classIndex] || "knight" },
            enemies: [{ type: "slime", x: 5, y: 2, hp: 1 }]
        }, animFrame);
    }

    function render() {
        drawMap();
        const playing = mode === "play" || mode === "inventory";
        if (hudEl) {
            hudEl.hidden = !playing || !save.run;
        }
        if (logEl) {
            logEl.hidden = !playing;
            logEl.textContent = logLines.join("\n");
        }
        if (save.run && hudFloorEl && hudStatsEl) {
            hudFloorEl.textContent = "FL" + save.run.floor;
            hudStatsEl.textContent = "HP " + save.run.hp + "/" + save.run.maxHp + "  G" + save.run.gold;
        }

        const showPanel = mode !== "play";
        if (panelEl) {
            panelEl.hidden = !showPanel;
        }

        if (mode === "title") {
            const opts = titleOptions();
            titleIndex = titleIndex % opts.length;
            panelTitleEl.textContent = "POCKET DUNGEON";
            panelBodyEl.textContent = opts.map(function (opt, i) {
                return (i === titleIndex ? "> " : "  ") + opt;
            }).join("\n");
            panelMetaEl.textContent = save.meta.bestFloor
                ? "BEST FL" + save.meta.bestFloor
                : "PERMADEATH";
            hintEl.textContent = save.run ? "scroll: choose · side: go" : "side: start · scroll: class later";
        } else if (mode === "class") {
            const id = PD.CLASS_ORDER[classIndex];
            const cls = PD.CLASSES[id];
            panelTitleEl.textContent = cls.name;
            panelBodyEl.textContent = "HP " + cls.hp + "  ATK " + cls.atk + "  DEF " + cls.def;
            panelMetaEl.textContent = "SIDE TO DESCEND";
            hintEl.textContent = "scroll: class · side: go";
        } else if (mode === "inventory") {
            panelTitleEl.textContent = "PACK " + (save.run ? save.run.pack.length : 0) + "/" + PD.PACK_MAX;
            if (!save.run || !save.run.pack.length) {
                panelBodyEl.textContent = "EMPTY";
                panelMetaEl.textContent = "SIDE TO CLOSE";
            } else {
                panelBodyEl.textContent = save.run.pack.map(function (id, i) {
                    return (i === invIndex ? "> " : "  ") + id.toUpperCase();
                }).join("\n");
                panelMetaEl.textContent = "SIDE: USE · HOLD: CLOSE";
            }
            hintEl.textContent = "scroll: slot · side: use · hold: close";
        } else if (mode === "dead") {
            panelTitleEl.textContent = "YOU DIED";
            panelBodyEl.textContent = deathLine || "THE DUNGEON KEEPS THEM.";
            panelMetaEl.textContent = "SIDE TO RETURN";
            hintEl.textContent = "side: title";
        } else if (mode === "win") {
            panelTitleEl.textContent = "YOU ESCAPE";
            panelBodyEl.textContent = winLine || PD.cannedWinLine();
            panelMetaEl.textContent = "SIDE TO RETURN";
            hintEl.textContent = "side: title";
        } else if (mode === "play" && save.run) {
            hintEl.textContent = "tap: go · side: wait · hold: pack";
        }
        setStatus(hintEl ? hintEl.textContent : "");
    }

    function beginRun(classId) {
        stopWalk();
        save.run = PD.createRun(classId);
        mode = "play";
        invIndex = 0;
        logLines = [];
        saveState();
        chirp(520, 0.05);
        requestRoomFlavor();
        render();
    }

    function stopWalk() {
        walkGen += 1;
        if (walkTimer) {
            clearTimeout(walkTimer);
            walkTimer = null;
        }
    }

    function eventToTile(event) {
        if (!canvas) {
            return null;
        }
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        if (px < 0 || py < 0 || px >= rect.width || py >= rect.height) {
            return null;
        }
        const x = Math.floor((px / rect.width) * PD.MAP_SIZE);
        const y = Math.floor((py / rect.height) * PD.MAP_SIZE);
        if (x < 0 || y < 0 || x >= PD.MAP_SIZE || y >= PD.MAP_SIZE) {
            return null;
        }
        return { x: x, y: y };
    }

    function playActResult(result) {
        const sfx = result && result.logs && result.logs.some(function (line) {
            return line.indexOf("HIT") === 0 || line.indexOf(" DOWN") !== -1;
        }) ? "hit" : "step";
        applyResult(result, result && result.blocked ? null : sfx);
        return result;
    }

    function walkSteps(steps, gen) {
        if (gen !== walkGen || mode !== "play" || !save.run || !steps.length) {
            return;
        }
        const next = steps[0];
        PD.faceTile(save.run, next.x, next.y);
        const result = playActResult(PD.tryAct(save.run));
        const rest = steps.slice(1);
        if (
            !rest.length ||
            !result ||
            !result.ok ||
            result.blocked ||
            result.died ||
            result.won ||
            result.roomChanged ||
            (result.logs && result.logs.some(function (line) {
                return line.indexOf("HIT") === 0;
            }))
        ) {
            return;
        }
        walkTimer = setTimeout(function () {
            walkSteps(rest, gen);
        }, WALK_STEP_MS);
    }

    function onCanvasClick(event) {
        event.stopPropagation();
        event.preventDefault();
        if (mode !== "play") {
            onSideClick();
            return;
        }
        if (holdFired) {
            holdFired = false;
            lastSideClickAt = Date.now();
            return;
        }
        const now = Date.now();
        if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
            return;
        }
        lastSideClickAt = now;
        if (!save.run) {
            return;
        }
        stopWalk();
        const tile = eventToTile(event);
        if (!tile) {
            return;
        }
        const path = PD.pathTo(save.run, tile.x, tile.y);
        if (path === "wait") {
            playActResult(PD.waitTurn(save.run));
            return;
        }
        if (!path || !path.length) {
            pushLog(["BLOCKED"]);
            render();
            return;
        }
        walkSteps(path, walkGen);
    }

    function applyResult(result, sfx) {
        if (!result) {
            return;
        }
        pushLog(result.logs || []);
        if (sfx === "hit") {
            chirp(180, 0.07);
        } else if (sfx === "step") {
            chirp(420, 0.03);
        } else if (sfx === "item") {
            chirp(660, 0.05);
        }
        if (result.died && save.run) {
            stopWalk();
            const runCopy = {
                classId: save.run.classId,
                floor: save.run.floor
            };
            deathLine = PD.cannedDeathLine(save.run);
            PD.recordDeath(save, deathLine);
            mode = "dead";
            chirp(110, 0.18);
            saveState();
            requestDeathFlavor(runCopy, deathLine);
            render();
            return;
        }
        if (result.won) {
            stopWalk();
            winLine = PD.cannedWinLine();
            PD.recordWin(save);
            mode = "win";
            chirp(784, 0.12);
            saveState();
            render();
            return;
        }
        if (result.ok) {
            saveState();
        }
        if (result.roomChanged && save.run) {
            requestRoomFlavor();
        }
        render();
    }

    function onScroll(delta) {
        if (mode === "title") {
            const opts = titleOptions();
            titleIndex = (titleIndex + delta + opts.length) % opts.length;
            render();
            return;
        }
        if (mode === "class") {
            classIndex = (classIndex + delta + PD.CLASS_ORDER.length) % PD.CLASS_ORDER.length;
            render();
            return;
        }
        if (mode === "inventory" && save.run && save.run.pack.length) {
            invIndex = (invIndex + delta + save.run.pack.length) % save.run.pack.length;
            render();
            return;
        }
        if (mode === "play" && save.run) {
            PD.cycleFacing(save.run, delta);
            render();
        }
    }

    function onSideClick() {
        stopWalk();
        if (holdFired) {
            holdFired = false;
            lastSideClickAt = Date.now();
            return;
        }
        const now = Date.now();
        if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
            return;
        }
        lastSideClickAt = now;

        if (mode === "title") {
            const opts = titleOptions();
            const choice = opts[titleIndex] || opts[0];
            if (choice === "CONTINUE" && save.run) {
                mode = "play";
                logLines = [PD.cannedRoomLine(save.run)];
                render();
                return;
            }
            if (choice === "NEW RUN") {
                save.run = null;
                saveState();
            }
            mode = "class";
            classIndex = 0;
            render();
            return;
        }
        if (mode === "class") {
            beginRun(PD.CLASS_ORDER[classIndex]);
            return;
        }
        if (mode === "dead" || mode === "win") {
            mode = "title";
            titleIndex = 0;
            render();
            return;
        }
        if (mode === "inventory") {
            if (!save.run || !save.run.pack.length) {
                mode = "play";
                render();
                return;
            }
            const result = PD.useItem(save.run, invIndex);
            if (save.run.pack.length) {
                invIndex = Math.min(invIndex, save.run.pack.length - 1);
            } else {
                mode = "play";
            }
            applyResult(result, "item");
            return;
        }
        if (mode === "play" && save.run) {
            applyResult(PD.waitTurn(save.run), "step");
        }
    }

    function onLongPress() {
        stopWalk();
        if (mode === "play") {
            invIndex = 0;
            mode = "inventory";
            render();
            return;
        }
        if (mode === "inventory") {
            mode = "play";
            render();
        }
    }

    function onShake() {
        stopWalk();
        const now = Date.now();
        if (now - lastShakeAt < 700) {
            return;
        }
        lastShakeAt = now;
        if (mode !== "play" || !save.run) {
            return;
        }
        applyResult(PD.waitTurn(save.run), "step");
    }

    function maybeShake(data) {
        if (!data) {
            return;
        }
        const x = Number(data.x) || 0;
        const y = Number(data.y) || 0;
        const z = Number(data.z) || 0;
        if (!lastAccel) {
            lastAccel = { x: x, y: y, z: z };
            return;
        }
        const mag = Math.abs(x - lastAccel.x) + Math.abs(y - lastAccel.y) + Math.abs(z - lastAccel.z);
        lastAccel = { x: x, y: y, z: z };
        if (mag > 0.85) {
            onShake();
        }
    }

    async function startAccel() {
        const accel = window.creationSensors && window.creationSensors.accelerometer;
        if (!accel || accelStarted) {
            return;
        }
        try {
            const available = await accel.isAvailable();
            if (!available) {
                return;
            }
            accel.start(maybeShake, { frequency: 30 });
            accelStarted = true;
        } catch (error) {
            console.warn("accelerometer start failed", error);
        }
    }

    function stopAccel() {
        const accel = window.creationSensors && window.creationSensors.accelerometer;
        if (accel && accelStarted && accel.stop) {
            try {
                accel.stop();
            } catch (error) {}
        }
        accelStarted = false;
    }

    function startSpriteLoop() {
        if (REDUCED_MOTION || spriteTimer) {
            return;
        }
        spriteTimer = setInterval(function () {
            animFrame = animFrame ? 0 : 1;
            if (mode === "play" || mode === "title" || mode === "class") {
                drawMap();
            }
        }, 750);
    }

    function stopSpriteLoop() {
        if (spriteTimer) {
            clearInterval(spriteTimer);
            spriteTimer = null;
        }
    }

    function persistAndPause() {
        stopWalk();
        saveState();
        stopAccel();
        stopSpriteLoop();
    }

    function initializeHardware() {
        window.addEventListener("scrollUp", function () {
            onScroll(-1);
        });
        window.addEventListener("scrollDown", function () {
            onScroll(1);
        });
        window.addEventListener("sideClick", onSideClick);
        window.addEventListener("longPressStart", onLongPress);
    }

    function initializeFallback() {
        if (canvas) {
            canvas.addEventListener("click", onCanvasClick);
        }
        if (stageEl) {
            stageEl.addEventListener("click", function (event) {
                event.preventDefault();
                onSideClick();
            });
            stageEl.addEventListener("pointerdown", function () {
                holdFired = false;
                if (holdTimer) {
                    clearTimeout(holdTimer);
                }
                holdTimer = setTimeout(function () {
                    holdFired = true;
                    holdTimer = null;
                    onLongPress();
                }, 500);
            });
            stageEl.addEventListener("pointerup", function () {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
            });
            stageEl.addEventListener("pointercancel", function () {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
            });
        }
        window.addEventListener("wheel", function (event) {
            event.preventDefault();
            onScroll(event.deltaY > 0 ? 1 : -1);
        }, { passive: false });
        window.addEventListener("keydown", function (event) {
            const key = event.key;
            if (key === "ArrowUp" || key === "w" || key === "W") {
                if (mode === "play" && save.run) {
                    save.run.facing = "N";
                    render();
                } else {
                    onScroll(-1);
                }
                event.preventDefault();
            } else if (key === "ArrowDown" || key === "s" || key === "S") {
                if (mode === "play" && save.run) {
                    save.run.facing = "S";
                    render();
                } else {
                    onScroll(1);
                }
                event.preventDefault();
            } else if (key === "ArrowLeft" || key === "a" || key === "A") {
                if (mode === "play" && save.run) {
                    save.run.facing = "W";
                    render();
                } else {
                    onScroll(-1);
                }
                event.preventDefault();
            } else if (key === "ArrowRight" || key === "d" || key === "D") {
                if (mode === "play" && save.run) {
                    save.run.facing = "E";
                    render();
                } else {
                    onScroll(1);
                }
                event.preventDefault();
            } else if (key === "Enter") {
                onSideClick();
                event.preventDefault();
            } else if (key === " ") {
                if (mode === "play") {
                    onShake();
                } else {
                    onSideClick();
                }
                event.preventDefault();
            } else if (key === "Escape") {
                onLongPress();
                event.preventDefault();
            }
        });
    }

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            persistAndPause();
        } else {
            startAccel();
            startSpriteLoop();
            render();
        }
    });

    async function boot() {
        if (PD.bakeAll) {
            PD.bakeAll();
        }
        await loadState();
        titleIndex = 0;
        initializeHardware();
        initializeFallback();
        startAccel();
        startSpriteLoop();
        render();
    }

    boot().catch(function (error) {
        console.warn("boot failed", error);
        render();
    });
})();
