const STORAGE_KEY = "familiarState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const LLM_TIMEOUT_MS = 20000;
const SPEAK_COOLDOWN_MS = 20000;
const MAX_DECAY_HOURS = 24;
const NAME_MAX = 8;
const SIGN_LEN = 3;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ- ";
const TRAITS = ["clingy", "chill", "fussy", "nocturnal"];
const ACTIONS = ["FEED", "PLAY", "SLEEP", "NAME", "SIGN", "CAM"];
const STAGES = ["EGG", "BABY", "TEEN", "ADULT"];

const petEl = document.getElementById("pet");
const nameLabelEl = document.getElementById("nameLabel");
const metaLabelEl = document.getElementById("metaLabel");
const speechEl = document.getElementById("speech");
const actionBtnEl = document.getElementById("actionBtn");
const hintEl = document.getElementById("hint");
const camEl = document.getElementById("cam");
const barHappyEl = document.getElementById("barHappy");
const barHungerEl = document.getElementById("barHunger");
const barEnergyEl = document.getElementById("barEnergy");
const statusEl = document.getElementById("status");

let lastSideClickAt = 0;
let actionIndex = 0;
let speaking = false;
let lastSpeakAt = 0;
let lastAccel = null;
let lastShakeAt = 0;
let accelStarted = false;
let mode = "care";
let letterIndex = 0;
let nameDraft = "";
let signBuffer = [];
let camOn = false;
let camStream = null;
let micTimer = null;
let audioCtx = null;
let lastMicBoostAt = 0;
let micMuteUntil = 0;

let pendingLlmResolve = null;
let pendingLlmReject = null;
let llmTimeoutId = null;

const state = {
    name: "Bit",
    trait: "",
    hatched: false,
    hunger: 70,
    happiness: 70,
    energy: 80,
    ageHours: 0,
    sleeping: false,
    lastSeen: Date.now(),
    bornAt: Date.now(),
    care: { feed: 0, play: 0, sleep: 0 },
    neglectMarks: 0,
    handshake: [],
    camPref: false
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hasPluginHandler() {
    return typeof PluginMessageHandler !== "undefined";
}

function dayNumber() {
    return Math.max(1, Math.floor((Date.now() - state.bornAt) / 86400000) + 1);
}

function currentStageIndex() {
    if (!state.hatched) {
        return 0;
    }
    if (state.ageHours < 6) {
        return 1;
    }
    if (state.ageHours < 24) {
        return 2;
    }
    return 3;
}

function bodyType() {
    const care = state.care;
    if (care.play >= care.feed && care.play >= care.sleep && care.play > 0) {
        return "spiky";
    }
    if (care.sleep >= care.feed && care.sleep >= care.play && care.sleep > 0) {
        return "tall";
    }
    return "round";
}

function moodId() {
    if (state.sleeping) {
        return "sleeping";
    }
    const lowest = Math.min(state.hunger, state.happiness, state.energy);
    if (lowest < 18) {
        return "sick";
    }
    if (lowest < 40) {
        return "sad";
    }
    return "ok";
}

function pickTrait() {
    return TRAITS[Math.abs(Math.floor(state.bornAt)) % TRAITS.length];
}

function hatchIfNeeded() {
    if (state.hatched) {
        return;
    }
    state.hatched = true;
    if (!state.trait) {
        state.trait = pickTrait();
    }
    chirp(880, 0.07);
    chirp(1320, 0.08, 0.08);
}

function stripMarkdownFences(text) {
    return String(text)
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseLlmJson(data) {
    const sources = [data && data.data, data && data.message].filter((value) => value != null && value !== "");
    for (const source of sources) {
        if (typeof source === "object") {
            return source;
        }
        const text = stripMarkdownFences(String(source).trim());
        try {
            return JSON.parse(text);
        } catch (error) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                } catch (innerError) {
                    // continue
                }
            }
        }
    }
    throw new Error("Could not parse LLM JSON");
}

function localLine() {
    const stage = STAGES[currentStageIndex()];
    const mood = moodId();
    const who = state.name || "Bit";
    if (mood === "sleeping") {
        return who + " is dreaming in the box.";
    }
    if (mood === "sick") {
        return "Don't leave " + who + " so long.";
    }
    if (mood === "sad") {
        return who + " missed you.";
    }
    if (stage === "EGG") {
        return "Feed me and I'll hatch.";
    }
    if (state.trait === "clingy") {
        return "Stay. " + who + " likes this close.";
    }
    if (state.trait === "fussy") {
        return "Hmm. That was almost right.";
    }
    if (state.trait === "nocturnal") {
        return "Night box. I like the dark.";
    }
    if (state.trait === "chill") {
        return "Yeah. This is fine.";
    }
    if (stage === "BABY") {
        return "Hi. I'm " + who + " now.";
    }
    return "Day " + dayNumber() + ". Still your " + who + ".";
}

function sendLlmRequest(message) {
    return new Promise((resolve, reject) => {
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
        llmTimeoutId = setTimeout(() => {
            pendingLlmResolve = null;
            pendingLlmReject = null;
            llmTimeoutId = null;
            reject(new Error("LLM timeout"));
        }, LLM_TIMEOUT_MS);
        try {
            PluginMessageHandler.postMessage(JSON.stringify({
                message: message,
                useLLM: true,
                wantsR1Response: true,
                wantsJournalEntry: false
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

function internPrompt() {
    return [
        "You are " + state.name + ", a tiny creature living inside a rabbit r1.",
        "Personality trait: " + (state.trait || "chill") + ".",
        "Body: " + bodyType() + ". Stage: " + STAGES[currentStageIndex()] + ".",
        "Day " + dayNumber() + ". Mood: " + moodId() + ".",
        state.neglectMarks > 0 ? "You still carry a small scar from being left alone." : "",
        "Speak in first person, one sentence, 12 words max.",
        "No markdown. Return ONLY JSON: {\"line\":\"...\"}",
        "hunger=" + Math.round(state.hunger) +
            " happiness=" + Math.round(state.happiness) +
            " energy=" + Math.round(state.energy)
    ].filter(Boolean).join(" ");
}

function ensureAudio() {
    if (audioCtx) {
        if (audioCtx.state === "suspended" && audioCtx.resume) {
            audioCtx.resume().catch(() => {});
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

function chirp(freq, seconds, delay) {
    const ctx = ensureAudio();
    if (!ctx) {
        return;
    }
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
    micMuteUntil = Date.now() + 900;
}

function applyDecay() {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - state.lastSeen);
    const hours = Math.min(MAX_DECAY_HOURS, elapsedMs / 3600000);
    state.ageHours += elapsedMs / 3600000;
    if (hours > 0.05) {
        const before = Math.min(state.hunger, state.happiness, state.energy);
        state.hunger = clamp(state.hunger - hours * 8, 0, 100);
        state.happiness = clamp(state.happiness - hours * 5, 0, 100);
        if (!state.sleeping) {
            state.energy = clamp(state.energy - hours * 4, 0, 100);
        } else {
            state.energy = clamp(state.energy + hours * 6, 0, 100);
        }
        const after = Math.min(state.hunger, state.happiness, state.energy);
        if (before >= 18 && after < 18) {
            state.neglectMarks += 1;
        }
    }
    state.lastSeen = now;
}

function careHint() {
    return "scroll: care · side: do · hold: speak";
}

function render() {
    const stage = STAGES[currentStageIndex()];
    const mood = moodId();
    const body = bodyType();
    nameLabelEl.textContent = mode === "name" ? (nameDraft || "_") : state.name;
    metaLabelEl.textContent = "D" + dayNumber() + " " + stage;
    if (mode === "name") {
        actionBtnEl.textContent = LETTERS[letterIndex];
        hintEl.textContent = "scroll: letter · side: add · hold: save";
    } else if (mode === "sign") {
        actionBtnEl.textContent = signBuffer.length + "/" + SIGN_LEN;
        hintEl.textContent = state.handshake.length
            ? "repeat: scroll/shake · side: check"
            : "teach: scroll/shake x3";
    } else {
        actionBtnEl.textContent = ACTIONS[actionIndex];
        hintEl.textContent = careHint();
    }
    barHappyEl.style.width = state.happiness + "%";
    barHungerEl.style.width = state.hunger + "%";
    barEnergyEl.style.width = state.energy + "%";
    petEl.className = [
        "pet",
        "is-" + stage.toLowerCase(),
        "is-" + body,
        "trait-" + (state.trait || "chill"),
        mood === "sleeping" ? "is-sleeping" : "",
        mood === "sad" ? "is-sad" : "",
        mood === "sick" ? "is-sick" : "",
        state.neglectMarks > 0 ? "is-scarred" : ""
    ].filter(Boolean).join(" ");
}

function say(text) {
    speechEl.textContent = text;
    statusEl.textContent = text;
}

function enterName() {
    mode = "name";
    nameDraft = state.name === "Bit" ? "" : state.name;
    letterIndex = 0;
    render();
    say("Who am I to you?");
}

function confirmName() {
    const next = nameDraft.trim().replace(/\s+/g, " ");
    if (next) {
        state.name = next.slice(0, NAME_MAX);
    }
    mode = "care";
    render();
    say("Okay. I'm " + state.name + ".");
    saveState();
}

function appendLetter() {
    if (nameDraft.length >= NAME_MAX) {
        return;
    }
    nameDraft += LETTERS[letterIndex];
    render();
}

function backspaceName() {
    nameDraft = nameDraft.slice(0, -1);
    render();
}

function enterSign() {
    mode = "sign";
    signBuffer = [];
    render();
    if (state.handshake.length === SIGN_LEN) {
        say("Show me our handshake.");
    } else {
        say("Teach me 3 moves: scroll or shake.");
    }
}

function pushSign(token) {
    if (mode !== "sign") {
        return false;
    }
    signBuffer.push(token);
    render();
    chirp(token === "shake" ? 520 : token === "up" ? 700 : 420, 0.04);
    if (signBuffer.length >= SIGN_LEN) {
        finishSign();
    }
    return true;
}

function finishSign() {
    const seq = signBuffer.slice(0, SIGN_LEN);
    signBuffer = [];
    if (state.handshake.length !== SIGN_LEN) {
        state.handshake = seq;
        mode = "care";
        render();
        say("Locked. That's ours.");
        chirp(640, 0.06);
        chirp(960, 0.08, 0.07);
        saveState();
        return;
    }
    const match = seq.every((step, i) => step === state.handshake[i]);
    mode = "care";
    if (match) {
        state.happiness = clamp(state.happiness + 30, 0, 100);
        say("You. I know you.");
        chirp(880, 0.1);
    } else {
        say("Not our handshake.");
    }
    render();
    saveState();
}

async function toggleCam() {
    if (camOn) {
        stopCam();
        say("Window closed.");
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        say("No window in here.");
        return;
    }
    try {
        camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        camEl.srcObject = camStream;
        camEl.hidden = false;
        await camEl.play();
        camOn = true;
        state.camPref = true;
        say("I can see your world.");
        saveState();
    } catch (error) {
        console.warn("camera failed", error);
        say("Window stuck.");
    }
}

function stopCam() {
    camOn = false;
    state.camPref = false;
    camEl.hidden = true;
    if (camStream) {
        camStream.getTracks().forEach((track) => track.stop());
        camStream = null;
    }
    camEl.srcObject = null;
}

async function startMic() {
    if (micTimer || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const ctx = ensureAudio();
        if (!ctx) {
            return;
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        lastMicBoostAt = Date.now();
        micTimer = setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i += 1) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            const now = Date.now();
            if (
                rms > 0.22 &&
                now > micMuteUntil &&
                now - lastMicBoostAt > 4000 &&
                !state.sleeping
            ) {
                lastMicBoostAt = now;
                state.happiness = clamp(state.happiness + 4, 0, 100);
                say("Heard you.");
                render();
                saveState();
            }
        }, 300);
    } catch (error) {
        console.warn("mic soothe failed", error);
    }
}

function doCareAction() {
    const action = ACTIONS[actionIndex];
    ensureAudio();
    if (action === "NAME") {
        enterName();
        return;
    }
    if (action === "SIGN") {
        enterSign();
        return;
    }
    if (action === "CAM") {
        toggleCam();
        return;
    }
    startMic();
    if (action === "FEED") {
        hatchIfNeeded();
        state.sleeping = false;
        state.hunger = clamp(state.hunger + 28, 0, 100);
        state.happiness = clamp(state.happiness + 6, 0, 100);
        state.care.feed += 1;
        say("Nom. Warmer.");
        chirp(620, 0.06);
    } else if (action === "PLAY") {
        if (state.energy < 12) {
            say("Too tired. Sleep?");
        } else {
            hatchIfNeeded();
            state.sleeping = false;
            state.happiness = clamp(state.happiness + 22, 0, 100);
            state.energy = clamp(state.energy - 14, 0, 100);
            state.hunger = clamp(state.hunger - 8, 0, 100);
            state.care.play += 1;
            say("Again! Shake me more.");
            chirp(740, 0.05);
            chirp(990, 0.05, 0.06);
        }
    } else {
        hatchIfNeeded();
        state.sleeping = !state.sleeping;
        state.care.sleep += 1;
        say(state.sleeping ? "Okay. Lights down." : "I'm up.");
        chirp(state.sleeping ? 280 : 540, 0.07);
    }
    state.lastSeen = Date.now();
    render();
    saveState();
}

function cycleAction(delta) {
    if (mode === "name") {
        letterIndex = (letterIndex + delta + LETTERS.length) % LETTERS.length;
        render();
        return;
    }
    if (mode === "sign") {
        pushSign(delta < 0 ? "up" : "down");
        return;
    }
    actionIndex = (actionIndex + delta + ACTIONS.length) % ACTIONS.length;
    render();
    statusEl.textContent = ACTIONS[actionIndex];
}

function onSideClick() {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
        return;
    }
    lastSideClickAt = now;
    if (mode === "name") {
        appendLetter();
        return;
    }
    if (mode === "sign") {
        return;
    }
    doCareAction();
}

function onLongPress() {
    if (mode === "name") {
        confirmName();
        return;
    }
    if (mode === "sign") {
        mode = "care";
        signBuffer = [];
        render();
        say("Handshake later.");
        return;
    }
    speak();
}

async function speak() {
    const now = Date.now();
    if (speaking) {
        return;
    }
    if (now - lastSpeakAt < SPEAK_COOLDOWN_MS) {
        say("Still catching my breath.");
        return;
    }
    speaking = true;
    lastSpeakAt = now;
    say("…");
    try {
        const parsed = await sendLlmRequest(internPrompt());
        const line = parsed && typeof parsed.line === "string" ? parsed.line.trim() : "";
        say(line || localLine());
    } catch (error) {
        console.warn("Familiar intern speak failed", error);
        say(localLine());
    } finally {
        speaking = false;
        saveState();
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
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function snapshot() {
    return {
        name: state.name,
        trait: state.trait,
        hatched: state.hatched,
        hunger: state.hunger,
        happiness: state.happiness,
        energy: state.energy,
        ageHours: state.ageHours,
        sleeping: state.sleeping,
        lastSeen: state.lastSeen,
        bornAt: state.bornAt,
        care: {
            feed: state.care.feed,
            play: state.care.play,
            sleep: state.care.sleep
        },
        neglectMarks: state.neglectMarks,
        handshake: state.handshake.slice(),
        camPref: state.camPref
    };
}

function applySnapshot(saved) {
    if (!saved || typeof saved !== "object") {
        return;
    }
    if (typeof saved.name === "string" && saved.name.trim()) {
        state.name = saved.name.trim().slice(0, NAME_MAX);
    }
    if (TRAITS.indexOf(saved.trait) !== -1) {
        state.trait = saved.trait;
    }
    if (typeof saved.hatched === "boolean") {
        state.hatched = saved.hatched;
    } else if (typeof saved.ageHours === "number" && saved.ageHours > 0) {
        state.hatched = true;
    }
    ["hunger", "happiness", "energy", "ageHours"].forEach((key) => {
        if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
            state[key] = clamp(saved[key], 0, key === "ageHours" ? 10000 : 100);
        }
    });
    if (typeof saved.sleeping === "boolean") {
        state.sleeping = saved.sleeping;
    }
    if (typeof saved.lastSeen === "number" && Number.isFinite(saved.lastSeen)) {
        state.lastSeen = saved.lastSeen;
    }
    if (typeof saved.bornAt === "number" && Number.isFinite(saved.bornAt)) {
        state.bornAt = saved.bornAt;
    }
    if (saved.care && typeof saved.care === "object") {
        ["feed", "play", "sleep"].forEach((key) => {
            if (typeof saved.care[key] === "number" && Number.isFinite(saved.care[key])) {
                state.care[key] = Math.max(0, Math.round(saved.care[key]));
            }
        });
    }
    if (typeof saved.neglectMarks === "number" && Number.isFinite(saved.neglectMarks)) {
        state.neglectMarks = Math.max(0, Math.round(saved.neglectMarks));
    }
    if (Array.isArray(saved.handshake)) {
        state.handshake = saved.handshake.filter((step) => step === "up" || step === "down" || step === "shake").slice(0, SIGN_LEN);
    }
    if (typeof saved.camPref === "boolean") {
        state.camPref = saved.camPref;
    }
}

async function loadState() {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            const stored = await window.creationStorage.plain.getItem(STORAGE_KEY);
            if (stored) {
                applySnapshot(JSON.parse(base64ToUtf8(stored)));
                return;
            }
        }
    } catch (error) {
        console.warn("creationStorage read failed", error);
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            applySnapshot(JSON.parse(stored));
        }
    } catch (error) {
        console.warn("localStorage read failed", error);
    }
}

async function saveState() {
    state.lastSeen = Date.now();
    const payload = JSON.stringify(snapshot());
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

function onShake() {
    const now = Date.now();
    if (now - lastShakeAt < 700) {
        return;
    }
    lastShakeAt = now;
    if (pushSign("shake")) {
        return;
    }
    if (mode === "name") {
        backspaceName();
        return;
    }
    if (state.sleeping) {
        state.sleeping = false;
        state.energy = clamp(state.energy + 4, 0, 100);
        say("Whoa — I'm up.");
        render();
        saveState();
        return;
    }
    actionIndex = ACTIONS.indexOf("PLAY");
    doCareAction();
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
        } catch (error) {
            // ignore
        }
    }
    accelStarted = false;
}

function persistAndPause() {
    saveState();
    stopAccel();
    if (micTimer) {
        clearInterval(micTimer);
        micTimer = null;
    }
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => cycleAction(-1));
    window.addEventListener("scrollDown", () => cycleAction(1));
    window.addEventListener("sideClick", onSideClick);
    window.addEventListener("longPressStart", onLongPress);
}

function initializeFallback() {
    actionBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        onSideClick();
    });
    document.addEventListener("click", (event) => {
        if (event.target.closest(".action")) {
            return;
        }
        cycleAction(1);
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            cycleAction(-1);
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            cycleAction(1);
            return;
        }
        if (event.key === "Backspace" && mode === "name") {
            event.preventDefault();
            backspaceName();
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSideClick();
            return;
        }
        if (event.key === "l" || event.key === "L") {
            event.preventDefault();
            onLongPress();
        }
    });
}

async function init() {
    await loadState();
    if (state.hatched && !state.trait) {
        state.trait = pickTrait();
    }
    applyDecay();
    render();
    say(state.hatched ? localLine() : "Feed me and I'll hatch.");
    await saveState();
    initializeHardware();
    initializeFallback();
    startAccel();
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            persistAndPause();
        } else {
            applyDecay();
            render();
            startAccel();
        }
    });
    window.addEventListener("pagehide", persistAndPause);
    window.addEventListener("beforeunload", persistAndPause);
}

init();
