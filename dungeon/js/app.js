(function () {
    const PD = window.PocketDungeon;
    const WORLD = window.PocketDungeonWorld;
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
    let townIndex = 0;
    let townMenu = [];
    let talkPhase = "npcs";
    let talkNpc = null;
    let shopNote = "";
    let packReturn = "play";
    let journalFrom = "town";
    let titleIndex = 0;
    let classIndex = 0;
    let invIndex = 0;
    let graveIndex = 0;
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
    let clearLine = "";
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

    function triggerStageFx(fxClass) {
        if (!stageEl || REDUCED_MOTION) {
            return;
        }
        stageEl.classList.remove("hit-flash", "heal-flash", "screen-shake");
        void stageEl.offsetWidth;
        stageEl.classList.add(fxClass);
        setTimeout(function () {
            if (stageEl) {
                stageEl.classList.remove(fxClass);
            }
        }, 260);
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

    function playSfx(type) {
        const ctxAudio = ensureAudio();
        if (!ctxAudio) {
            return;
        }
        try {
            const t0 = ctxAudio.currentTime;
            const osc = ctxAudio.createOscillator();
            const gain = ctxAudio.createGain();
            osc.connect(gain);
            gain.connect(ctxAudio.destination);

            if (type === "step") {
                osc.type = "sine";
                osc.frequency.setValueAtTime(320, t0);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.04, t0 + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
                osc.start(t0);
                osc.stop(t0 + 0.035);
            } else if (type === "hit") {
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(220, t0);
                osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.08, t0 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
                osc.start(t0);
                osc.stop(t0 + 0.09);
            } else if (type === "damage") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(130, t0);
                osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.12, t0 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
                osc.start(t0);
                osc.stop(t0 + 0.13);
            } else if (type === "trap") {
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(280, t0);
                osc.frequency.linearRampToValueAtTime(140, t0 + 0.1);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.09, t0 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
                osc.start(t0);
                osc.stop(t0 + 0.11);
            } else if (type === "chest") {
                osc.type = "square";
                osc.frequency.setValueAtTime(523.25, t0);
                osc.frequency.setValueAtTime(659.25, t0 + 0.04);
                osc.frequency.setValueAtTime(783.99, t0 + 0.08);
                osc.frequency.setValueAtTime(1046.50, t0 + 0.12);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.06, t0 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
                osc.start(t0);
                osc.stop(t0 + 0.23);
            } else if (type === "heal") {
                osc.type = "sine";
                osc.frequency.setValueAtTime(440, t0);
                osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.15);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.08, t0 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
                osc.start(t0);
                osc.stop(t0 + 0.19);
            } else if (type === "buff") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(350, t0);
                osc.frequency.exponentialRampToValueAtTime(700, t0 + 0.14);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
                osc.start(t0);
                osc.stop(t0 + 0.17);
            } else if (type === "floor") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(260, t0);
                osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.25);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
                osc.start(t0);
                osc.stop(t0 + 0.3);
            } else if (type === "win") {
                osc.type = "square";
                osc.frequency.setValueAtTime(523.25, t0);
                osc.frequency.setValueAtTime(659.25, t0 + 0.08);
                osc.frequency.setValueAtTime(783.99, t0 + 0.16);
                osc.frequency.setValueAtTime(1046.50, t0 + 0.24);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.08, t0 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
                osc.start(t0);
                osc.stop(t0 + 0.48);
            } else if (type === "death") {
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(220, t0);
                osc.frequency.setValueAtTime(185, t0 + 0.1);
                osc.frequency.setValueAtTime(147, t0 + 0.2);
                osc.frequency.setValueAtTime(110, t0 + 0.3);
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
                osc.start(t0);
                osc.stop(t0 + 0.48);
            } else {
                chirp(420, 0.03);
            }
        } catch (error) {
            console.warn("playSfx failed", error);
        }
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

    function winPrompt(run, canned) {
        return [
            "Write a triumphant one-line victory chronicle for a rabbit R1 dungeon crawl.",
            "Class " + run.classId + ", defeated the Floor " + PD.MAX_FLOOR + " Ogre and escaped alive with " + run.gold + " gold.",
            "Fallback tone: " + canned,
            "Reply ONLY with valid JSON: {\"line\":\"...\"}",
            "The line must be <= 80 characters, glorious fantasy, no markdown."
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

    function requestWinFlavor(runSnapshot, canned) {
        pendingLlmKind = "win";
        const now = Date.now();
        if (now - lastDeathSpeakAt < SPEAK_COOLDOWN_MS) {
            return;
        }
        lastDeathSpeakAt = now;
        sendLlmRequest(winPrompt(runSnapshot, canned), true, true).then(function (parsed) {
            if (!parsed || !parsed.line) {
                return;
            }
            winLine = parsed.line;
            render();
        }).catch(function (error) {
            console.warn("win flavor llm failed", error);
        });
    }

    function requestTalkFlavor(npcId, node) {
        if (!node || !node.ifAll || !hasPluginHandler()) {
            return;
        }
        const canned = (node.lines && node.lines[0]) || "";
        pendingLlmKind = "talk";
        sendLlmRequest([
            "Flavor one extra spoken line for a tiny pixel RPG on a rabbit R1.",
            "NPC: " + npcId + ". Quest already resolved. Tone: " + canned,
            "Reply ONLY with valid JSON: {\"line\":\"...\"}",
            "The line must be <= 80 characters, terse dark fantasy, no markdown."
        ].join(" "), false, false).then(function (parsed) {
            if (pendingLlmKind !== "talk" || mode !== "talk" || !parsed || !parsed.line) {
                return;
            }
            if (panelMetaEl) {
                panelMetaEl.textContent = parsed.line.slice(0, 80);
            }
        }).catch(function (error) {
            console.warn("talk flavor llm failed", error);
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
        const opts = [];
        if (save.hero) {
            opts.push("CONTINUE", "NEW SAVE");
        } else {
            opts.push("START");
        }
        if ((save.meta.journal && save.meta.journal.length) || (save.meta.epitaphs && save.meta.epitaphs.length)) {
            opts.push("JOURNAL");
        }
        return opts;
    }

    function refreshTownMenu() {
        townMenu = WORLD.townMenu(save);
        if (!townMenu.length) {
            townIndex = 0;
            return;
        }
        townIndex = ((townIndex % townMenu.length) + townMenu.length) % townMenu.length;
    }

    function currentActor() {
        return save.run || save.hero;
    }

    function openInventory(fromMode) {
        packReturn = fromMode || (save.run ? "play" : "town");
        invIndex = 0;
        mode = "inventory";
        render();
    }

    function closeInventory() {
        mode = packReturn || (save.run ? "play" : "town");
        packReturn = save.run ? "play" : "town";
        render();
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
            const isLowHp = save.run.hp <= Math.ceil(save.run.maxHp * 0.25);
            hudStatsEl.classList.toggle("hp-critical", isLowHp);
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
            panelMetaEl.textContent = "THREE TOWNS · A BROKEN ROAD";
            hintEl.textContent = "scroll: choose · side: select";
        } else if (mode === "class") {
            const id = PD.CLASS_ORDER[classIndex];
            const cls = PD.CLASSES[id];
            panelTitleEl.textContent = cls.name;
            panelBodyEl.textContent = "HP " + cls.hp + "  ATK " + cls.atk + "  DEF " + cls.def + "\n" + (cls.desc || "");
            panelMetaEl.textContent = "SIDE TO BEGIN";
            hintEl.textContent = "scroll: class · side: go";
        } else if (mode === "town") {
            refreshTownMenu();
            const town = WORLD.towns[save.location.id] || WORLD.towns.ashford;
            panelTitleEl.textContent = town.name;
            panelBodyEl.textContent = townMenu.map(function (option, i) {
                return (i === townIndex ? "> " : "  ") + option.label;
            }).join("\n");
            panelMetaEl.textContent = shopNote || ("HP " + save.hero.hp + "/" + save.hero.maxHp + "  G" + save.hero.gold);
            hintEl.textContent = "scroll: choose · side: select · hold: pack";
        } else if (mode === "travel") {
            const from = save.location.id;
            panelTitleEl.textContent = "ROAD";
            panelBodyEl.textContent = WORLD.TRAVEL_ORDER.map(function (id, i) {
                return (i === townIndex ? "> " : "  ") + WORLD.travelLabel(save, from, id);
            }).join("\n");
            panelMetaEl.textContent = "SIDE TO TRAVEL · HOLD TO RETURN";
            hintEl.textContent = "scroll: destination · side: travel";
        } else if (mode === "shop") {
            const stock = WORLD.shops[save.location.id] || [];
            panelTitleEl.textContent = "SHOP";
            if (!stock.length) {
                panelBodyEl.textContent = "CLOSED";
            } else {
                panelBodyEl.textContent = stock.map(function (item, i) {
                    return (i === townIndex ? "> " : "  ") + item.name + " G" + item.price;
                }).join("\n");
            }
            panelMetaEl.textContent = shopNote || ("G" + save.hero.gold + " · SIDE TO BUY · HOLD TO RETURN");
            hintEl.textContent = "scroll: item · side: buy";
        } else if (mode === "journal") {
            panelTitleEl.textContent = "JOURNAL";
            panelBodyEl.textContent = (save.meta.journal || []).slice(0, 4).join("\n") || "NO ENTRIES YET.";
            panelMetaEl.textContent = "SIDE TO RETURN";
            hintEl.textContent = "side: back";
        } else if (mode === "talk") {
            if (talkPhase === "npcs") {
                const npcs = (WORLD.towns[save.location.id] || WORLD.towns.ashford).npcs;
                panelTitleEl.textContent = "TALK";
                panelBodyEl.textContent = npcs.map(function (id, i) {
                    return (i === townIndex ? "> " : "  ") + WORLD.npcName(id);
                }).join("\n");
                panelMetaEl.textContent = "SIDE TO SPEAK · HOLD TO RETURN";
                hintEl.textContent = "scroll: person · side: talk";
            } else {
                const node = WORLD.getDialogue(talkNpc, save.flags);
                panelTitleEl.textContent = WORLD.npcName(talkNpc);
                const lines = (node && node.lines) || ["..."];
                const choices = (node && node.choices) || [{ id: "leave", label: "LEAVE" }];
                panelBodyEl.textContent = lines.join("\n") + "\n" + choices.map(function (choice, i) {
                    return (i === townIndex ? "> " : "  ") + choice.label;
                }).join("\n");
                panelMetaEl.textContent = "SIDE TO CHOOSE · HOLD TO RETURN";
                hintEl.textContent = "scroll: choice · side: confirm";
            }
        } else if (mode === "wake") {
            const inn = WORLD.towns[save.hero && save.hero.lastInn] || WORLD.towns.ashford;
            panelTitleEl.textContent = "YOU WAKE";
            panelBodyEl.textContent = (deathLine || "THE DUNGEON SPITS YOU OUT.") + "\n" + inn.name + " INN.";
            panelMetaEl.textContent = "GOLD HALVED · SIDE TO RISE";
            hintEl.textContent = "side: town";
        } else if (mode === "clear") {
            panelTitleEl.textContent = "SITE CLEAR";
            panelBodyEl.textContent = clearLine || "THE ROAD CHANGES.";
            panelMetaEl.textContent = "SIDE TO RETURN";
            hintEl.textContent = "side: town";
        } else if (mode === "finale") {
            panelTitleEl.textContent = "THE ROAD OPENS";
            panelBodyEl.textContent = winLine || WORLD.endings.hold;
            panelMetaEl.textContent = "SIDE TO KEEPGATE";
            hintEl.textContent = "side: town";
        } else if (mode === "graveyard") {
            const count = save.meta.epitaphs.length;
            if (!count) {
                mode = "title";
                render();
                return;
            }
            graveIndex = ((graveIndex % count) + count) % count;
            const entry = save.meta.epitaphs[graveIndex];
            const clsName = PD.CLASSES[entry.classId] ? PD.CLASSES[entry.classId].name : String(entry.classId).toUpperCase();
            panelTitleEl.textContent = "FALLEN (" + (graveIndex + 1) + "/" + count + ")";
            panelBodyEl.textContent = "FL" + entry.floor + " " + clsName + "\n\n\"" + entry.line + "\"";
            panelMetaEl.textContent = "SIDE TO RETURN";
            hintEl.textContent = "scroll: hero · side: back";
        } else if (mode === "inventory") {
            const actor = currentActor();
            const pack = actor && actor.pack ? actor.pack : [];
            panelTitleEl.textContent = "PACK " + pack.length + "/" + PD.PACK_MAX + (actor ? " · HP " + actor.hp + "/" + actor.maxHp : "");
            if (!pack.length) {
                panelBodyEl.textContent = "EMPTY";
                panelMetaEl.textContent = "SIDE TO CLOSE";
            } else {
                panelBodyEl.textContent = pack.map(function (id, i) {
                    const info = (PD.ITEM_INFO && PD.ITEM_INFO[id]) || { name: id.toUpperCase(), effect: "" };
                    const suffix = info.effect ? " (" + info.effect + ")" : "";
                    return (i === invIndex ? "> " : "  ") + info.name + suffix;
                }).join("\n");
                panelMetaEl.textContent = "SIDE: USE · HOLD: CLOSE";
            }
            hintEl.textContent = "scroll: slot · side: use · hold: close";
        } else if (mode === "dead") {
            panelTitleEl.textContent = "YOU WAKE";
            panelBodyEl.textContent = deathLine || "THE DUNGEON SPITS YOU OUT.";
            panelMetaEl.textContent = "SIDE TO RISE";
            hintEl.textContent = "side: town";
        } else if (mode === "win") {
            panelTitleEl.textContent = "THE ROAD OPENS";
            panelBodyEl.textContent = winLine || (WORLD.endings && WORLD.endings.hold) || PD.cannedWinLine();
            panelMetaEl.textContent = "SIDE TO KEEPGATE";
            hintEl.textContent = "side: town";
        } else if (mode === "play" && save.run) {
            hintEl.textContent = "tap: go · side: wait · hold: pack";
        }
        setStatus(hintEl ? hintEl.textContent : "");
    }

    function enterSite(siteId) {
        stopWalk();
        if (save.site && save.site.siteId === siteId) {
            save.run = save.site;
        } else {
            save.site = PD.createSiteRun(save.hero, siteId, null, save.flags);
            save.run = save.site;
        }
        save.location = { kind: "site", id: siteId };
        mode = "play";
        invIndex = 0;
        logLines = [PD.cannedRoomLine(save.run)];
        saveState();
        playSfx("floor");
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
        applyResult(result, null);
        return result;
    }

    function walkSteps(steps, gen) {
        if (gen !== walkGen || mode !== "play" || !save.run || !steps.length) {
            return;
        }
        const prevHp = save.run.hp;
        const next = steps[0];
        PD.faceTile(save.run, next.x, next.y);
        const result = playActResult(PD.tryAct(save.run));
        const rest = steps.slice(1);
        const tookDamage = save.run && save.run.hp < prevHp;
        const hasInterruptLog = result && result.logs && result.logs.some(function (line) {
            return line.indexOf("HIT") !== -1 || line.indexOf("TRAP") !== -1 || line.indexOf("DOWN") !== -1;
        });
        if (
            !rest.length ||
            !result ||
            !result.ok ||
            result.blocked ||
            result.died ||
            result.won ||
            result.roomChanged ||
            result.floorChanged ||
            tookDamage ||
            hasInterruptLog
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
            applyResult(PD.waitTurn(save.run), "step");
            return;
        }
        if (!path || !path.length) {
            pushLog(["BLOCKED"]);
            render();
            return;
        }
        walkSteps(path, walkGen);
    }

    function applyResult(result, fallbackSfx) {
        if (!result) {
            return;
        }
        const prevHp = save.run ? save.run.hp : 0;
        pushLog(result.logs || []);

        const logs = result.logs || [];
        const tookDamage = save.run && save.run.hp < prevHp;
        const healed = save.run && save.run.hp > prevHp;
        const hitEnemy = logs.some(function (l) { return l.indexOf("HIT") === 0; });
        const hitTrap = logs.some(function (l) { return l.indexOf("TRAP") === 0; });
        const gotChest = logs.some(function (l) { return l.indexOf("OPEN") === 0; });
        const usedItem = logs.some(function (l) { return l.indexOf("USED") === 0; });

        if (tookDamage) {
            triggerStageFx("hit-flash");
            playSfx(hitTrap ? "trap" : "damage");
        } else if (healed) {
            triggerStageFx("heal-flash");
            playSfx("heal");
        } else if (gotChest) {
            playSfx("chest");
        } else if (usedItem) {
            playSfx("buff");
        } else if (hitEnemy) {
            playSfx("hit");
        } else if (result.floorChanged || result.roomChanged) {
            playSfx("floor");
        } else if (fallbackSfx) {
            playSfx(fallbackSfx);
        } else if (result.ok && !result.blocked) {
            playSfx("step");
        }

        if (result.died && save.run) {
            stopWalk();
            const runCopy = {
                classId: save.run.classId,
                floor: save.run.floor
            };
            deathLine = PD.cannedDeathLine(save.run);
            PD.recordDeath(save, deathLine);
            mode = "wake";
            playSfx("death");
            saveState();
            requestDeathFlavor(runCopy, deathLine);
            render();
            return;
        }
        if (result.siteCleared) {
            stopWalk();
            const completed = WORLD.completeSite(save, result.siteCleared);
            clearLine = (completed && completed.line) || WORLD.endings[result.siteCleared] || "THE ROAD CHANGES.";
            if (result.siteCleared === "hold") {
                winLine = clearLine;
                mode = "finale";
                playSfx("win");
                saveState();
                requestWinFlavor({
                    classId: save.hero && save.hero.classId,
                    floor: PD.MAX_FLOOR,
                    gold: save.hero && save.hero.gold
                }, winLine);
            } else {
                mode = "clear";
                playSfx("win");
                saveState();
            }
            render();
            return;
        }
        if (result.won && save.run) {
            stopWalk();
            WORLD.completeSite(save, "hold");
            winLine = WORLD.endings.hold || PD.cannedWinLine();
            mode = "finale";
            playSfx("win");
            saveState();
            requestWinFlavor({
                classId: save.hero && save.hero.classId,
                floor: PD.MAX_FLOOR,
                gold: save.hero && save.hero.gold
            }, winLine);
            render();
            return;
        }
        if (result.ok) {
            if (save.hero && save.run) {
                save.hero.hp = save.run.hp;
                save.hero.gold = save.run.gold;
                save.hero.atk = save.run.atk;
                save.hero.def = save.run.def;
                save.hero.pack = save.run.pack.slice();
            }
            save.site = save.run;
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
        if (mode === "town") {
            refreshTownMenu();
            shopNote = "";
            townIndex = (townIndex + delta + townMenu.length) % townMenu.length;
            render();
            return;
        }
        if (mode === "travel") {
            townIndex = (townIndex + delta + WORLD.TRAVEL_ORDER.length) % WORLD.TRAVEL_ORDER.length;
            render();
            return;
        }
        if (mode === "shop") {
            const stock = WORLD.shops[save.location.id] || [];
            if (!stock.length) {
                return;
            }
            townIndex = (townIndex + delta + stock.length) % stock.length;
            shopNote = "";
            render();
            return;
        }
        if (mode === "talk") {
            if (talkPhase === "npcs") {
                const npcs = (WORLD.towns[save.location.id] || WORLD.towns.ashford).npcs;
                townIndex = (townIndex + delta + npcs.length) % npcs.length;
            } else {
                const node = WORLD.getDialogue(talkNpc, save.flags);
                const choices = (node && node.choices) || [{ id: "leave", label: "LEAVE" }];
                townIndex = (townIndex + delta + choices.length) % choices.length;
            }
            render();
            return;
        }
        if (mode === "graveyard" && save.meta.epitaphs && save.meta.epitaphs.length) {
            const count = save.meta.epitaphs.length;
            graveIndex = (graveIndex + delta + count) % count;
            render();
            return;
        }
        if (mode === "inventory") {
            const actor = currentActor();
            if (actor && actor.pack && actor.pack.length) {
                invIndex = (invIndex + delta + actor.pack.length) % actor.pack.length;
                render();
            }
            return;
        }
        if (mode === "play" && save.run) {
            PD.cycleFacing(save.run, delta);
            render();
        }
    }

    function wipeHero() {
        save.run = null;
        save.site = null;
        save.hero = null;
        save.flags = {};
        save.location = { kind: "town", id: "ashford" };
        saveState();
    }

    function returnToTown() {
        mode = "town";
        townIndex = 0;
        shopNote = "";
        talkNpc = null;
        talkPhase = "npcs";
        render();
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
            if (choice === "CONTINUE" && save.hero) {
                save.run = save.site || save.run;
                if (save.run) {
                    mode = "play";
                    logLines = [PD.cannedRoomLine(save.run)];
                } else {
                    mode = "town";
                    townIndex = 0;
                }
                render();
                return;
            }
            if (choice === "JOURNAL") {
                journalFrom = "title";
                mode = "journal";
                render();
                return;
            }
            if (choice === "NEW SAVE") {
                wipeHero();
            }
            mode = "class";
            classIndex = 0;
            render();
            return;
        }
        if (mode === "class") {
            const classId = PD.CLASS_ORDER[classIndex];
            const cls = PD.CLASSES[classId];
            save.hero = {
                classId: classId,
                hp: cls.hp,
                maxHp: cls.hp,
                atk: cls.atk,
                def: cls.def,
                gold: classId === "scout" ? 15 : 0,
                pack: classId === "scout" ? ["potion"] : (classId === "mage" ? ["blade"] : []),
                lastInn: "ashford"
            };
            save.flags = {};
            save.location = { kind: "town", id: "ashford" };
            save.site = null;
            save.run = null;
            mode = "town";
            townIndex = 0;
            saveState();
            render();
            return;
        }
        if (mode === "town") {
            refreshTownMenu();
            const option = townMenu[townIndex];
            if (!option) {
                return;
            }
            if (option.id === "talk") {
                talkPhase = "npcs";
                talkNpc = null;
                townIndex = 0;
                mode = "talk";
                render();
                return;
            }
            if (option.id === "inn") {
                WORLD.restAtInn(save.hero, save.location.id);
                saveState();
                render();
                return;
            }
            if (option.id === "shop") {
                shopNote = "";
                townIndex = 0;
                mode = "shop";
                render();
                return;
            }
            if (option.id === "road") {
                townIndex = Math.max(0, WORLD.TRAVEL_ORDER.indexOf(save.location.id));
                mode = "travel";
                render();
                return;
            }
            if (option.id === "journal") {
                journalFrom = "town";
                mode = "journal";
                render();
                return;
            }
            if (option.id === "pack") {
                openInventory("town");
                return;
            }
            if (option.id === "site") {
                const unlocked = WORLD.availableSites(save, save.location.id);
                if (!unlocked.length) {
                    shopNote = "NO SITE OPEN";
                    render();
                    return;
                }
                enterSite(unlocked[0]);
                return;
            }
            return;
        }
        if (mode === "travel") {
            const destination = WORLD.TRAVEL_ORDER[townIndex];
            if (WORLD.canTravel(save, save.location.id, destination)) {
                save.location = { kind: "town", id: destination };
                save.hero.lastInn = destination;
                mode = "town";
                townIndex = 0;
            }
            saveState();
            render();
            return;
        }
        if (mode === "shop") {
            const stock = WORLD.shops[save.location.id] || [];
            const item = stock[townIndex];
            if (item) {
                const bought = WORLD.buy(save.hero, item.id, save.location.id);
                shopNote = bought.ok ? ("BOUGHT " + item.name) : (bought.reason || "NO SALE");
            }
            saveState();
            render();
            return;
        }
        if (mode === "journal") {
            mode = journalFrom === "title" ? "title" : "town";
            render();
            return;
        }
        if (mode === "talk") {
            const town = WORLD.towns[save.location.id] || WORLD.towns.ashford;
            if (talkPhase === "npcs") {
                talkNpc = town.npcs[townIndex] || town.npcs[0];
                talkPhase = "node";
                townIndex = 0;
                const node = WORLD.getDialogue(talkNpc, save.flags);
                if (node && node.ifAll) {
                    requestTalkFlavor(talkNpc, node);
                }
                render();
                return;
            }
            const node = WORLD.getDialogue(talkNpc, save.flags);
            const choice = node && node.choices && node.choices[townIndex];
            if (!choice) {
                returnToTown();
                return;
            }
            const result = WORLD.advanceDialogue({
                dialogueId: talkNpc,
                flags: save.flags,
                hero: save.hero,
                meta: save.meta
            }, choice.id);
            if (result.ok) {
                save.flags = result.state.flags;
                save.hero = result.state.hero || save.hero;
                save.meta = result.state.meta || save.meta;
            }
            mode = "town";
            townIndex = 0;
            saveState();
            render();
            return;
        }
        if (mode === "wake" || mode === "clear" || mode === "finale" || mode === "dead" || mode === "win") {
            returnToTown();
            return;
        }
        if (mode === "graveyard") {
            mode = "title";
            titleIndex = 0;
            render();
            return;
        }
        if (mode === "inventory") {
            const actor = currentActor();
            if (!actor || !actor.pack.length) {
                closeInventory();
                return;
            }
            if (save.run) {
                const result = PD.useItem(save.run, invIndex);
                if (save.run.pack.length) {
                    invIndex = Math.min(invIndex, save.run.pack.length - 1);
                } else {
                    closeInventory();
                    applyResult(result, "buff");
                    return;
                }
                applyResult(result, "buff");
                return;
            }
            const result = PD.useItemOnHero(save.hero, invIndex);
            pushLog(result.logs || []);
            if (result.ok) {
                if (result.logs && result.logs[0] === "USED POTION") {
                    playSfx("heal");
                } else {
                    playSfx("buff");
                }
                saveState();
            }
            if (save.hero.pack.length) {
                invIndex = Math.min(invIndex, save.hero.pack.length - 1);
            } else {
                closeInventory();
                return;
            }
            render();
            return;
        }
        if (mode === "play" && save.run) {
            applyResult(PD.waitTurn(save.run), "step");
        }
    }

    function onLongPress() {
        stopWalk();
        if (mode === "play") {
            openInventory("play");
            return;
        }
        if (mode === "inventory") {
            closeInventory();
            return;
        }
        if (mode === "town") {
            openInventory("town");
            return;
        }
        if (mode === "talk" || mode === "shop" || mode === "travel") {
            returnToTown();
            return;
        }
        if (mode === "journal") {
            mode = journalFrom === "title" ? "title" : "town";
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
                if (holdFired) {
                    holdFired = false;
                    lastSideClickAt = Date.now();
                    return;
                }
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
            onScroll(event.deltaY > 0 ? -1 : 1);
        }, { passive: false });
        window.addEventListener("keydown", function (event) {
            const key = event.key;
            if (key === "ArrowUp" || key === "w" || key === "W") {
                if (mode === "play" && save.run) {
                    if (save.run.facing === "N") {
                        playActResult(PD.tryAct(save.run));
                    } else {
                        save.run.facing = "N";
                        render();
                    }
                } else if (mode !== "play") {
                    onScroll(-1);
                }
                event.preventDefault();
            } else if (key === "ArrowDown" || key === "s" || key === "S") {
                if (mode === "play" && save.run) {
                    if (save.run.facing === "S") {
                        playActResult(PD.tryAct(save.run));
                    } else {
                        save.run.facing = "S";
                        render();
                    }
                } else if (mode !== "play") {
                    onScroll(1);
                }
                event.preventDefault();
            } else if (key === "ArrowLeft" || key === "a" || key === "A") {
                if (mode === "play" && save.run) {
                    if (save.run.facing === "W") {
                        playActResult(PD.tryAct(save.run));
                    } else {
                        save.run.facing = "W";
                        render();
                    }
                } else if (mode !== "play") {
                    onScroll(-1);
                }
                event.preventDefault();
            } else if (key === "ArrowRight" || key === "d" || key === "D") {
                if (mode === "play" && save.run) {
                    if (save.run.facing === "E") {
                        playActResult(PD.tryAct(save.run));
                    } else {
                        save.run.facing = "E";
                        render();
                    }
                } else if (mode !== "play") {
                    onScroll(1);
                }
                event.preventDefault();
            } else if (key === "Enter" || key === "f" || key === "F" || key === "e" || key === "E") {
                if (mode === "play" && save.run) {
                    playActResult(PD.tryAct(save.run));
                } else {
                    onSideClick();
                }
                event.preventDefault();
            } else if (key === " " || key === "5") {
                if (mode === "play" && save.run) {
                    applyResult(PD.waitTurn(save.run), "step");
                } else {
                    onSideClick();
                }
                event.preventDefault();
            } else if (key === "Escape" || key === "i" || key === "I" || key === "Tab") {
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
