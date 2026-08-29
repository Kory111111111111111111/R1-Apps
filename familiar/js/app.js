const STORAGE_KEY = "familiarState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const LLM_TIMEOUT_MS = 20000;
const SPEAK_COOLDOWN_MS = 20000;
const MAX_DECAY_HOURS = 24;
const NAME_MAX = 8;
const SIGN_LEN = 3;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ- ";
const TRAITS = ["chill", "nocturnal", "fussy", "clingy"];
const ACTIONS = ["FEED", "PLAY", "WALK", "BAG", "SLEEP", "SIGN", "NAME", "CAM"];
const STAGES = ["EGG", "BABY", "TEEN", "ADULT"];

const FOODS = [
    { id: "berry", name: "🍓 BERRY", desc: "Sweet & juicy", hunger: 25, happy: 12, nrg: 2, icon: "🍓" },
    { id: "pizza", name: "🍕 PIZZA", desc: "Warm & filling", hunger: 48, happy: 8, nrg: -4, icon: "🍕" },
    { id: "candy", name: "⚡ CANDY", desc: "Surge of zoomies!", hunger: 10, happy: 18, nrg: 28, zoomies: true, icon: "⚡" },
    { id: "pepper", name: "🌶️ PEPPER", desc: "Super spicy shock!", hunger: 15, happy: -6, nrg: 15, spice: true, icon: "🌶️" },
    { id: "tea", name: "🍵 ZEN TEA", desc: "Calms fussy pets", hunger: 8, happy: 22, nrg: 5, calm: true, icon: "🍵" }
];

const ARTIFACTS = [
    { id: "bolt", name: "Shiny Bolt", rarity: "★☆☆", desc: "Twinkles when rubbed.", icon: "🔩" },
    { id: "floppy", name: "Ancient Floppy", rarity: "★☆☆", desc: "1.44MB of pure memories.", icon: "💾" },
    { id: "shroom", name: "Glow Shroom", rarity: "★☆☆", desc: "Emits gentle neon light.", icon: "🍄" },
    { id: "token", name: "Lucky Token", rarity: "★★☆", desc: "Stamped with an R1 rabbit.", icon: "🪙" },
    { id: "clover", name: "Digital Clover", rarity: "★★☆", desc: "Four pixelated leaves.", icon: "🍀" },
    { id: "acorn", name: "Golden Acorn", rarity: "★★☆", desc: "Bit guards it with pride.", icon: "🌰" },
    { id: "crystal", name: "Chrono Crystal", rarity: "★★★", desc: "Pulses with time energy.", icon: "🔮" },
    { id: "star", name: "Star Fragment", rarity: "★★★", desc: "Fell from the top bezel.", icon: "🌟" }
];

const PALETTES = {
    chill: {
        O: "#1a0e06",
        C: "#ff6a00",
        S: "#c2410c",
        H: "#fed7aa",
        W: "#ffffff",
        B: "#0f0f14",
        P: "#fb7185",
        R: "#e11d48",
        K: "#94a3b8"
    },
    nocturnal: {
        O: "#0a0614",
        C: "#6366f1",
        S: "#4338ca",
        H: "#a5b4fc",
        W: "#22d3ee",
        B: "#050814",
        P: "#c084fc",
        R: "#818cf8",
        K: "#64748b"
    },
    fussy: {
        O: "#181004",
        C: "#f59e0b",
        S: "#b45309",
        H: "#fef08a",
        W: "#ffffff",
        B: "#181005",
        P: "#f43f5e",
        R: "#e11d48",
        K: "#94a3b8"
    },
    clingy: {
        O: "#1c0a12",
        C: "#fb7185",
        S: "#e11d48",
        H: "#ffe4e6",
        W: "#ffffff",
        B: "#1a0810",
        P: "#fda4af",
        R: "#f43f5e",
        K: "#94a3b8"
    }
};

// DOM Elements
const petEl = document.getElementById("pet");
const petCanvas = document.getElementById("petCanvas");
const nameLabelEl = document.getElementById("nameLabel");
const metaLabelEl = document.getElementById("metaLabel");
const speechEl = document.getElementById("speech");
const actionBtnEl = document.getElementById("actionBtn");
const hintEl = document.getElementById("hint");
const camEl = document.getElementById("cam");
const barHappyEl = document.getElementById("barHappy");
const barHungerEl = document.getElementById("barHunger");
const barEnergyEl = document.getElementById("barEnergy");
const meterHappyEl = document.getElementById("meterHappy");
const meterHungerEl = document.getElementById("meterHunger");
const meterEnergyEl = document.getElementById("meterEnergy");
const statusEl = document.getElementById("status");
const particlesLayerEl = document.getElementById("particlesLayer");
const gameLayerEl = document.getElementById("gameLayer");
const gameScoreLabelEl = document.getElementById("gameScoreLabel");
const gameTimerLabelEl = document.getElementById("gameTimerLabel");
const gameArenaEl = document.getElementById("gameArena");

let lastSideClickAt = 0;
let actionIndex = 0;
let speaking = false;
let lastSpeakAt = 0;
let lastAccel = null;
let lastShakeAt = 0;
let accelStarted = false;
let mode = "care"; // care | food | bag | game | name | sign
let foodIndex = 0;
let bagIndex = 0;
let letterIndex = 0;
let nameDraft = "";
let signBuffer = [];
let camOn = false;
let camStream = null;
let micTimer = null;
let micStream = null;
let micSource = null;
let micAnalyser = null;
let audioCtx = null;
let lastMicBoostAt = 0;
let micMuteUntil = 0;
let liveTickTimer = null;
let animTimeout = null;
let spriteAnimFrame = 0;
let spriteAnimTimer = null;

// Mini-game state
let gameActive = false;
let gameScore = 0;
let gameTimer = 10;
let gameInterval = null;
let gameSpawnInterval = null;
let gamePetX = 0;
let gameItems = [];

let pendingLlmResolve = null;
let pendingLlmReject = null;
let llmTimeoutId = null;

const state = {
    name: "BIT",
    trait: "",
    hatched: false,
    hunger: 70,
    happiness: 70,
    energy: 80,
    bond: 10,
    ageHours: 0,
    sleeping: false,
    lastSeen: Date.now(),
    bornAt: Date.now(),
    hatchedAt: 0,
    care: { feed: 0, play: 0, sleep: 0, walk: 0 },
    bag: [],
    neglectMarks: 0,
    handshake: [],
    favFood: "",
    dislikeFood: "",
    camPref: false
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hasPluginHandler() {
    return typeof PluginMessageHandler !== "undefined";
}

function dayNumber() {
    const start = state.hatched && state.hatchedAt ? state.hatchedAt : state.bornAt;
    return Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1);
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
    const seed = state.hatchedAt || state.bornAt || Date.now();
    return TRAITS[Math.abs(Math.floor(seed)) % TRAITS.length];
}

function setupTastes() {
    const seed = Math.abs(Math.floor(state.bornAt || Date.now()));
    state.favFood = FOODS[seed % FOODS.length].id;
    state.dislikeFood = FOODS[(seed + 2) % FOODS.length].id;
}

function hatchIfNeeded() {
    if (state.hatched) {
        return;
    }
    state.hatched = true;
    state.hatchedAt = Date.now();
    state.bornAt = Date.now();
    state.ageHours = 0;
    if (!state.trait) {
        state.trait = pickTrait();
    }
    if (!state.favFood) {
        setupTastes();
    }
    spawnParticle("✨", 0, -10);
    spawnParticle("💖", -15, -20);
    spawnParticle("🐣", 15, -20);
    sfxWin();
}

// ==========================================
// PIXEL ART SPRITE MATRIX ENGINE
// ==========================================

const SPRITES = {
    EGG: [
        // Frame 0: Normal Egg
        [
            "..........OOOO..........",
            "........OOCHHHOO........",
            ".......OCHHHCCCCO.......",
            "......OCHHCCCCCCCO......",
            ".....OCHHCKCCCCCCSO.....",
            "....OCHCCCCKCCCCCSCO....",
            "...OCHHCCCCKCCCCCSCCO...",
            "...OCHCCCCCSCCCCSSSSO...",
            "..OCHHCCCCCSCCCCSSSSSO..",
            "..OCHCCCCSSSSCCSSSSSSO..",
            "..OCHCCCCSSSSSSSSSSSSO..",
            "..OCHCCCCWBSSSSWBSSSSO..",
            "..OCHCCCCBWSSSSBWSSSSO..",
            "..OCHCCCCSSSSSSSSSSSSO..",
            "...OCHCCCCSSRRSCCSSSO...",
            "...OCHCCCCSSSSSSSSSSO...",
            "....OCHCCCCSSSSSSSCO....",
            ".....OCCCCSSSSSSSSO.....",
            "......OOCCCCCCCCCO......",
            "........OOOOOOOO........"
        ],
        // Frame 1: Wobble Egg
        [
            "..........OOOO..........",
            "........OOCHHHOO........",
            ".......OCHHHCCCCO.......",
            "......OCHHCCCCCCCO......",
            ".....OCHHCKCCCCCCSO.....",
            "....OCHCCCCKCCCCCSCO....",
            "...OCHHCCCCKCCCCCSCCO...",
            "...OCHCCCCCSCCCCSSSSO...",
            "..OCHHCCCCCSCCCCSSSSSO..",
            "..OCHCCCCSSSSCCSSSSSSO..",
            "..OCHCCCCSSSSSSSSSSSSO..",
            "..OCHCCCCWBSSSSWBSSSSO..",
            "..OCHCCCCBWSSSSBWSSSSO..",
            "..OCHCCCCSSSSSSSSSSSSO..",
            "...OCHCCCCSSRRSCCSSSO...",
            "...OCHCCCCSSSSSSSSSSO...",
            "....OCHCCCCSSSSSSSCO....",
            ".....OCCCCSSSSSSSSO.....",
            "......OOCCCCCCCCCO......",
            "........OOOOOOOO........"
        ]
    ],
    BABY: [
        // Frame 0: Idle 1
        [
            "......OO..........OO......",
            ".....OCHPO......OPHCSO....",
            "....OCHCCSO....OSCCCCO....",
            "....OCHCCSO....OSCCCCO....",
            ".....OOOO........OOOO.....",
            "......OOOOOOOOOOOOOO......",
            "....OOCHHHHHHHHHHCCCOO....",
            "...OCHHHHHHHHHHHCCCCCSO...",
            "..OCHHHHHHHHHHHCCCCCCCCO..",
            ".OCHHH..HHHHHHH..CCCCCCSO.",
            ".OCHHHWBHHHHHHHWBCCCCCCSO.",
            ".OCHHHBBHHHHHHHBBCCCCCCSO.",
            ".OCHHH..HHHHHHH..CCCCCCSO.",
            ".OCHHPPHHHHHHHHPPSCCCCSO..",
            ".OCHHHHSSRRRRSSHHCCCCCSO..",
            "..OCHHHHSRRRRSHHCCCCCCSO..",
            "..OCHHHHHSSSSHHHCCCCCCSO..",
            "...OCHHHHHHHHHHCCCCCCSO...",
            "....OOOOCCCCCCCCCCSOOO....",
            ".......OCHHSS..OCHHSS.....",
            ".......OOOOOO..OOOOOO....."
        ],
        // Frame 1: Idle 2 (Blink/Bob)
        [
            "......OO..........OO......",
            ".....OCHPO......OPHCSO....",
            "....OCHCCSO....OSCCCCO....",
            "....OCHCCSO....OSCCCCO....",
            ".....OOOO........OOOO.....",
            "......OOOOOOOOOOOOOO......",
            "....OOCHHHHHHHHHHCCCOO....",
            "...OCHHHHHHHHHHHCCCCCSO...",
            "..OCHHHHHHHHHHHCCCCCCCCO..",
            ".OCHHH..HHHHHHH..CCCCCCSO.",
            ".OCHHH--HHHHHHH--CCCCCCSO.",
            ".OCHHHBBHHHHHHHBBCCCCCCSO.",
            ".OCHHH..HHHHHHH..CCCCCCSO.",
            ".OCHHPPHHHHHHHHPPSCCCCSO..",
            ".OCHHHHSSRRRRSSHHCCCCCSO..",
            "..OCHHHHSRRRRSHHCCCCCCSO..",
            "..OCHHHHHSSSSHHHCCCCCCSO..",
            "...OCHHHHHHHHHHCCCCCCSO...",
            "....OOOOCCCCCCCCCCSOOO....",
            ".......OCHHSS..OCHHSS.....",
            ".......OOOOOO..OOOOOO....."
        ],
        // Frame 2: Chomp Eat
        [
            "......OO..........OO......",
            ".....OCHPO......OPHCSO....",
            "....OCHCCSO....OSCCCCO....",
            ".....OOOO........OOOO.....",
            "......OOOOOOOOOOOOOO......",
            "....OOCHHHHHHHHHHCCCOO....",
            "...OCHHHHHHHHHHHCCCCCSO...",
            "..OCHHHHHHHHHHHCCCCCCCCO..",
            ".OCHHHWBHHHHHHHWBCCCCCCSO.",
            ".OCHHHBBHHHHHHHBBCCCCCCSO.",
            ".OCHHPPHHHHHHHHPPSCCCCSO..",
            ".OCHHHSSSSSSSSSSHHCCCCSO..",
            ".OCHHSRRRRRRRRRRSHCCCCSO..",
            "..OCHSRRRRRRRRRRSHCCCCSO..",
            "..OCHHSSSSSSSSSSHHCCCCSO..",
            "...OCHHHHHHHHHHCCCCCCSO...",
            "....OOOOCCCCCCCCCCSOOO....",
            ".......OCHHSS..OCHHSS.....",
            ".......OOOOOO..OOOOOO....."
        ]
    ],
    TEEN: [
        // Frame 0: Idle
        [
            "....OO..............OO....",
            "...OCHSO..........OSHCCO..",
            "..OCHHCSO........OSCCCCO..",
            "..OCHHCSO........OSCCCCO..",
            "...OOO..............OOO...",
            ".....OOOOOOOOOOOOOOOO.....",
            "...OOCHHHHHHHHHHHHHHCCOO..",
            "..OCHHHHHHHHHHHHHHCCCCCSO.",
            ".OCHHHHHHHHHHHHHHCCCCCCCSO",
            ".OCHHHWBHHHHHHHHWBCCCCCCSO",
            ".OCHHHBBHHHHHHHHBBCCCCCCSO",
            ".OCHHPPHHHHHHHHHPPSCCCCCSO",
            ".OCHHHHSSRRRRSSHHHCCCCCCSO",
            ".OCHHHHHSSSSSSHHHHCCCCCCSO",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "...OOCHHHHHHHHHHHCCCCSOO..",
            "....OOCCCCCCCCCCCCCSOO....",
            "....OCHHSS......OCHHSS....",
            "....OOOOOO......OOOOOO...."
        ],
        // Frame 1: Walk Step
        [
            "....OO..............OO....",
            "...OCHSO..........OSHCCO..",
            "..OCHHCSO........OSCCCCO..",
            "..OCHHCSO........OSCCCCO..",
            "...OOO..............OOO...",
            ".....OOOOOOOOOOOOOOOO.....",
            "...OOCHHHHHHHHHHHHHHCCOO..",
            "..OCHHHHHHHHHHHHHHCCCCCSO.",
            ".OCHHHHHHHHHHHHHHCCCCCCCSO",
            ".OCHHHWBHHHHHHHHWBCCCCCCSO",
            ".OCHHHBBHHHHHHHHBBCCCCCCSO",
            ".OCHHPPHHHHHHHHHPPSCCCCCSO",
            ".OCHHHHSSRRRRSSHHHCCCCCCSO",
            ".OCHHHHHSSSSSSHHHHCCCCCCSO",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "...OOCHHHHHHHHHHHCCCCSOO..",
            "....OOCCCCCCCCCCCCCSOO....",
            ".....OCHHSS....OCHHSS.....",
            ".....OOOOOO....OOOOOO....."
        ]
    ],
    ADULT: [
        // Frame 0: Idle
        [
            "...OO......OOOO......OO...",
            "..OCHSO...OCCHCCO...OSHCCO",
            ".OCHHCSO.OCHCCCCCO.OSCCCCO",
            ".OCHHCSO.OCHCCCCCO.OSCCCCO",
            "..OOOO.....OOOOO.....OOOO.",
            "....OOOOOOOOOOOOOOOOOO....",
            "..OOCHHHHHHHHHHHHHHHHCCOO.",
            ".OCHHHHHHHHHHHHHHHHCCCCCSO",
            "OCHHHHHHHHHHHHHHHHCCCCCCCS",
            "OCHHHWBHHHHHHHHHHWBCCCCCCS",
            "OCHHHBBHHHHHHHHHHBBCCCCCCS",
            "OCHHPPHHHHHHHHHHHPPSCCCCCS",
            "OCHHHHHSSRRRRRRSSHHCCCCCCS",
            "OCHHHHHHSRRRRRRSHHHCCCCCCS",
            ".OCHHHHHHSSSSSSHHHHCCCCCSO",
            ".OCHHHHHHHHHHHHHHHCCCCCSO.",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "...OOCHHHHHHHHHHHCCCCSOO..",
            "....OOCCCCCCCCCCCCCSOO....",
            "....OCHHSS......OCHHSS....",
            "....OOOOOO......OOOOOO...."
        ],
        // Frame 1: Happy / Wag
        [
            "...OO......OOOO......OO...",
            "..OCHSO...OCCHCCO...OSHCCO",
            ".OCHHCSO.OCHCCCCCO.OSCCCCO",
            ".OCHHCSO.OCHCCCCCO.OSCCCCO",
            "..OOOO.....OOOOO.....OOOO.",
            "....OOOOOOOOOOOOOOOOOO....",
            "..OOCHHHHHHHHHHHHHHHHCCOO.",
            ".OCHHHHHHHHHHHHHHHHCCCCCSO",
            "OCHHHHHHHHHHHHHHHHCCCCCCCS",
            "OCHHH--HHHHHHHHHH--CCCCCCS",
            "OCHHHBBHHHHHHHHHHBBCCCCCCS",
            "OCHHPPHHHHHHHHHHHPPSCCCCCS",
            "OCHHHHHSSRRRRRRSSHHCCCCCCS",
            "OCHHHHHHSRRRRRRSHHHCCCCCCS",
            ".OCHHHHHHSSSSSSHHHHCCCCCSO",
            ".OCHHHHHHHHHHHHHHHCCCCCSO.",
            "..OCHHHHHHHHHHHHHCCCCCCSO.",
            "...OOCHHHHHHHHHHHCCCCSOO..",
            "....OOCCCCCCCCCCCCCSOO.OOO",
            "....OCHHSS......OCHHSS.OCO",
            "....OOOOOO......OOOOOO.OOO"
        ]
    ]
};

function renderPixelSprite() {
    if (!petCanvas) return;
    const ctx = petCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 32, 32);

    const stageIdx = currentStageIndex();
    const stageName = STAGES[stageIdx];
    const traitKey = state.trait || "chill";
    const palette = PALETTES[traitKey] || PALETTES.chill;

    let spriteList = SPRITES[stageName] || SPRITES.BABY;
    let frameIdx = spriteAnimFrame % spriteList.length;

    // Override frame for specific moods / actions
    if (state.sleeping) {
        frameIdx = 1;
    }

    const matrix = spriteList[frameIdx] || spriteList[0];
    const rows = matrix.length;
    const cols = matrix[0].length;
    const offsetX = Math.floor((32 - cols) / 2);
    const offsetY = Math.floor((32 - rows) / 2);

    for (let r = 0; r < rows; r += 1) {
        const line = matrix[r];
        for (let c = 0; c < cols; c += 1) {
            const char = line[c];
            if (char === "." || char === " ") continue;
            let color = palette[char];

            // If pet is scarred and near eye, render scar pixels
            if (state.neglectMarks > 0 && r === 9 && (c === 8 || c === 9)) {
                color = palette.K;
            }

            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(offsetX + c, offsetY + r, 1, 1);
            }
        }
    }
}

function startSpriteLoop() {
    if (spriteAnimTimer) clearInterval(spriteAnimTimer);
    spriteAnimTimer = setInterval(() => {
        spriteAnimFrame = (spriteAnimFrame + 1) % 2;
        renderPixelSprite();
    }, 800);
}

function renderPixelBar(containerEl, value) {
    if (!containerEl) return;
    if (!containerEl.children.length) {
        containerEl.innerHTML = Array(10).fill('<span class="seg"></span>').join("");
    }
    const filledCount = clamp(Math.round(value / 10), 0, 10);
    const segs = containerEl.children;
    for (let i = 0; i < 10; i += 1) {
        if (i < filledCount) {
            segs[i].classList.add("is-filled");
        } else {
            segs[i].classList.remove("is-filled");
        }
    }
}

function playAnim(animClass, durationMs) {
    if (!petEl) return;
    if (animTimeout) clearTimeout(animTimeout);
    petEl.classList.remove("anim-bounce", "anim-zoomies", "anim-tickle", "anim-panic");
    petEl.classList.add(animClass);
    animTimeout = setTimeout(() => {
        if (petEl) {
            petEl.classList.remove(animClass);
        }
        animTimeout = null;
    }, durationMs || 700);
}

function spawnParticle(text, offsetX, offsetY) {
    if (!particlesLayerEl) return;
    const p = document.createElement("div");
    p.className = "particle";
    p.textContent = text;
    const stageWidth = 220;
    const stageHeight = 120;
    const x = stageWidth / 2 + (offsetX || (Math.random() * 40 - 20));
    const y = stageHeight / 2 + (offsetY || (Math.random() * 20 - 10));
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.setProperty("--dx", (Math.random() * 24 - 12) + "px");
    particlesLayerEl.appendChild(p);
    setTimeout(() => {
        if (p.parentNode) {
            p.parentNode.removeChild(p);
        }
    }, 1250);
}

function ensureAudio() {
    if (audioCtx) {
        if (audioCtx.state === "suspended" && audioCtx.resume) {
            audioCtx.resume().catch(() => { });
        }
        return audioCtx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
        audioCtx = new Ctor();
    } catch (error) {
        audioCtx = null;
    }
    return audioCtx;
}

function playTone(freq, duration, type, delay, gainLevel) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = Math.max(ctx.currentTime, ctx.currentTime + (delay || 0));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    const lvl = gainLevel || 0.08;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(lvl, t0 + Math.min(0.01, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
    micMuteUntil = Date.now() + Math.round((delay || 0) * 1000 + duration * 1000 + 400);
}

function chirp(freq, seconds, delay) {
    playTone(freq, seconds || 0.06, "square", delay, 0.08);
}

function sfxEat() {
    playTone(520, 0.05, "triangle", 0, 0.1);
    playTone(440, 0.05, "triangle", 0.06, 0.1);
    playTone(660, 0.08, "triangle", 0.12, 0.12);
}

function sfxWin() {
    playTone(523, 0.07, "square", 0, 0.08);
    playTone(659, 0.07, "square", 0.08, 0.09);
    playTone(784, 0.07, "square", 0.16, 0.1);
    playTone(1046, 0.18, "square", 0.24, 0.12);
}

function sfxBoing() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.12);
    gain.gain.setValueAtTime(0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
    micMuteUntil = Date.now() + 500;
}

function sfxPurr() {
    playTone(280, 0.08, "sine", 0, 0.06);
    playTone(320, 0.08, "sine", 0.09, 0.07);
    playTone(300, 0.1, "sine", 0.18, 0.06);
}

function sfxItem() {
    playTone(784, 0.08, "triangle", 0, 0.09);
    playTone(987, 0.08, "triangle", 0.09, 0.1);
    playTone(1318, 0.22, "triangle", 0.18, 0.12);
}

function sfxLullaby() {
    playTone(440, 0.15, "sine", 0, 0.06);
    playTone(392, 0.15, "sine", 0.16, 0.06);
    playTone(349, 0.25, "sine", 0.32, 0.06);
}

function applyDecay() {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - state.lastSeen);
    const hours = Math.min(MAX_DECAY_HOURS, elapsedMs / 3600000);

    if (state.hatched) {
        state.ageHours += elapsedMs / 3600000;
        if (hours > 0.002) {
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
    }
    state.lastSeen = now;
}

function localLine() {
    const stage = STAGES[currentStageIndex()];
    const mood = moodId();
    const who = state.name || "Bit";
    const hr = new Date().getHours();

    if (mood === "sleeping") {
        return who + " is dreaming of " + (state.favFood ? state.favFood : "stars") + "… 💤";
    }
    if (mood === "sick") {
        return "Don't leave " + who + " so long.";
    }
    if (mood === "sad") {
        return who + " missed you. Play with me?";
    }
    if (stage === "EGG") {
        return "Tap FEED to hatch me!";
    }
    if (hr < 8) {
        return state.trait === "nocturnal" ? "The dark is cozy." : "Yawn… early morning!";
    }
    if (hr > 21 && state.trait === "nocturnal") {
        return "Night time! Wide awake!";
    }
    if (state.trait === "clingy") {
        return "Stay. " + who + " loves being close.";
    }
    if (state.trait === "fussy") {
        return "Hmm. Do you have gourmet snacks?";
    }
    if (state.trait === "chill") {
        return "Everything is zen. Life is good.";
    }
    if (state.bond > 50) {
        return who + " completely trusts you! 💖";
    }
    if (stage === "BABY") {
        return "Hi! I'm " + who + "!";
    }
    return "Day " + dayNumber() + ". Still your best companion.";
}

function stripMarkdownFences(text) {
    return String(text)
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseLlmJson(data) {
    const sources = [data && data.data, data && data.message, data].filter(
        (value) => value != null && value !== "" && typeof value !== "function"
    );
    for (const source of sources) {
        if (typeof source === "object") {
            if (typeof source.line === "string" && source.line.trim()) {
                return { line: source.line.trim() };
            }
            if (typeof source.message === "string" && source.message.trim()) {
                return { line: source.message.trim() };
            }
        }
        const raw = String(source).trim();
        const text = stripMarkdownFences(raw);
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
                return { line: parsed.line.trim() };
            }
            if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
                return { line: parsed.message.trim() };
            }
        } catch (error) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
                        return { line: parsed.line.trim() };
                    }
                } catch (innerError) { }
            }
        }
        if (raw && !raw.startsWith("<") && !raw.startsWith("<!DOCTYPE")) {
            const cleaned = raw.replace(/^["']|["']$/g, "").trim();
            if (cleaned) {
                return { line: cleaned };
            }
        }
    }
    throw new Error("Could not parse LLM JSON");
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
    if (!pendingLlmResolve) return;
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
    const bagNames = (state.bag || []).map((id) => {
        const item = ARTIFACTS.find((a) => a.id === id);
        return item ? item.name : id;
    }).join(", ");

    return [
        "You are " + state.name + ", a tiny pixel-art tamagotchi companion living inside rabbit r1.",
        "Personality trait: " + (state.trait || "chill") + ".",
        "Body: " + bodyType() + ". Stage: " + STAGES[currentStageIndex()] + ".",
        "Day " + dayNumber() + ". Mood: " + moodId() + ". Bond: " + state.bond + "/100.",
        state.favFood ? "Favorite snack: " + state.favFood + "." : "",
        bagNames ? "Backpack loot: " + bagNames + "." : "",
        state.neglectMarks > 0 ? "Carries a small battle scar from being alone." : "",
        "Speak warmly in first person, one punchy sentence, 12 words max.",
        "No markdown. Return ONLY JSON: {\"line\":\"...\"}",
        "hunger=" + Math.round(state.hunger) +
        " happiness=" + Math.round(state.happiness) +
        " energy=" + Math.round(state.energy)
    ].filter(Boolean).join(" ");
}

function render() {
    const stage = STAGES[currentStageIndex()];
    nameLabelEl.textContent = mode === "name" ? (nameDraft || "_") : state.name;
    metaLabelEl.textContent = "D" + dayNumber() + " " + stage;

    if (mode === "name") {
        actionBtnEl.textContent = LETTERS[letterIndex];
        hintEl.textContent = "scroll: letter · side: add · hold: save";
    } else if (mode === "food") {
        const f = FOODS[foodIndex];
        actionBtnEl.textContent = f.name;
        hintEl.textContent = "scroll: food · side: feed · hold: back";
    } else if (mode === "bag") {
        if (!state.bag || state.bag.length === 0) {
            actionBtnEl.textContent = "EMPTY BAG";
            hintEl.textContent = "forage on WALK · hold: back";
        } else {
            const item = ARTIFACTS.find((a) => a.id === state.bag[bagIndex]) || ARTIFACTS[0];
            actionBtnEl.textContent = item.icon + " " + item.name;
            hintEl.textContent = item.rarity + " " + (bagIndex + 1) + "/" + state.bag.length + " · hold: back";
        }
    } else if (mode === "game") {
        actionBtnEl.textContent = "CATCH!";
        hintEl.textContent = "scroll: move · catch items!";
    } else if (mode === "sign") {
        actionBtnEl.textContent = signBuffer.length + "/" + SIGN_LEN;
        hintEl.textContent = state.handshake.length
            ? "scroll/shake x3 · hold: exit"
            : "teach: scroll/shake x3 · hold: exit";
    } else {
        actionBtnEl.textContent = ACTIONS[actionIndex];
        hintEl.textContent = "scroll: care · side: do · hold: speak";
    }

    renderPixelBar(barHappyEl, state.happiness);
    renderPixelBar(barHungerEl, state.hunger);
    renderPixelBar(barEnergyEl, state.energy);

    if (meterHappyEl) meterHappyEl.setAttribute("aria-valuenow", Math.round(state.happiness));
    if (meterHungerEl) meterHungerEl.setAttribute("aria-valuenow", Math.round(state.hunger));
    if (meterEnergyEl) meterEnergyEl.setAttribute("aria-valuenow", Math.round(state.energy));

    renderPixelSprite();
}

function say(text) {
    speechEl.textContent = text;
    statusEl.textContent = text;
}

// --- Petting / Tickle Interaction ---
function petPetting() {
    if (!state.hatched || state.sleeping) return;
    playAnim("anim-tickle", 450);
    spawnParticle("❤️", 0, -15);
    spawnParticle("✨", 10, -25);
    sfxPurr();
    state.happiness = clamp(state.happiness + 5, 0, 100);
    state.bond = clamp(state.bond + 1, 0, 100);
    say("Purr… " + state.name + " loves you!");
    render();
    saveState();
}

// --- Food Feeding Flow ---
function enterFoodMenu() {
    hatchIfNeeded();
    mode = "food";
    foodIndex = 0;
    render();
    say(FOODS[foodIndex].desc);
}

function feedSelectedFood() {
    const f = FOODS[foodIndex];
    state.sleeping = false;
    state.care.feed += 1;
    state.hunger = clamp(state.hunger + f.hunger, 0, 100);
    state.happiness = clamp(state.happiness + f.happy, 0, 100);
    state.energy = clamp(state.energy + f.nrg, 0, 100);
    state.bond = clamp(state.bond + 2, 0, 100);

    spawnParticle(f.icon, 0, -10);
    spawnParticle("✨", 12, -20);
    sfxEat();

    if (f.id === state.favFood) {
        state.happiness = clamp(state.happiness + 15, 0, 100);
        state.bond = clamp(state.bond + 5, 0, 100);
        playAnim("anim-bounce", 650);
        spawnParticle("💖", -10, -25);
        say("FAVORITE! " + state.name + " loves " + f.name + "!");
        sfxWin();
    } else if (f.id === state.dislikeFood) {
        playAnim("anim-panic", 600);
        say("Yuck! " + state.name + " pouts at " + f.name + "…");
    } else if (f.zoomies) {
        playAnim("anim-zoomies", 1400);
        spawnParticle("⚡", 0, -20);
        say("ZOOMIES! Energy surge!");
    } else if (f.spice) {
        playAnim("anim-panic", 900);
        spawnParticle("🔥", 0, -20);
        say("HOT HOT HOT! Need water!");
    } else if (f.calm) {
        spawnParticle("🍵", 0, -15);
        say("Ah… peaceful and calm.");
    } else {
        say("Nom nom! Yummy.");
    }

    mode = "care";
    render();
    saveState();
}

// --- Mini-Game: Catch the Berry ---
function startCatchGame() {
    hatchIfNeeded();
    if (state.energy < 10) {
        say("Too tired to play! Sleep?");
        return;
    }
    mode = "game";
    gameActive = true;
    gameScore = 0;
    gameTimer = 10;
    gamePetX = 0;
    gameItems = [];
    state.sleeping = false;
    state.care.play += 1;
    state.energy = clamp(state.energy - 10, 0, 100);

    if (gameLayerEl) gameLayerEl.hidden = false;
    if (gameArenaEl) gameArenaEl.innerHTML = "";
    if (petEl) petEl.style.transform = `translate(0px, 10px) scale(0.85)`;

    gameScoreLabelEl.textContent = "00 PTS";
    gameTimerLabelEl.textContent = "10s";
    say("Catch berries! Avoid bombs!");
    render();

    gameInterval = setInterval(() => {
        gameTimer -= 1;
        if (gameTimerLabelEl) gameTimerLabelEl.textContent = gameTimer + "s";
        if (gameTimer <= 0) endCatchGame();
    }, 1000);

    gameSpawnInterval = setInterval(() => {
        if (!gameActive) return;
        spawnGameItem();
    }, 450);

    requestAnimationFrame(updateCatchGame);
}

function spawnGameItem() {
    if (!gameArenaEl) return;
    const isBomb = Math.random() < 0.28;
    const isStar = Math.random() < 0.15;
    const type = isBomb ? "bomb" : isStar ? "star" : "berry";
    const icon = isBomb ? "💣" : isStar ? "⭐" : "🍓";
    const pts = isBomb ? -15 : isStar ? 25 : 10;

    const item = {
        el: document.createElement("div"),
        x: Math.floor(Math.random() * 180 + 20),
        y: 0,
        speed: 2.2 + Math.random() * 1.5,
        type: type,
        pts: pts,
        icon: icon
    };
    item.el.className = "falling-item";
    item.el.textContent = icon;
    item.el.style.left = item.x + "px";
    item.el.style.top = item.y + "px";
    gameArenaEl.appendChild(item.el);
    gameItems.push(item);
}

function updateCatchGame() {
    if (!gameActive) return;
    const petStageX = 110 + gamePetX;

    for (let i = gameItems.length - 1; i >= 0; i -= 1) {
        const item = gameItems[i];
        item.y += item.speed;
        item.el.style.top = item.y + "px";

        if (item.y > 55 && item.y < 90 && Math.abs(item.x - petStageX) < 26) {
            gameScore = Math.max(0, gameScore + item.pts);
            if (gameScoreLabelEl) {
                gameScoreLabelEl.textContent = (gameScore < 10 ? "0" : "") + gameScore + " PTS";
            }
            if (item.pts > 0) {
                spawnParticle("+" + item.pts, gamePetX, -10);
                sfxBoing();
            } else {
                spawnParticle("💥", gamePetX, -10);
                playTone(180, 0.08, "sawtooth");
            }
            if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
            gameItems.splice(i, 1);
            continue;
        }

        if (item.y > 100) {
            if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
            gameItems.splice(i, 1);
        }
    }

    requestAnimationFrame(updateCatchGame);
}

function movePetGame(dx) {
    if (!gameActive) return;
    gamePetX = clamp(gamePetX + dx, -48, 48);
    if (petEl) petEl.style.transform = `translate(${gamePetX}px, 10px) scale(0.85)`;
}

function endCatchGame() {
    gameActive = false;
    if (gameInterval) clearInterval(gameInterval);
    if (gameSpawnInterval) clearInterval(gameSpawnInterval);
    gameInterval = null;
    gameSpawnInterval = null;

    if (gameLayerEl) gameLayerEl.hidden = true;
    if (gameArenaEl) gameArenaEl.innerHTML = "";
    if (petEl) petEl.style.transform = "";

    const bonusHappy = Math.min(45, Math.round(gameScore * 0.6) + 10);
    const bonusBond = Math.min(20, Math.round(gameScore * 0.3) + 2);
    state.happiness = clamp(state.happiness + bonusHappy, 0, 100);
    state.bond = clamp(state.bond + bonusBond, 0, 100);

    mode = "care";
    playAnim("anim-bounce", 800);
    sfxWin();
    say(`Score: ${gameScore}! +${bonusHappy} HAP, +${bonusBond} BOND!`);
    render();
    saveState();
}

// --- Walk / Foraging Adventure ---
function doWalkAction() {
    hatchIfNeeded();
    if (state.energy < 12) {
        say("Too tired for a walk. Nap first?");
        return;
    }
    state.sleeping = false;
    state.care.walk += 1;
    state.energy = clamp(state.energy - 12, 0, 100);
    state.happiness = clamp(state.happiness + 15, 0, 100);

    playAnim("anim-zoomies", 1200);
    sfxBoing();
    say("Exploring R1 world… 🐾");

    setTimeout(() => {
        const available = ARTIFACTS.filter((a) => !state.bag.includes(a.id));
        const pool = available.length > 0 ? available : ARTIFACTS;
        const found = pool[Math.floor(Math.random() * pool.length)];

        if (!state.bag.includes(found.id)) {
            state.bag.push(found.id);
        }
        state.bond = clamp(state.bond + 6, 0, 100);
        spawnParticle(found.icon, 0, -20);
        spawnParticle("✨", 15, -30);
        sfxItem();
        say(`Found ${found.icon} ${found.name}! (${found.rarity})`);
        render();
        saveState();
    }, 1300);
}

// --- Backpack Collection Viewer ---
function enterBagView() {
    hatchIfNeeded();
    mode = "bag";
    bagIndex = 0;
    render();
    if (!state.bag || state.bag.length === 0) {
        say("Backpack is empty. Go on a WALK!");
    } else {
        const item = ARTIFACTS.find((a) => a.id === state.bag[bagIndex]) || ARTIFACTS[0];
        say(`${item.icon} ${item.name}: ${item.desc}`);
    }
}

function cycleBag(delta) {
    if (!state.bag || state.bag.length === 0) return;
    bagIndex = (bagIndex + delta + state.bag.length) % state.bag.length;
    const item = ARTIFACTS.find((a) => a.id === state.bag[bagIndex]) || ARTIFACTS[0];
    say(`${item.icon} ${item.name}: ${item.desc}`);
    chirp(600 + bagIndex * 40, 0.04);
    render();
}

function cycleFood(delta) {
    foodIndex = (foodIndex + delta + FOODS.length) % FOODS.length;
    const f = FOODS[foodIndex];
    say(f.desc);
    chirp(540 + foodIndex * 35, 0.04);
    render();
}

// --- Care Actions Router ---
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
    if (action === "FEED") {
        enterFoodMenu();
        return;
    }
    if (action === "PLAY") {
        startCatchGame();
        return;
    }
    if (action === "WALK") {
        doWalkAction();
        return;
    }
    if (action === "BAG") {
        enterBagView();
        return;
    }

    startMic();
    if (action === "SLEEP") {
        hatchIfNeeded();
        state.sleeping = !state.sleeping;
        state.care.sleep += 1;
        if (state.sleeping) {
            spawnParticle("💤", 10, -20);
            sfxLullaby();
            say("Lights down. " + state.name + " is dreaming…");
        } else {
            playAnim("anim-bounce", 500);
            chirp(700, 0.08);
            say("I'm awake! Ready for adventure!");
        }
    }

    state.lastSeen = Date.now();
    render();
    saveState();
}

function cycleAction(delta) {
    if (mode === "game") {
        movePetGame(delta * 18);
        return;
    }
    if (mode === "food") {
        cycleFood(delta);
        return;
    }
    if (mode === "bag") {
        cycleBag(delta);
        return;
    }
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

    if (mode === "game") return;
    if (mode === "food") {
        feedSelectedFood();
        return;
    }
    if (mode === "bag") {
        petPetting();
        return;
    }
    if (mode === "name") {
        appendLetter();
        return;
    }
    if (mode === "sign") {
        if (signBuffer.length > 0) {
            signBuffer = [];
            render();
            say("Cleared moves. Try again.");
            chirp(400, 0.04);
        } else if (state.handshake.length === SIGN_LEN) {
            say("Scroll/shake 3 moves.");
        }
        return;
    }
    doCareAction();
}

function onLongPress() {
    if (mode === "food" || mode === "bag" || mode === "game") {
        if (gameActive) endCatchGame();
        mode = "care";
        render();
        say("Back with " + state.name + ".");
        return;
    }
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
    if (speaking) return;
    if (now - lastSpeakAt < SPEAK_COOLDOWN_MS) {
        say("Catching my breath…");
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
        console.warn("Familiar speak failed", error);
        say(localLine());
    } finally {
        speaking = false;
        saveState();
    }
}

function enterName() {
    mode = "name";
    nameDraft = state.name === "BIT" ? "" : state.name;
    letterIndex = 0;
    render();
    say("Who am I to you?");
}

function confirmName() {
    const next = nameDraft.trim().replace(/\s+/g, " ");
    if (next) {
        state.name = next.slice(0, NAME_MAX).toUpperCase();
    }
    mode = "care";
    render();
    say("Okay! I'm " + state.name + ".");
    saveState();
}

function appendLetter() {
    if (nameDraft.length >= NAME_MAX) return;
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
    if (mode !== "sign") return false;
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
        say("Locked. That's ours! 🤝");
        sfxWin();
        saveState();
        return;
    }
    const match = seq.every((step, i) => step === state.handshake[i]);
    mode = "care";
    if (match) {
        state.happiness = clamp(state.happiness + 30, 0, 100);
        state.bond = clamp(state.bond + 10, 0, 100);
        playAnim("anim-bounce", 600);
        spawnParticle("🤝", 0, -20);
        sfxWin();
        say("You! I know you!");
    } else {
        say("Not our handshake.");
        chirp(300, 0.08);
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
        say("I can see your world!");
        spawnParticle("👁️", 0, -15);
        saveState();
    } catch (error) {
        console.warn("camera failed", error);
        stopCam();
        say("Window stuck.");
    }
}

function stopCam() {
    camOn = false;
    state.camPref = false;
    if (camEl) {
        camEl.hidden = true;
        camEl.srcObject = null;
    }
    if (camStream) {
        try {
            camStream.getTracks().forEach((track) => track.stop());
        } catch (error) { }
        camStream = null;
    }
}

async function startMic() {
    if (micTimer || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }
    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const ctx = ensureAudio();
        if (!ctx) return;
        micSource = ctx.createMediaStreamSource(micStream);
        micAnalyser = ctx.createAnalyser();
        micAnalyser.fftSize = 256;
        micSource.connect(micAnalyser);
        const data = new Uint8Array(micAnalyser.frequencyBinCount);
        lastMicBoostAt = Date.now();
        micTimer = setInterval(() => {
            if (!micAnalyser) return;
            micAnalyser.getByteTimeDomainData(data);
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
                !state.sleeping &&
                state.hatched
            ) {
                lastMicBoostAt = now;
                state.happiness = clamp(state.happiness + 6, 0, 100);
                state.bond = clamp(state.bond + 2, 0, 100);
                spawnParticle("🎵", 0, -15);
                sfxPurr();
                say("Heard your voice!");
                render();
                saveState();
            }
        }, 300);
    } catch (error) {
        console.warn("mic soothe failed", error);
        stopMic();
    }
}

function stopMic() {
    if (micTimer) {
        clearInterval(micTimer);
        micTimer = null;
    }
    if (micSource) {
        try { micSource.disconnect(); } catch (error) { }
        micSource = null;
    }
    if (micAnalyser) {
        try { micAnalyser.disconnect(); } catch (error) { }
        micAnalyser = null;
    }
    if (micStream) {
        try {
            micStream.getTracks().forEach((track) => track.stop());
        } catch (error) { }
        micStream = null;
    }
}

function startLiveTick() {
    if (liveTickTimer) {
        clearInterval(liveTickTimer);
    }
    liveTickTimer = setInterval(() => {
        if (!document.hidden && !gameActive) {
            applyDecay();
            render();
        }
    }, 15000);
}

function stopLiveTick() {
    if (liveTickTimer) {
        clearInterval(liveTickTimer);
        liveTickTimer = null;
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

function snapshot() {
    return {
        name: state.name,
        trait: state.trait,
        hatched: state.hatched,
        hunger: state.hunger,
        happiness: state.happiness,
        energy: state.energy,
        bond: state.bond,
        ageHours: state.ageHours,
        sleeping: state.sleeping,
        lastSeen: state.lastSeen,
        bornAt: state.bornAt,
        hatchedAt: state.hatchedAt || 0,
        care: {
            feed: state.care.feed,
            play: state.care.play,
            sleep: state.care.sleep,
            walk: state.care.walk || 0
        },
        bag: (state.bag || []).slice(),
        favFood: state.favFood || "",
        dislikeFood: state.dislikeFood || "",
        neglectMarks: state.neglectMarks,
        handshake: state.handshake.slice(),
        camPref: state.camPref
    };
}

function applySnapshot(saved) {
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.name === "string" && saved.name.trim()) {
        state.name = saved.name.trim().slice(0, NAME_MAX).toUpperCase();
    }
    if (TRAITS.indexOf(saved.trait) !== -1) {
        state.trait = saved.trait;
    }
    if (typeof saved.hatched === "boolean") {
        state.hatched = saved.hatched;
    } else if (typeof saved.ageHours === "number" && saved.ageHours > 0) {
        state.hatched = true;
    }
    ["hunger", "happiness", "energy", "bond", "ageHours"].forEach((key) => {
        if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
            state[key] = clamp(saved[key], 0, key === "ageHours" ? 100000 : 100);
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
    if (typeof saved.hatchedAt === "number" && Number.isFinite(saved.hatchedAt)) {
        state.hatchedAt = saved.hatchedAt;
    }
    if (saved.care && typeof saved.care === "object") {
        ["feed", "play", "sleep", "walk"].forEach((key) => {
            if (typeof saved.care[key] === "number" && Number.isFinite(saved.care[key])) {
                state.care[key] = Math.max(0, Math.round(saved.care[key]));
            }
        });
    }
    if (Array.isArray(saved.bag)) {
        state.bag = saved.bag.filter((id) => ARTIFACTS.some((a) => a.id === id));
    }
    if (typeof saved.favFood === "string") state.favFood = saved.favFood;
    if (typeof saved.dislikeFood === "string") state.dislikeFood = saved.dislikeFood;
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
                const decoded = base64ToUtf8(stored);
                try {
                    applySnapshot(JSON.parse(decoded));
                    return;
                } catch (e) {
                    applySnapshot(JSON.parse(stored));
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
    if (now - lastShakeAt < 700) return;
    lastShakeAt = now;

    if (pushSign("shake")) return;
    if (mode === "name") {
        backspaceName();
        return;
    }
    if (mode === "game") return;

    if (state.sleeping) {
        state.sleeping = false;
        state.energy = clamp(state.energy + 4, 0, 100);
        playAnim("anim-bounce", 500);
        say("Whoa — I'm up!");
        render();
        saveState();
        return;
    }
    petPetting();
}

function maybeShake(data) {
    if (!data) return;
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
    if (!accel || accelStarted) return;
    try {
        const available = await accel.isAvailable();
        if (!available) return;
        accel.start(maybeShake, { frequency: 30 });
        accelStarted = true;
    } catch (error) {
        console.warn("accelerometer start failed", error);
    }
}

function stopAccel() {
    const accel = window.creationSensors && window.creationSensors.accelerometer;
    if (accel && accelStarted && accel.stop) {
        try { accel.stop(); } catch (error) { }
    }
    accelStarted = false;
}

function persistAndPause() {
    saveState();
    stopAccel();
    stopMic();
    stopCam();
    stopLiveTick();
    if (gameActive) endCatchGame();
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => cycleAction(-1));
    window.addEventListener("scrollDown", () => cycleAction(1));
    window.addEventListener("sideClick", onSideClick);
    window.addEventListener("longPressStart", onLongPress);
}

function initializeFallback() {
    let touchTimer = null;
    let touchMoved = false;

    actionBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        onSideClick();
    });

    if (petEl) {
        petEl.addEventListener("click", (event) => {
            event.stopPropagation();
            petPetting();
        });
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest(".action") || event.target.closest(".pet")) {
            return;
        }
        cycleAction(1);
    });

    // Mouse wheel support
    let wheelDebounce = 0;
    window.addEventListener("wheel", (event) => {
        const now = Date.now();
        if (now - wheelDebounce < 90) return;
        wheelDebounce = now;
        if (event.deltaY < 0) {
            cycleAction(-1);
        } else if (event.deltaY > 0) {
            cycleAction(1);
        }
    }, { passive: true });

    // Touch hold support for longPress
    document.addEventListener("touchstart", () => {
        touchMoved = false;
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
            if (!touchMoved) {
                onLongPress();
            }
        }, 550);
    }, { passive: true });

    document.addEventListener("touchmove", () => {
        touchMoved = true;
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    document.addEventListener("touchend", () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            cycleAction(-1);
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            cycleAction(1);
            return;
        }
        if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            cycleAction(-1);
            return;
        }
        if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault();
            cycleAction(1);
            return;
        }
        if (event.key === "Backspace" && mode === "name") {
            event.preventDefault();
            backspaceName();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            if (mode !== "care") {
                if (gameActive) endCatchGame();
                mode = "care";
                signBuffer = [];
                render();
                say("Back with " + state.name + ".");
            }
            return;
        }
        if (event.key === "t" || event.key === "T") {
            event.preventDefault();
            petPetting();
            return;
        }
        if (event.key === "s" || event.key === "S") {
            event.preventDefault();
            onShake();
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
    if (state.hatched && !state.favFood) {
        setupTastes();
    }
    applyDecay();
    render();
    say(state.hatched ? localLine() : "Tap FEED to hatch me.");
    await saveState();
    initializeHardware();
    initializeFallback();
    startAccel();
    startLiveTick();
    startSpriteLoop();

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            persistAndPause();
        } else {
            applyDecay();
            render();
            startAccel();
            startLiveTick();
            startSpriteLoop();
        }
    });
    window.addEventListener("pagehide", persistAndPause);
    window.addEventListener("beforeunload", persistAndPause);
}

init();
