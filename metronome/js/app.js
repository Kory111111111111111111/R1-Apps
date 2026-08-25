const STORAGE_KEY = "metronomeState";
const DEFAULT_BPM = 120;
const MIN_BPM = 30;
const MAX_BPM = 500;
const SIDE_CLICK_DEBOUNCE_MS = 120;
const LOOKAHEAD_S = 0.12;
const SCHEDULER_TICK_MS = 25;
const BAR_LENGTH = 4;
const MAX_TAPS = 9;

const MODES = ["TAP", "BEAT"];

const currentModeEl = document.getElementById("currentMode");
const prevModeEl = document.getElementById("prevMode");
const nextModeEl = document.getElementById("nextMode");
const bpmDisplayEl = document.getElementById("bpmDisplay");
const bpmValueEl = document.getElementById("bpmValue");
const hintEl = document.getElementById("hint");
const statusEl = document.getElementById("status");
const beatEls = Array.from(document.querySelectorAll(".beat"));

let mode = "BEAT";
let bpm = DEFAULT_BPM;
let running = false;
let lastSideClickAt = 0;

let audioCtx = null;
let scheduleTimer = null;
let nextNoteTime = 0;
let currentBeat = 0;
const taps = [];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function nowTime() {
    return audioCtx ? audioCtx.currentTime : performance.now() / 1000;
}

function modeIndex() {
    return MODES.indexOf(mode);
}

/* --- Rendering --- */

function renderMode() {
    const idx = modeIndex();
    const prev = MODES[(idx - 1 + MODES.length) % MODES.length];
    const next = MODES[(idx + 1) % MODES.length];

    currentModeEl.textContent = mode;
    prevModeEl.textContent = prev;
    nextModeEl.textContent = next;

    if (mode === "BEAT") {
        hintEl.textContent = "scroll: BPM · side: start/stop";
    } else {
        hintEl.textContent = "side: tap tempo · scroll: BEAT mode";
    }
    bpmDisplayEl.setAttribute("aria-label", mode + " mode");
}

function renderBpm() {
    bpmValueEl.textContent = String(bpm);
}

function flashValue() {
    bpmDisplayEl.classList.remove("pulse");
    void bpmDisplayEl.offsetWidth;
    bpmDisplayEl.classList.add("pulse");
}

function showBeat(beat) {
    beatEls.forEach((el, i) => {
        el.classList.toggle("on", i === beat % BAR_LENGTH);
    });
    flashValue();
}

function clearBeats() {
    beatEls.forEach((el) => el.classList.remove("on"));
}

function setHint(text) {
    hintEl.textContent = text;
}

/* --- BPM / mode state --- */

function setBpm(value) {
    bpm = clamp(Math.round(value), MIN_BPM, MAX_BPM);
    renderBpm();
    saveState();
}

function cycleMode(delta) {
    const idx = modeIndex();
    mode = MODES[(idx + delta + MODES.length) % MODES.length];
    if (running && mode !== "BEAT") {
        stopMetronome();
    }
    clearBeats();
    taps.length = 0;
    renderMode();
    saveState();
}

/* --- Tap tempo --- */

function addTap() {
    const now = Date.now();
    taps.push(now);
    if (taps.length > MAX_TAPS) {
        taps.shift();
    }
    if (taps.length >= 2) {
        const intervals = [];
        for (let i = 1; i < taps.length; i += 1) {
            intervals.push(taps[i] - taps[i - 1]);
        }
        intervals.sort((a, b) => a - b);
        const median = intervals[Math.floor(intervals.length / 2)];
        setBpm(Math.round(60000 / median));
        statusEl.textContent = "Tapped " + bpm + " BPM";
    } else {
        statusEl.textContent = "Tap again…";
    }
    flashValue();
}

/* --- Metronome scheduling (lookahead) --- */

function scheduleBeat(beat, time) {
    const accent = beat % BAR_LENGTH === 0;

    if (audioCtx && audioCtx.state !== "closed") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = accent ? 1760 : 1175;
        const t0 = Math.max(time, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t0 + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.07);
    }

    showBeat(beat);
}

function schedulerTick() {
    while (nextNoteTime < nowTime() + LOOKAHEAD_S) {
        scheduleBeat(currentBeat, nextNoteTime);
        nextNoteTime += 60 / bpm;
        currentBeat = (currentBeat + 1) % BAR_LENGTH;
    }
}

function startMetronome() {
    if (!audioCtx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (Ctor) {
            try {
                audioCtx = new Ctor();
                if (audioCtx.resume) {
                    audioCtx.resume().catch(() => {});
                }
            } catch (error) {
                audioCtx = null;
            }
        }
    }

    running = true;
    currentBeat = 0;
    nextNoteTime = nowTime() + 0.08;
    scheduleTimer = setInterval(schedulerTick, SCHEDULER_TICK_MS);
    statusEl.textContent = "Metronome " + bpm + " BPM";
    bpmDisplayEl.setAttribute("aria-label", "Stop " + bpm + " BPM");
}

function stopMetronome() {
    running = false;
    if (scheduleTimer) {
        clearInterval(scheduleTimer);
        scheduleTimer = null;
    }
    nextNoteTime = 0;
    clearBeats();
    statusEl.textContent = "Stopped";
    bpmDisplayEl.setAttribute("aria-label", "Start " + bpm + " BPM");
}

function onSideAction() {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
        return;
    }
    lastSideClickAt = now;

    if (mode === "TAP") {
        addTap();
    } else if (running) {
        stopMetronome();
    } else {
        startMetronome();
    }
}

/* --- Hardware inputs --- */

function initializeHardware() {
    window.addEventListener("scrollUp", () => {
        if (mode === "BEAT") {
            setBpm(bpm - 1);
        } else {
            cycleMode(1);
        }
    });
    window.addEventListener("scrollDown", () => {
        if (mode === "BEAT") {
            setBpm(bpm + 1);
        } else {
            cycleMode(-1);
        }
    });
    window.addEventListener("sideClick", onSideAction);
    window.addEventListener("longPressStart", () => cycleMode(1));
}

/* --- Fallback (desktop / touch) inputs --- */

function initializeFallbackInput() {
    prevModeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        cycleMode(-1);
    });
    nextModeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        cycleMode(1);
    });
    bpmDisplayEl.addEventListener("click", () => {
        onSideAction();
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setBpm(bpm - 1);
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setBpm(bpm + 1);
            return;
        }
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onSideClick();
        }
    });
}

/* --- Persistence (creationStorage with localStorage fallback) --- */

async function saveState() {
    const payload = JSON.stringify({ mode: mode, bpm: bpm });
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            await window.creationStorage.plain.setItem(STORAGE_KEY, btoa(payload));
            return;
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

async function loadState() {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            const stored = await window.creationStorage.plain.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(atob(stored));
            }
        }
    } catch (error) {
        console.warn("creationStorage read failed", error);
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.warn("localStorage read failed", error);
    }
    return null;
}

async function init() {
    const saved = await loadState();
    if (saved) {
        if (MODES.indexOf(saved.mode) !== -1) {
            mode = saved.mode;
        }
        if (typeof saved.bpm === "number") {
            bpm = clamp(saved.bpm, MIN_BPM, MAX_BPM);
        }
    }
    renderMode();
    renderBpm();
    bpmDisplayEl.setAttribute("aria-label", "Start " + bpm + " BPM");
    initializeHardware();
    initializeFallbackInput();
}

document.addEventListener("DOMContentLoaded", () => {
    init();
});