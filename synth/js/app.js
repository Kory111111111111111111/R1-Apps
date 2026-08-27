const STORAGE_KEY = "synthState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const MAX_VOICES = 8;
const MASTER_GAIN = 0.2;
const FILTER_Q = 1;
const CUTOFF_MIN_HZ = 120;
const CUTOFF_MAX_HZ = 8000;
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;
const DEFAULT_WAVE = "sawtooth";
const DEFAULT_CUTOFF = 70;
const DEFAULT_OCTAVE = 3;
const DEFAULT_ADSR = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.2
};

const WAVES = [
    { id: "sine", label: "SIN" },
    { id: "square", label: "SQR" },
    { id: "sawtooth", label: "SAW" },
    { id: "triangle", label: "TRI" }
];

const FX_IDS = ["reverb", "delay", "chorus"];

// Desktop fallback: QWERTY piano (AGENTS.md requires keyboard fallbacks).
// White keys: a s d f g h j k = C D E F G A B C.
// Black keys: w e t y u = C# D# F# G# A#.
const KEYBOARD_MAP = {
    a: 0, w: 8, s: 1, e: 9, d: 2,
    f: 3, t: 10, g: 4, y: 11, h: 5,
    u: 12, j: 6, k: 7
};

const ADSR_PARAMS = {
    attack: { min: 0.001, max: 0.5 },
    decay: { min: 0.01, max: 1.5 },
    sustain: { min: 0, max: 1 },
    release: { min: 0.01, max: 2 }
};

const waveLabelEl = document.getElementById("waveLabel");
const octaveLabelEl = document.getElementById("octaveLabel");
const cutoffFillEl = document.getElementById("cutoffFill");
const cutoffValueEl = document.getElementById("cutoffValue");
const octaveDownEl = document.getElementById("octaveDown");
const octaveUpEl = document.getElementById("octaveUp");
const fxBtnEl = document.getElementById("fxBtn");
const mainViewEl = document.getElementById("mainView");
const fxViewEl = document.getElementById("fxView");
const fxBackEl = document.getElementById("fxBack");
const tabEffectsEl = document.getElementById("tabEffects");
const tabAdsrEl = document.getElementById("tabAdsr");
const tabTunesEl = document.getElementById("tabTunes");
const fxEffectsEl = document.getElementById("fxEffects");
const fxAdsrEl = document.getElementById("fxAdsr");
const fxTunesEl = document.getElementById("fxTunes");
const loopRecEl = document.getElementById("loopRec");
const loopPlayEl = document.getElementById("loopPlay");
const loopClearEl = document.getElementById("loopClear");
const loopStatusEl = document.getElementById("loopStatus");
const arpTglEl = document.getElementById("arpToggle");
const arpRateEl = document.getElementById("arpRate");
const fxReverbEl = document.getElementById("fxReverb");
const fxDelayEl = document.getElementById("fxDelay");
const fxChorusEl = document.getElementById("fxChorus");
const fxReverbStateEl = document.getElementById("fxReverbState");
const fxDelayStateEl = document.getElementById("fxDelayState");
const fxChorusStateEl = document.getElementById("fxChorusState");
const adsrRows = Array.from(document.querySelectorAll(".adsr-row"));
const keyEls = Array.from(document.querySelectorAll(".key"));
const keyOffsets = keyEls.map((el) => Number(el.dataset.offset));
const statusEl = document.getElementById("status");

let waveIndex = WAVES.findIndex((wave) => wave.id === DEFAULT_WAVE);
let cutoff = DEFAULT_CUTOFF;
let octave = DEFAULT_OCTAVE;
let lastSideClickAt = 0;
let inFxView = false;
let fxPageIndex = 0;
let adsrDrag = null;
const fxState = { reverb: false, delay: false, chorus: false };
const adsr = Object.assign({}, DEFAULT_ADSR);

// Loop recorder: records keyboard note events and plays them back as a
// seamless loop through the same filter/FX chain.
const loopState = {
    recording: false,
    playing: false,
    events: [],
    duration: 0,
    recStart: 0,
    loopStart: 0,
    nextIndex: 0,
    schedulerTimer: null,
    loopVoices: new Map()
};

const ARP_RATES = [
    { label: "1/16", ms: 125 },
    { label: "1/8", ms: 250 },
    { label: "1/4", ms: 500 },
    { label: "1/2", ms: 1000 }
];
let arpOn = false;
let arpRateIndex = 1;
let arpTimer = null;
let arpStep = 0;

let audioCtx = null;
let masterGain = null;
let filter = null;
let compressor = null;
let fxBus = null;
let fxDelay = null;
let fxDelayWet = null;
let fxReverb = null;
let fxReverbWet = null;
let fxChorus = null;
let fxChorusWet = null;
const voices = [];
const keyVoiceMap = new Map();
const pressedKeys = new Map();

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

function midiForKey(keyIndex) {
    return (octave + 1) * 12 + keyOffsets[keyIndex];
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// Procedural reverb impulse response (no asset needed): noise with an
// exponential decay, stereo.
function makeImpulseResponse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return buffer;
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

        // Cheap safety net: several voices summing into the master can clip on
        // attack transients; a compressor tames that without changing tone.
        compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 20;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.15;

        filter.connect(compressor);
        compressor.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        // FX bus: a parallel chain off the filter. Wet gains ramp to 0 when
        // the effect is off, so the dry path is untouched.
        fxBus = audioCtx.createGain();
        fxBus.gain.value = 1;
        filter.connect(fxBus);

        fxDelay = audioCtx.createDelay(1.0);
        fxDelay.delayTime.value = 0.28;
        const fxFeedback = audioCtx.createGain();
        fxFeedback.gain.value = 0.4;
        fxDelayWet = audioCtx.createGain();
        fxDelayWet.gain.value = 0;
        fxDelay.connect(fxFeedback);
        fxFeedback.connect(fxDelay);
        fxDelay.connect(fxDelayWet);
        fxDelayWet.connect(masterGain);

        fxReverb = audioCtx.createConvolver();
        fxReverb.buffer = makeImpulseResponse(audioCtx, 1.4, 2);
        fxReverbWet = audioCtx.createGain();
        fxReverbWet.gain.value = 0;
        fxReverb.connect(fxReverbWet);
        fxReverbWet.connect(masterGain);

        // Chorus: a short delay whose time is wobbled by a slow LFO.
        fxChorus = audioCtx.createDelay(0.1);
        fxChorus.delayTime.value = 0.025;
        const chorusLfo = audioCtx.createOscillator();
        chorusLfo.frequency.value = 0.5;
        const chorusDepth = audioCtx.createGain();
        chorusDepth.gain.value = 0.005;
        chorusLfo.connect(chorusDepth);
        chorusDepth.connect(fxChorus.delayTime);
        fxChorusWet = audioCtx.createGain();
        fxChorusWet.gain.value = 0;
        fxChorus.connect(fxChorusWet);
        fxChorusWet.connect(masterGain);
        chorusLfo.start();

        fxBus.connect(fxDelay);
        fxBus.connect(fxReverb);
        fxBus.connect(fxChorus);

        for (let i = 0; i < MAX_VOICES; i += 1) {
            voices.push({
                id: i,
                osc: null,
                gain: null,
                keyIndex: -1,
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
        compressor = null;
        fxBus = null;
        fxDelay = null;
        fxDelayWet = null;
        fxReverb = null;
        fxReverbWet = null;
        fxChorus = null;
        fxChorusWet = null;
    }

    return audioCtx;
}

function applyFilterCutoff() {
    if (!filter || !audioCtx) {
        return;
    }
    filter.frequency.setTargetAtTime(cutoffToHz(cutoff), audioCtx.currentTime, 0.01);
}

function setFxButtonLabel() {
    if (loopState.recording) {
        fxBtnEl.textContent = "● REC";
        return;
    }
    const count = FX_IDS.filter((id) => fxState[id]).length;
    fxBtnEl.textContent = count > 0 ? "FX " + count : "FX";
}

function applyFxState() {
    setFxButtonLabel();
    const options = [
        { el: fxReverbEl, stateEl: fxReverbStateEl, key: "reverb" },
        { el: fxDelayEl, stateEl: fxDelayStateEl, key: "delay" },
        { el: fxChorusEl, stateEl: fxChorusStateEl, key: "chorus" }
    ];
    options.forEach((option) => {
        const on = fxState[option.key];
        option.el.classList.toggle("is-on", on);
        option.el.setAttribute("aria-pressed", on ? "true" : "false");
        option.stateEl.textContent = on ? "ON" : "OFF";
    });

    if (audioCtx && fxDelayWet && fxReverbWet && fxChorusWet) {
        const now = audioCtx.currentTime;
        fxReverbWet.gain.setTargetAtTime(fxState.reverb ? 0.3 : 0, now, 0.02);
        fxDelayWet.gain.setTargetAtTime(fxState.delay ? 0.35 : 0, now, 0.02);
        fxChorusWet.gain.setTargetAtTime(fxState.chorus ? 0.25 : 0, now, 0.02);
    }
}

function toggleFx(effect) {
    fxState[effect] = !fxState[effect];
    applyFxState();
    saveState();
}

/* --- Loop recorder --- */

function renderTunes() {
    loopRecEl.classList.toggle("is-on", loopState.recording);
    loopRecEl.textContent = loopState.recording ? "■ STOP" : "● REC";
    loopPlayEl.classList.toggle("is-on", loopState.playing);
    loopStatusEl.classList.remove("is-live", "is-playing");

    let status = "IDLE";
    if (loopState.recording) {
        status = "RECORDING…";
        loopStatusEl.classList.add("is-live");
    } else if (loopState.playing) {
        status = "LOOP " + loopState.duration.toFixed(1) + "s";
        loopStatusEl.classList.add("is-playing");
    } else if (loopState.events.length > 0) {
        status = "LOOP " + loopState.duration.toFixed(1) + "s";
    }
    loopStatusEl.textContent = status;

    arpTglEl.classList.toggle("is-on", arpOn);
    arpTglEl.textContent = arpOn ? "ARP: ON" : "ARP: OFF";
    arpRateEl.textContent = "RATE " + ARP_RATES[arpRateIndex].label;
}

function recordNoteEvent(type, midi, wave) {
    if (!loopState.recording || !audioCtx) {
        return;
    }
    loopState.events.push({
        time: audioCtx.currentTime - loopState.recStart,
        type: type,
        midi: midi,
        wave: wave
    });
}

function startLoopRecording() {
    if (!ensureAudio()) {
        statusEl.textContent = "Audio unavailable";
        return;
    }
    stopLoopPlayback();
    loopState.events = [];
    loopState.duration = 0;
    loopState.recording = true;
    loopState.recStart = audioCtx.currentTime;
    renderTunes();
    setFxButtonLabel();
    statusEl.textContent = "Recording…";
}

function stopLoopRecording() {
    if (!loopState.recording) {
        return;
    }
    loopState.recording = false;
    if (loopState.events.length === 0) {
        renderTunes();
        setFxButtonLabel();
        statusEl.textContent = "Empty loop";
        return;
    }
    // Loop length: last note + a little tail, so the phrase rings out.
    const last = loopState.events[loopState.events.length - 1].time;
    loopState.duration = clamp(last + 0.6, 1.5, 16);
    startLoopPlayback();
    renderTunes();
    setFxButtonLabel();
    statusEl.textContent = "Loop " + loopState.duration.toFixed(1) + "s";
}

function startLoopPlayback() {
    if (loopState.events.length === 0 || !ensureAudio()) {
        return;
    }
    loopState.recording = false;
    loopState.playing = true;
    loopState.loopStart = audioCtx.currentTime + 0.05;
    loopState.nextIndex = 0;
    killLoopVoices();
    scheduleLoop();
    loopState.schedulerTimer = setInterval(scheduleLoop, 100);
    renderTunes();
    setFxButtonLabel();
}

function stopLoopPlayback() {
    loopState.playing = false;
    if (loopState.schedulerTimer) {
        clearInterval(loopState.schedulerTimer);
        loopState.schedulerTimer = null;
    }
    killLoopVoices();
    renderTunes();
}

function clearLoop() {
    loopState.recording = false;
    stopLoopPlayback();
    loopState.events = [];
    loopState.duration = 0;
    renderTunes();
    setFxButtonLabel();
    statusEl.textContent = "Loop cleared";
}

function killLoopVoices() {
    if (!audioCtx) {
        loopState.loopVoices.clear();
        return;
    }
    const now = audioCtx.currentTime;
    loopState.loopVoices.forEach((voice) => {
        try {
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(0.0001, now);
            voice.osc.stop(now + 0.001);
            voice.osc.disconnect();
            voice.gain.disconnect();
        } catch (error) {
            // Already stopped.
        }
    });
    loopState.loopVoices.clear();
}

// Lookahead scheduler: schedules every event in the next ~300ms window on
// each tick, and wraps the loop by advancing loopStart by the duration.
function scheduleLoop() {
    if (!loopState.playing || !audioCtx) {
        return;
    }
    const horizon = audioCtx.currentTime + 0.3;
    const events = loopState.events;
    while (loopState.nextIndex < events.length) {
        const ev = events[loopState.nextIndex];
        const t = loopState.loopStart + ev.time;
        if (t > horizon) {
            break;
        }
        if (ev.type === "on") {
            scheduleLoopOn(ev, t);
        } else {
            scheduleLoopOff(ev, t);
        }
        loopState.nextIndex += 1;
    }
    if (loopState.nextIndex >= events.length) {
        loopState.loopStart += loopState.duration;
        loopState.nextIndex = 0;
    }
}

function scheduleLoopOn(ev, t) {
    const existing = loopState.loopVoices.get(ev.midi);
    if (existing) {
        releaseLoopVoice(existing, t);
        loopState.loopVoices.delete(ev.midi);
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = ev.wave || "sawtooth";
    osc.frequency.value = midiToFreq(ev.midi);
    osc.connect(gain);
    gain.connect(filter);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    osc.start(t);
    loopState.loopVoices.set(ev.midi, { osc: osc, gain: gain });
}

function scheduleLoopOff(ev, t) {
    const voice = loopState.loopVoices.get(ev.midi);
    if (voice) {
        releaseLoopVoice(voice, t);
        loopState.loopVoices.delete(ev.midi);
    }
}

function releaseLoopVoice(voice, t) {
    try {
        voice.gain.gain.cancelScheduledValues(t);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        voice.osc.stop(t + 0.1);
    } catch (error) {
        // Already stopped.
    }
}

/* --- Arpeggiator --- */

function setArpOn(on) {
    arpOn = on;
    if (arpOn) {
        if (!arpTimer) {
            arpTimer = setInterval(arpTick, ARP_RATES[arpRateIndex].ms);
        }
    } else if (arpTimer) {
        clearInterval(arpTimer);
        arpTimer = null;
    }
    renderTunes();
    saveState();
}

function cycleArpRate() {
    arpRateIndex = (arpRateIndex + 1) % ARP_RATES.length;
    if (arpTimer) {
        clearInterval(arpTimer);
        arpTimer = setInterval(arpTick, ARP_RATES[arpRateIndex].ms);
    }
    renderTunes();
    saveState();
}

function arpTick() {
    const held = Array.from(keyVoiceMap.keys());
    if (held.length === 0 || !ensureAudio()) {
        return;
    }
    const freqs = held
        .map((keyIndex) => midiToFreq(midiForKey(keyIndex)))
        .sort((a, b) => a - b);
    const freq = freqs[arpStep % freqs.length];
    arpStep += 1;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = currentWave().id;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(filter);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.7, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.12);
}

function setKeyHeld(keyIndex, held) {
    const key = keyEls[keyIndex];
    key.classList.toggle("is-held", held);
    key.setAttribute("aria-pressed", held ? "true" : "false");
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

    if (voice.keyIndex !== -1) {
        keyVoiceMap.delete(voice.keyIndex);
        setKeyHeld(voice.keyIndex, false);
    }

    voice.osc = null;
    voice.gain = null;
    voice.keyIndex = -1;
    voice.active = false;
}

function releaseVoice(voice) {
    if (!voice.active || !voice.gain || !audioCtx) {
        return;
    }

    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + adsr.release);

    const osc = voice.osc;
    const keyIndex = voice.keyIndex;
    voice.active = false;
    voice.keyIndex = -1;
    voice.osc = null;
    voice.gain = null;

    if (keyIndex !== -1) {
        keyVoiceMap.delete(keyIndex);
        setKeyHeld(keyIndex, false);
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
    }, adsr.release * 1000 + 100);
}

function startKey(keyIndex) {
    if (!ensureAudio()) {
        statusEl.textContent = "Audio unavailable";
        return;
    }

    const existing = keyVoiceMap.get(keyIndex);
    if (existing) {
        return;
    }

    let voice = findFreeVoice();
    if (!voice) {
        voice = findOldestVoice();
        stopVoiceImmediate(voice);
    }

    const freq = midiToFreq(midiForKey(keyIndex));
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = currentWave().id;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(filter);

    // ADSR envelope: attack up to peak, decay down to sustain, hold.
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + adsr.attack);
    if (adsr.decay > 0) {
        gain.gain.exponentialRampToValueAtTime(
            Math.max(adsr.sustain, 0.0001),
            now + adsr.attack + adsr.decay
        );
    }
    osc.start(now);

    voice.osc = osc;
    voice.gain = gain;
    voice.keyIndex = keyIndex;
    voice.active = true;
    keyVoiceMap.set(keyIndex, voice);
    setKeyHeld(keyIndex, true);

    recordNoteEvent("on", midiForKey(keyIndex), currentWave().id);
    statusEl.textContent = midiToName(midiForKey(keyIndex)) + " " + freq.toFixed(1) + " Hz";
}

function stopKey(keyIndex) {
    recordNoteEvent("off", midiForKey(keyIndex), currentWave().id);
    const voice = keyVoiceMap.get(keyIndex);
    if (!voice) {
        setKeyHeld(keyIndex, false);
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
    keyVoiceMap.clear();
    keyEls.forEach((key, index) => setKeyHeld(index, false));
    pressedKeys.clear();
    statusEl.textContent = "All notes off";
}

function renderHeader() {
    const wave = currentWave();
    waveLabelEl.textContent = wave.label;
    octaveLabelEl.textContent = "C" + octave;
    cutoffFillEl.style.width = cutoff + "%";
    cutoffValueEl.textContent = String(cutoff);
    applyFxState();
}

function setCutoff(value) {
    cutoff = clamp(Math.round(value), 0, 100);
    applyFilterCutoff();
    renderHeader();
    saveState();
}

function cycleWave(delta) {
    waveIndex = (waveIndex + delta + WAVES.length) % WAVES.length;
    // Retune held voices so the waveform change is heard immediately.
    voices.forEach((voice) => {
        if (voice.active && voice.osc) {
            voice.osc.type = currentWave().id;
        }
    });
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
    if (inFxView) {
        closeFxView();
        return;
    }
    cycleWave(1);
}

/* --- FX view navigation --- */

function showFxPage(index) {
    fxPageIndex = index;
    fxEffectsEl.hidden = index !== 0;
    fxAdsrEl.hidden = index !== 1;
    fxTunesEl.hidden = index !== 2;
    tabEffectsEl.classList.toggle("is-active", index === 0);
    tabAdsrEl.classList.toggle("is-active", index === 1);
    tabTunesEl.classList.toggle("is-active", index === 2);
    tabEffectsEl.setAttribute("aria-selected", index === 0 ? "true" : "false");
    tabAdsrEl.setAttribute("aria-selected", index === 1 ? "true" : "false");
    tabTunesEl.setAttribute("aria-selected", index === 2 ? "true" : "false");
}

function cycleFxPage(delta) {
    showFxPage((fxPageIndex + delta + 3) % 3);
}

function openFxView() {
    inFxView = true;
    mainViewEl.hidden = true;
    fxViewEl.hidden = false;
    showFxPage(fxPageIndex);
    statusEl.textContent = "Effects";
}

function closeFxView() {
    inFxView = false;
    fxViewEl.hidden = true;
    mainViewEl.hidden = false;
}

/* --- ADSR sliders --- */

function adsrFractionFromEvent(param, event) {
    const row = adsrRows.find((row) => row.dataset.param === param);
    const rect = row.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
}

function adsrValueFromFraction(param, fraction) {
    const cfg = ADSR_PARAMS[param];
    return cfg.min + fraction * (cfg.max - cfg.min);
}

function formatAdsrValue(param, value) {
    if (param === "sustain") {
        return Math.round(value * 100) + "%";
    }
    return Math.round(value * 1000) + "ms";
}

function renderAdsr() {
    adsrRows.forEach((row) => {
        const param = row.dataset.param;
        const value = adsr[param];
        const fraction = (value - ADSR_PARAMS[param].min) / (ADSR_PARAMS[param].max - ADSR_PARAMS[param].min);
        row.querySelector(".adsr-fill").style.width = fraction * 100 + "%";
        row.querySelector(".adsr-value").textContent = formatAdsrValue(param, value);
        row.classList.toggle("is-selected", adsrDrag === param);
    });
}

function updateAdsrFromEvent(param, event) {
    adsr[param] = adsrValueFromFraction(param, adsrFractionFromEvent(param, event));
    renderAdsr();
    saveState();
}

function initializeAdsr() {
    adsrRows.forEach((row) => {
        const param = row.dataset.param;
        const onDown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            adsrDrag = param;
            renderAdsr();
            updateAdsrFromEvent(param, event);
        };
        const onMove = (event) => {
            if (adsrDrag === param) {
                event.preventDefault();
                updateAdsrFromEvent(param, event);
            }
        };
        const onUp = (event) => {
            if (adsrDrag === param) {
                event.preventDefault();
                adsrDrag = null;
                renderAdsr();
                saveState();
            }
        };

        row.addEventListener("pointerdown", onDown);
        row.addEventListener("pointermove", onMove);
        row.addEventListener("pointerup", onUp);
        row.addEventListener("pointercancel", onUp);
        row.addEventListener("touchstart", onDown, { passive: false });
        row.addEventListener("touchmove", onMove, { passive: false });
        row.addEventListener("touchend", onUp, { passive: false });
        row.addEventListener("touchcancel", onUp, { passive: false });
    });
}

/* --- Input wiring --- */

function initializeKeys() {
    keyEls.forEach((key, index) => {
        const onDown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            startKey(index);
        };
        const onUp = (event) => {
            event.preventDefault();
            event.stopPropagation();
            stopKey(index);
        };
        const onEnter = (event) => {
            // Slide across keys (glissando) while a pointer is held down.
            if (event.buttons > 0) {
                startKey(index);
            }
        };

        key.addEventListener("pointerdown", onDown);
        key.addEventListener("pointerup", onUp);
        key.addEventListener("pointerleave", onUp);
        key.addEventListener("pointercancel", onUp);
        key.addEventListener("pointerenter", onEnter);
        key.addEventListener("touchstart", onDown, { passive: false });
        key.addEventListener("touchend", onUp, { passive: false });
        key.addEventListener("touchcancel", onUp, { passive: false });
    });
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => {
        if (inFxView) {
            cycleFxPage(-1);
        } else {
            setCutoff(cutoff - 2);
        }
    });
    window.addEventListener("scrollDown", () => {
        if (inFxView) {
            cycleFxPage(1);
        } else {
            setCutoff(cutoff + 2);
        }
    });
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
    fxBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        openFxView();
    });
    fxBackEl.addEventListener("click", (event) => {
        event.stopPropagation();
        closeFxView();
    });
    tabEffectsEl.addEventListener("click", (event) => {
        event.stopPropagation();
        showFxPage(0);
    });
    tabAdsrEl.addEventListener("click", (event) => {
        event.stopPropagation();
        showFxPage(1);
    });
    tabTunesEl.addEventListener("click", (event) => {
        event.stopPropagation();
        showFxPage(2);
    });
    loopRecEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (loopState.recording) {
            stopLoopRecording();
        } else {
            startLoopRecording();
        }
    });
    loopPlayEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (loopState.events.length === 0) {
            return;
        }
        if (loopState.playing) {
            stopLoopPlayback();
        } else {
            startLoopPlayback();
        }
    });
    loopClearEl.addEventListener("click", (event) => {
        event.stopPropagation();
        clearLoop();
    });
    arpTglEl.addEventListener("click", (event) => {
        event.stopPropagation();
        setArpOn(!arpOn);
    });
    arpRateEl.addEventListener("click", (event) => {
        event.stopPropagation();
        cycleArpRate();
    });
    fxReverbEl.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFx("reverb");
    });
    fxDelayEl.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFx("delay");
    });
    fxChorusEl.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFx("chorus");
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (inFxView) {
                cycleFxPage(-1);
            } else {
                setCutoff(cutoff - 2);
            }
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (inFxView) {
                cycleFxPage(1);
            } else {
                setCutoff(cutoff + 2);
            }
            return;
        }
        if (event.key === "c" || event.key === "C") {
            event.preventDefault();
            cycleWave(1);
            return;
        }
        if (event.key === "v" || event.key === "V") {
            event.preventDefault();
            if (inFxView) {
                closeFxView();
            } else {
                openFxView();
            }
            return;
        }
        if (event.key === "z" || event.key === "Z") {
            event.preventDefault();
            setOctave(octave - 1);
            return;
        }
        if (event.key === "x" || event.key === "X") {
            event.preventDefault();
            setOctave(octave + 1);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            if (inFxView) {
                closeFxView();
            } else {
                allNotesOff();
            }
            return;
        }
        if (inFxView && fxPageIndex === 0) {
            const fxKeyIndex = ["1", "2", "3"].indexOf(event.key);
            if (fxKeyIndex !== -1) {
                event.preventDefault();
                toggleFx(FX_IDS[fxKeyIndex]);
                return;
            }
        }
        if (inFxView && fxPageIndex === 2) {
            if (event.key === "1") {
                event.preventDefault();
                if (loopState.recording) {
                    stopLoopRecording();
                } else {
                    startLoopRecording();
                }
                return;
            }
            if (event.key === "2") {
                event.preventDefault();
                if (loopState.events.length > 0) {
                    if (loopState.playing) {
                        stopLoopPlayback();
                    } else {
                        startLoopPlayback();
                    }
                }
                return;
            }
            if (event.key === "3") {
                event.preventDefault();
                clearLoop();
                return;
            }
            if (event.key === "4") {
                event.preventDefault();
                setArpOn(!arpOn);
                return;
            }
            if (event.key === "5") {
                event.preventDefault();
                cycleArpRate();
                return;
            }
        }

        const keyIndex = KEYBOARD_MAP[event.key];
        if (keyIndex !== undefined && !event.repeat && !pressedKeys.has(event.key)) {
            event.preventDefault();
            pressedKeys.set(event.key, keyIndex);
            startKey(keyIndex);
        }
    });

    window.addEventListener("keyup", (event) => {
        const keyIndex = pressedKeys.get(event.key);
        if (keyIndex !== undefined) {
            event.preventDefault();
            pressedKeys.delete(event.key);
            stopKey(keyIndex);
        }
    });
}

function initializeNoteOffSafety() {
    // If the app is backgrounded or the WebView is torn down while keys are
    // held, the pointer events never fire and notes would ring forever.
    const stopEngines = () => {
        allNotesOff();
        stopLoopPlayback();
        if (arpTimer) {
            clearInterval(arpTimer);
            arpTimer = null;
        }
    };
    const stopIfHidden = () => {
        if (document.hidden) {
            stopEngines();
        }
    };
    window.addEventListener("blur", stopEngines);
    window.addEventListener("pagehide", stopEngines);
    document.addEventListener("visibilitychange", stopIfHidden);
}

function saveState() {
    const snapshot = {
        wave: currentWave().id,
        cutoff: cutoff,
        octave: octave,
        fx: Object.assign({}, fxState),
        adsr: Object.assign({}, adsr),
        arp: { on: arpOn, rate: arpRateIndex }
    };
    const payload = JSON.stringify(snapshot);

    try {
        if (window.creationStorage && window.creationStorage.plain) {
            window.creationStorage.plain.setItem(STORAGE_KEY, btoa(payload));
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
    if (saved.fx && typeof saved.fx === "object") {
        FX_IDS.forEach((id) => {
            if (typeof saved.fx[id] === "boolean") {
                fxState[id] = saved.fx[id];
            }
        });
    }
    if (saved.adsr && typeof saved.adsr === "object") {
        Object.keys(ADSR_PARAMS).forEach((param) => {
            if (typeof saved.adsr[param] === "number") {
                const cfg = ADSR_PARAMS[param];
                adsr[param] = clamp(saved.adsr[param], cfg.min, cfg.max);
            }
        });
    }
    if (saved.arp && typeof saved.arp === "object") {
        if (typeof saved.arp.on === "boolean") {
            arpOn = saved.arp.on;
        }
        if (
            typeof saved.arp.rate === "number" &&
            saved.arp.rate >= 0 &&
            saved.arp.rate < ARP_RATES.length
        ) {
            arpRateIndex = saved.arp.rate;
        }
    }
}

async function init() {
    const saved = await loadState();
    applySavedState(saved);
    renderHeader();
    renderAdsr();
    renderTunes();
    if (arpOn) {
        setArpOn(true);
    }
    initializeKeys();
    initializeHardware();
    initializeFallbackInput();
    initializeNoteOffSafety();
    initializeAdsr();
}

document.addEventListener("DOMContentLoaded", () => {
    init();
});