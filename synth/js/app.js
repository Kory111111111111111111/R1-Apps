const STORAGE_KEY = "synthState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const MAX_VOICES = 4;
const ATTACK_S = 0.01;
const RELEASE_S = 0.08;
const MASTER_GAIN = 0.2;
const FILTER_Q = 1;
const CUTOFF_MIN_HZ = 120;
const CUTOFF_MAX_HZ = 8000;
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;
const DEFAULT_WAVE = "sawtooth";
const DEFAULT_CUTOFF = 70;
const DEFAULT_OCTAVE = 3;

const WAVES = [
    { id: "sine", label: "SIN" },
    { id: "square", label: "SQR" },
    { id: "sawtooth", label: "SAW" },
    { id: "triangle", label: "TRI" }
];

const SCALE_DEGREES = [0, 2, 4, 5, 7, 9, 11, 12];

const waveLabelEl = document.getElementById("waveLabel");
const octaveLabelEl = document.getElementById("octaveLabel");
const cutoffFillEl = document.getElementById("cutoffFill");
const cutoffValueEl = document.getElementById("cutoffValue");
const octaveDownEl = document.getElementById("octaveDown");
const octaveUpEl = document.getElementById("octaveUp");
const padEls = Array.from(document.querySelectorAll(".pad"));
const statusEl = document.getElementById("status");

let waveIndex = WAVES.findIndex((wave) => wave.id === DEFAULT_WAVE);
let cutoff = DEFAULT_CUTOFF;
let octave = DEFAULT_OCTAVE;
let lastSideClickAt = 0;

let audioCtx = null;
let masterGain = null;
let filter = null;
const voices = [];
const padVoiceMap = new Map();

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function currentWave() {
    return WAVES[waveIndex];
}

function cutoffToHz(value) {
    const t = clamp(value, 0, 100) / 100;
    return CUTOFF_MIN_HZ * Math.pow(CUTOFF_MAX_HZ / CUTOFF_MIN_HZ, t);
}

function midiForPad(degreeIndex) {
    const semitone = SCALE_DEGREES[degreeIndex];
    return (octave + 1) * 12 + semitone;
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function padLabelForDegree(degreeIndex) {
    return padEls[degreeIndex].dataset.label;
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
        masterGain = audioCtx.createGain();
        masterGain.gain.value = MASTER_GAIN;
        filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.Q.value = FILTER_Q;
        filter.frequency.value = cutoffToHz(cutoff);
        filter.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        for (let i = 0; i < MAX_VOICES; i += 1) {
            voices.push({
                id: i,
                osc: null,
                gain: null,
                padIndex: -1,
                active: false
            });
        }

        if (audioCtx.resume) {
            audioCtx.resume().catch(() => {});
        }
    } catch (error) {
        console.warn("AudioContext init failed", error);
        audioCtx = null;
        masterGain = null;
        filter = null;
    }

    return audioCtx;
}

function applyFilterCutoff() {
    if (!filter || !audioCtx) {
        return;
    }
    filter.frequency.setTargetAtTime(cutoffToHz(cutoff), audioCtx.currentTime, 0.01);
}

function findFreeVoice() {
    return voices.find((voice) => !voice.active) || null;
}

function findOldestVoice() {
    return voices.find((voice) => voice.active) || voices[0];
}

function stopVoiceImmediate(voice) {
    if (!voice.active || !voice.osc) {
        return;
    }

    try {
        voice.gain.gain.cancelScheduledValues(audioCtx.currentTime);
        voice.gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        voice.osc.stop(audioCtx.currentTime + 0.001);
        voice.osc.disconnect();
        voice.gain.disconnect();
    } catch (error) {
        // Oscillator may already be stopped.
    }

    if (voice.padIndex !== -1) {
        padVoiceMap.delete(voice.padIndex);
        padEls[voice.padIndex].classList.remove("is-held");
    }

    voice.osc = null;
    voice.gain = null;
    voice.padIndex = -1;
    voice.active = false;
}

function releaseVoice(voice) {
    if (!voice.active || !voice.gain || !audioCtx) {
        return;
    }

    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_S);

    const osc = voice.osc;
    const padIndex = voice.padIndex;
    voice.active = false;
    voice.padIndex = -1;
    voice.osc = null;
    voice.gain = null;

    if (padIndex !== -1) {
        padVoiceMap.delete(padIndex);
        padEls[padIndex].classList.remove("is-held");
    }

    setTimeout(() => {
        try {
            if (osc) {
                osc.stop();
                osc.disconnect();
            }
        } catch (error) {
            // Already stopped.
        }
    }, RELEASE_S * 1000 + 20);
}

function startPad(padIndex) {
    if (!ensureAudio()) {
        statusEl.textContent = "Audio unavailable";
        return;
    }

    const existing = padVoiceMap.get(padIndex);
    if (existing) {
        return;
    }

    let voice = findFreeVoice();
    if (!voice) {
        voice = findOldestVoice();
        stopVoiceImmediate(voice);
    }

    const freq = midiToFreq(midiForPad(padIndex));
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = currentWave().id;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(filter);

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + ATTACK_S);
    osc.start(now);

    voice.osc = osc;
    voice.gain = gain;
    voice.padIndex = padIndex;
    voice.active = true;
    padVoiceMap.set(padIndex, voice);
    padEls[padIndex].classList.add("is-held");

    const label = padLabelForDegree(padIndex);
    statusEl.textContent = label + " " + freq.toFixed(1) + " Hz";
}

function stopPad(padIndex) {
    const voice = padVoiceMap.get(padIndex);
    if (!voice) {
        padEls[padIndex].classList.remove("is-held");
        return;
    }
    releaseVoice(voice);
}

function allNotesOff() {
    voices.slice().forEach((voice) => {
        if (voice.active) {
            stopVoiceImmediate(voice);
        }
    });
    padVoiceMap.clear();
    padEls.forEach((pad) => pad.classList.remove("is-held"));
    statusEl.textContent = "All notes off";
}

function renderHeader() {
    const wave = currentWave();
    waveLabelEl.textContent = wave.label;
    octaveLabelEl.textContent = "C" + octave;
    cutoffFillEl.style.width = cutoff + "%";
    cutoffValueEl.textContent = String(cutoff);
}

function setCutoff(value) {
    cutoff = clamp(Math.round(value), 0, 100);
    applyFilterCutoff();
    renderHeader();
    saveState();
}

function cycleWave(delta) {
    waveIndex = (waveIndex + delta + WAVES.length) % WAVES.length;
    renderHeader();
    saveState();
    statusEl.textContent = currentWave().label + " wave";
}

function setOctave(value) {
    octave = clamp(Math.round(value), MIN_OCTAVE, MAX_OCTAVE);
    allNotesOff();
    renderHeader();
    saveState();
}

function onSideClick() {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
        return;
    }
    lastSideClickAt = now;
    cycleWave(1);
}

function initializePads() {
    padEls.forEach((pad, index) => {
        const onDown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            startPad(index);
        };
        const onUp = (event) => {
            event.preventDefault();
            event.stopPropagation();
            stopPad(index);
        };

        pad.addEventListener("pointerdown", onDown);
        pad.addEventListener("pointerup", onUp);
        pad.addEventListener("pointerleave", onUp);
        pad.addEventListener("pointercancel", onUp);
        pad.addEventListener("touchstart", onDown, { passive: false });
        pad.addEventListener("touchend", onUp, { passive: false });
        pad.addEventListener("touchcancel", onUp, { passive: false });
    });
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => setCutoff(cutoff - 2));
    window.addEventListener("scrollDown", () => setCutoff(cutoff + 2));
    window.addEventListener("sideClick", onSideClick);
    window.addEventListener("longPressStart", allNotesOff);
    window.addEventListener("longPressEnd", allNotesOff);
}

function initializeFallbackInput() {
    octaveDownEl.addEventListener("click", (event) => {
        event.stopPropagation();
        setOctave(octave - 1);
    });
    octaveUpEl.addEventListener("click", (event) => {
        event.stopPropagation();
        setOctave(octave + 1);
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setCutoff(cutoff - 2);
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setCutoff(cutoff + 2);
            return;
        }
        if (event.key === "w" || event.key === "W") {
            event.preventDefault();
            cycleWave(1);
        }
    });
}

async function saveState() {
    const snapshot = {
        wave: currentWave().id,
        cutoff: cutoff,
        octave: octave
    };
    const payload = JSON.stringify(snapshot);

    try {
        if (window.creationStorage && window.creationStorage.plain) {
            await window.creationStorage.plain.setItem(STORAGE_KEY, btoa(payload));
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

function applySavedState(saved) {
    if (!saved) {
        return;
    }

    const waveIdx = WAVES.findIndex((wave) => wave.id === saved.wave);
    if (waveIdx !== -1) {
        waveIndex = waveIdx;
    }
    if (typeof saved.cutoff === "number") {
        cutoff = clamp(saved.cutoff, 0, 100);
    }
    if (typeof saved.octave === "number") {
        octave = clamp(saved.octave, MIN_OCTAVE, MAX_OCTAVE);
    }
}

async function init() {
    const saved = await loadState();
    applySavedState(saved);
    renderHeader();
    initializePads();
    initializeHardware();
    initializeFallbackInput();
}

document.addEventListener("DOMContentLoaded", () => {
    init();
});
