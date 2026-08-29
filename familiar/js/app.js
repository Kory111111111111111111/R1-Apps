const STORAGE_KEY = "familiarState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const LLM_TIMEOUT_MS = 20000;
const SPEAK_COOLDOWN_MS = 15000;
const MAX_DECAY_HOURS = 24;
const NAME_MAX = 8;
const SIGN_LEN = 3;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ- ";

const SPECIES_LIST = [
    { id: "bunny", name: "LUNAR BUNNY", desc: "Swift, energetic, long floppy ears.", icon: "🐰" },
    { id: "drake", name: "FLAME DRAKE", desc: "Fierce horns, ember breath, proud.", icon: "🐲" },
    { id: "ghost", name: "ASTRAL WISP", desc: "Mystic ethereal float, night spirit.", icon: "👻" },
    { id: "mecha", name: "CYBER MECHA", desc: "Dual antennae, visor eyes, digital heart.", icon: "🤖" },
    { id: "neko", name: "SHADOW NEKO", desc: "Sleek cat ears, curved tail, curious.", icon: "🐱" }
];

const TRAITS = ["chill", "nocturnal", "fussy", "clingy", "brave", "curious"];
const ACTIONS = ["FEED", "PLAY", "TRAIN", "CLEAN", "HEAL", "WALK", "BAG", "SLEEP", "SIGN", "STATS", "SETTINGS"];
const STAGES = ["EGG", "BABY", "TEEN", "ADULT", "ASCENDED"];

const TRICKS = [
    { id: "spin", name: "🌀 SPIN", bondReq: 15, anim: "anim-spin", desc: "A dizzying full 360 spin!" },
    { id: "highfive", name: "✋ HIGH FIVE", bondReq: 35, anim: "anim-bounce", desc: "Slaps a tiny paw with you!" },
    { id: "backflip", name: "🤸 BACKFLIP", bondReq: 60, anim: "anim-flip", desc: "A gravity-defying somersault!" },
    { id: "astral", name: "✨ ASTRAL BEAM", bondReq: 85, anim: "anim-zoomies", desc: "Channels starlight power!" }
];

const FOODS = [
    { id: "berry", name: "🍓 BERRY", desc: "Sweet & juicy", hunger: 25, happy: 12, nrg: 4, icon: "🍓" },
    { id: "pizza", name: "🍕 PIZZA", desc: "Warm & filling", hunger: 48, happy: 8, nrg: -4, icon: "🍕" },
    { id: "candy", name: "⚡ CANDY", desc: "Surge of zoomies!", hunger: 10, happy: 20, nrg: 28, zoomies: true, icon: "⚡" },
    { id: "pepper", name: "🌶️ PEPPER", desc: "Super spicy shock!", hunger: 15, happy: -4, nrg: 16, spice: true, icon: "🌶️" },
    { id: "tea", name: "🍵 ZEN TEA", desc: "Calms fussy pets", hunger: 8, happy: 24, nrg: 6, calm: true, icon: "🍵" },
    { id: "donut", name: "🍩 STAR DONUT", desc: "Glazed cosmic treat", hunger: 32, happy: 26, nrg: 12, icon: "🍩" }
];

const ARTIFACTS = [
    { id: "bolt", name: "Shiny Bolt", rarity: "★☆☆", desc: "Twinkles when rubbed.", icon: "🔩" },
    { id: "floppy", name: "Ancient Floppy", rarity: "★☆☆", desc: "1.44MB of pure memories.", icon: "💾" },
    { id: "shroom", name: "Glow Shroom", rarity: "★☆☆", desc: "Emits gentle neon light.", icon: "🍄" },
    { id: "token", name: "Lucky Token", rarity: "★★☆", desc: "Stamped with an R1 rabbit.", icon: "🪙" },
    { id: "clover", name: "Digital Clover", rarity: "★★☆", desc: "Four pixelated leaves.", icon: "🍀" },
    { id: "acorn", name: "Golden Acorn", rarity: "★★☆", desc: "Guarded with great pride.", icon: "🌰" },
    { id: "crystal", name: "Chrono Crystal", rarity: "★★★", desc: "Pulses with time energy.", icon: "🔮" },
    { id: "star", name: "Star Fragment", rarity: "★★★", desc: "Fell from the top bezel.", icon: "🌟" }
];

const PALETTES = {
    bunny: {
        O: "#1a0e06",
        C: "#ff6a00",
        S: "#c2410c",
        H: "#fed7aa",
        W: "#ffffff",
        B: "#0f0f14",
        P: "#fb7185",
        R: "#e11d48",
        K: "#fbbf24",
        Y: "#fde047"
    },
    drake: {
        O: "#180606",
        C: "#dc2626",
        S: "#991b1b",
        H: "#fca5a5",
        W: "#ffffff",
        B: "#1a0606",
        P: "#f97316",
        R: "#ef4444",
        K: "#f59e0b",
        Y: "#fde047"
    },
    ghost: {
        O: "#0a0614",
        C: "#7c3aed",
        S: "#5b21b6",
        H: "#c4b5fd",
        W: "#22d3ee",
        B: "#050814",
        P: "#c084fc",
        R: "#818cf8",
        K: "#38bdf8",
        Y: "#a78bfa"
    },
    mecha: {
        O: "#05131e",
        C: "#0284c7",
        S: "#0369a1",
        H: "#bae6fd",
        W: "#ffffff",
        B: "#082f49",
        P: "#38bdf8",
        R: "#06b6d4",
        K: "#38bdf8",
        Y: "#facc15"
    },
    neko: {
        O: "#160b24",
        C: "#4f46e5",
        S: "#3730a3",
        H: "#c7d2fe",
        W: "#ffffff",
        B: "#1e1b4b",
        P: "#f472b6",
        R: "#ec4899",
        K: "#f43f5e",
        Y: "#fbbf24"
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
const poopLayerEl = document.getElementById("poopLayer");
const cleanLayerEl = document.getElementById("cleanLayer");
const gameLayerEl = document.getElementById("gameLayer");
const gameScoreLabelEl = document.getElementById("gameScoreLabel");
const gameTimerLabelEl = document.getElementById("gameTimerLabel");
const gameArenaEl = document.getElementById("gameArena");
const rhythmLayerEl = document.getElementById("rhythmLayer");
const rhythmScoreLabelEl = document.getElementById("rhythmScoreLabel");
const rhythmComboLabelEl = document.getElementById("rhythmComboLabel");
const rhythmTrackEl = document.getElementById("rhythmTrack");
const rhythmFeedbackEl = document.getElementById("rhythmFeedback");
const passportOverlayEl = document.getElementById("passportOverlay");
const passNameEl = document.getElementById("passName");
const passGenEl = document.getElementById("passGen");
const passSpeciesEl = document.getElementById("passSpecies");
const passTraitEl = document.getElementById("passTrait");
const passAgeBondEl = document.getElementById("passAgeBond");
const passFavFoodEl = document.getElementById("passFavFood");
const passDisciplineEl = document.getElementById("passDiscipline");
const settingsOverlayEl = document.getElementById("settingsOverlay");
const settingsTitleEl = document.getElementById("settingsTitle");
const settingsContentEl = document.getElementById("settingsContent");

let lastSideClickAt = 0;
let actionIndex = 0;
let speaking = false;
let lastSpeakAt = 0;
let lastAccel = null;
let lastShakeAt = 0;
let accelStarted = false;
let mode = "care"; // care | food | play_select | game_catch | game_rhythm | train | bag | sign | name | stats | settings | wipe_confirm

let foodIndex = 0;
let playSelectIndex = 0;
let trainIndex = 0;
let bagIndex = 0;
let letterIndex = 0;
let settingsIndex = 0;
let wipeConfirmChoice = 0; // 0: CANCEL, 1: WIPE
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

// Catch Mini-Game state
let gameActive = false;
let gameScore = 0;
let gameTimer = 10;
let gameInterval = null;
let gameSpawnInterval = null;
let gamePetX = 0;
let gameItems = [];

// Rhythm Mini-Game state
let rhythmActive = false;
let rhythmScore = 0;
let rhythmCombo = 0;
let rhythmNotes = [];
let rhythmInterval = null;
let rhythmSpawnInterval = null;
let rhythmAnimFrame = null;

let pendingLlmResolve = null;
let pendingLlmReject = null;
let llmTimeoutId = null;

const state = {
    name: "BIT",
    species: "bunny",
    trait: "chill",
    hatched: false,
    hunger: 75,
    happiness: 75,
    energy: 85,
    bond: 10,
    discipline: 20,
    ageHours: 0,
    generation: 1,
    sleeping: false,
    poops: 0,
    isSick: false,
    soundOn: true,
    lastSeen: Date.now(),
    bornAt: Date.now(),
    hatchedAt: 0,
    care: { feed: 0, play: 0, train: 0, clean: 0, heal: 0, sleep: 0, walk: 0 },
    tricks: ["spin"],
    bag: [],
    neglectMarks: 0,
    handshake: [],
    favFood: "berry",
    dislikeFood: "pepper",
    camPref: false,
    highScores: { catch: 0, rhythm: 0 }
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
    if (!state.hatched) return 0;
    if (state.ageHours < 2) return 1; // BABY
    if (state.ageHours < 12) return 2; // TEEN
    if (state.ageHours >= 36 && state.bond >= 85) return 4; // ASCENDED
    return 3; // ADULT
}

function moodId() {
    if (state.sleeping) return "sleeping";
    if (state.isSick || state.poops >= 2) return "sick";
    const lowest = Math.min(state.hunger, state.happiness, state.energy);
    if (lowest < 20) return "sick";
    if (lowest < 40) return "sad";
    return "ok";
}

function pickTrait() {
    const seed = state.hatchedAt || state.bornAt || Date.now();
    return TRAITS[Math.abs(Math.floor(seed)) % TRAITS.length];
}

function updateEvolutionSpecies() {
    if (!state.hatched || currentStageIndex() < 2) return;
    const c = state.care;
    if (c.play >= c.feed && c.play >= c.walk && c.play >= c.train) {
        state.species = "drake";
    } else if (c.walk >= c.feed && c.walk >= c.sleep) {
        state.species = "bunny";
    } else if (c.train >= c.feed || state.highScores.rhythm > 100) {
        state.species = "mecha";
    } else if (c.sleep >= c.feed || state.trait === "nocturnal") {
        state.species = "ghost";
    } else {
        state.species = "neko";
    }
}

function setupTastes() {
    const seed = Math.abs(Math.floor(state.bornAt || Date.now()));
    state.favFood = FOODS[seed % FOODS.length].id;
    state.dislikeFood = FOODS[(seed + 3) % FOODS.length].id;
}

function hatchIfNeeded() {
    if (state.hatched) return;
    state.hatched = true;
    state.hatchedAt = Date.now();
    state.bornAt = Date.now();
    state.ageHours = 0;
    state.trait = pickTrait();
    setupTastes();
    spawnParticle("✨", 0, -10);
    spawnParticle("💖", -15, -20);
    spawnParticle("🐣", 15, -20);
    sfxWin();
}

// ==========================================
// PIXEL ART SPRITE MATRIX REPOSITORY
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
        // Frame 0: Baby Idle
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
        // Frame 1: Baby Blink / Joy
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
        ]
    ],
    // --- SPECIES: BUNNY ---
    bunny: {
        TEEN: [
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
                ".OCHHH--HHHHHHHH--CCCCCCSO",
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
    },
    // --- SPECIES: DRAKE ---
    drake: {
        TEEN: [
            [
                "..OKO................OKO..",
                ".OKKCO..............OCKKO.",
                "..OCOOO............OOOCO..",
                "....OOOOOOOOOOOOOOOOOO....",
                "...OCHHHHHHHHHHHHHHHHCOO..",
                "..OCHHHHHHHHHHHHHHHCCCCSO.",
                ".OCHHHHHHHHHHHHHHHCCCCCCSO",
                ".OCHHHWBHHHHHHHHWBCCCCCCSO",
                ".OCHHHBBHHHHHHHHBBCCCCCCSO",
                ".OCHHPPHHHHHHHHHPPSCCCCCSO",
                ".OCHHHHSSRRRRSSHHHCCCCCCSO",
                ".OCHHHHHSSSSSSHHHHCCCCCCSO",
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                ".....OKKSS......OKKSS.....",
                ".....OOOOO......OOOOO....."
            ],
            [
                "..OKO................OKO..",
                ".OKKCO..............OCKKO.",
                "..OCOOO............OOOCO..",
                "....OOOOOOOOOOOOOOOOOO....",
                "...OCHHHHHHHHHHHHHHHHCOO..",
                "..OCHHHHHHHHHHHHHHHCCCCSO.",
                ".OCHHHHHHHHHHHHHHHCCCCCCSO",
                ".OCHHH--HHHHHHHH--CCCCCCSO",
                ".OCHHHBBHHHHHHHHBBCCCCCCSO",
                ".OCHHPPHHHHHHHHHPPSCCCCCSO",
                ".OCHHHHSSRRRRSSHHHCCCCCCSO",
                ".OCHHHHHSSSSSSHHHHCCCCCCSO",
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                "......OKKSS....OKKSS......",
                "......OOOOO....OOOOO......"
            ]
        ],
        ADULT: [
            [
                ".OKKO................OKKO.",
                ".OKKKCO............OCKKKO.",
                "..OKKCСOO........OOCCKKO..",
                "...OOOOOOOOOOOOOOOOOOOO...",
                "..OOCHHHHHHHHHHHHHHHHCCOO.",
                ".OCHHHHHHHHHHHHHHHHCCCCCSO",
                "OCHHHHHHHHHHHHHHHHCCCCCCCS",
                "OCHHHWBHHHHHHHHHHWBCCCCCCS",
                "OCHHHBBHHHHHHHHHHBBCCCCCCS",
                "OCHHPPHHHHHHHHHHHPPSCCCCCS",
                "OCHHHHHSSRRRRRRSSHHCCCCCCS",
                "OCHHHHHHSRRRRRRSHHHCCCCCCS",
                ".OCHHHHHHSSSSSSHHHHCCCCCSO",
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                "....OKKKSS......OKKKSS....",
                "....OOOOOO......OOOOOO...."
            ],
            [
                ".OKKO................OKKO.",
                ".OKKKCO............OCKKKO.",
                "..OKKCСOO........OOCCKKO..",
                "...OOOOOOOOOOOOOOOOOOOO...",
                "..OOCHHHHHHHHHHHHHHHHCCOO.",
                ".OCHHHHHHHHHHHHHHHHCCCCCSO",
                "OCHHHHHHHHHHHHHHHHCCCCCCCS",
                "OCHHH--HHHHHHHHHH--CCCCCCS",
                "OCHHHBBHHHHHHHHHHBBCCCCCCS",
                "OCHHPPHHHHHHHHHHHPPSCCCCCS",
                "OCHHHHHSSRRRRRRSSHHCCCCCCS",
                "OCHHHHHHSRRRRRRSHHHCCCCCCS",
                ".OCHHHHHHSSSSSSHHHHCCCCCSO",
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO.OKO",
                ".....OKKKSS....OKKKSS..OKO",
                ".....OOOOOO....OOOOOO..OOO"
            ]
        ]
    },
    // --- SPECIES: GHOST ---
    ghost: {
        TEEN: [
            [
                ".......OOOOOOOO...........",
                ".....OOCHHHHHHCCOO........",
                "....OCHHHHHHHHHHCCSO......",
                "...OCHHHHHHHHHHHHCCSO.....",
                "..OCHHH..HHHHHH..CCCCSO...",
                "..OCHHHWBHHHHHHWBCCCCSO...",
                "..OCHHHBBHHHHHHBBCCCCSO...",
                "..OCHHPPHHHHHHHPPSCCCCSO..",
                "..OCHHHHHSSSSSSHHHCCCCSO..",
                "...OCHHHHHHHHHHHHCCCCSO...",
                "....OOCHHHHHHHHHCCCCSO....",
                "......OOCCCCCCCCCCSO......",
                "........OCHHSS..OCHHSS....",
                ".........OOOO....OOOO....."
            ],
            [
                ".......OOOOOOOO...........",
                ".....OOCHHHHHHCCOO........",
                "....OCHHHHHHHHHHCCSO......",
                "...OCHHHHHHHHHHHHCCSO.....",
                "..OCHHH..HHHHHH..CCCCSO...",
                "..OCHHH--HHHHHH--CCCCSO...",
                "..OCHHHBBHHHHHHBBCCCCSO...",
                "..OCHHPPHHHHHHHPPSCCCCSO..",
                "..OCHHHHHSSSSSSHHHCCCCSO..",
                "...OCHHHHHHHHHHHHCCCCSO...",
                "....OOCHHHHHHHHHCCCCSO....",
                "......OOCCCCCCCCCCSO......",
                ".........OCHHSS..OCHHSS...",
                "..........OOOO....OOOO...."
            ]
        ],
        ADULT: [
            [
                ".........OOOOOO...........",
                ".......OOCHHHHCCOO........",
                ".....OOCHHHHHHHHCCOO......",
                "....OCHHHHHHHHHHHHCCSO....",
                "...OCHHHHHHHHHHHHHHCCSO...",
                "..OCHHH..HHHHHHHH..CCCCSO.",
                "..OCHHHWBHHHHHHHHWBCCCCSO.",
                "..OCHHHBBHHHHHHHHBBCCCCSO.",
                "..OCHHPPHHHHHHHHHPPSCCCCSO",
                "..OCHHHHHSSSSSSSSHHCCCCCSO",
                "...OCHHHHHHHHHHHHCCCCCSO..",
                "....OOCHHHHHHHHHCCCCCSO...",
                "......OOCCCCCCCCCCCCSO....",
                "........OCHHHSSS..OCHHSS..",
                ".........OOOOOO....OOOO..."
            ],
            [
                ".........OOOOOO...........",
                ".......OOCHHHHCCOO........",
                ".....OOCHHHHHHHHCCOO......",
                "....OCHHHHHHHHHHHHCCSO....",
                "...OCHHHHHHHHHHHHHHCCSO...",
                "..OCHHH..HHHHHHHH..CCCCSO.",
                "..OCHHH--HHHHHHHH--CCCCSO.",
                "..OCHHHBBHHHHHHHHBBCCCCSO.",
                "..OCHHPPHHHHHHHHHPPSCCCCSO",
                "..OCHHHHHSSSSSSSSHHCCCCCSO",
                "...OCHHHHHHHHHHHHCCCCCSO..",
                "....OOCHHHHHHHHHCCCCCSO...",
                "......OOCCCCCCCCCCCCSO....",
                "..........OCHHHSSS..OCHHSS",
                "...........OOOOOO....OOOO."
            ]
        ]
    },
    // --- SPECIES: MECHA ---
    mecha: {
        TEEN: [
            [
                "....OKO............OKO....",
                "....OKO............OKO....",
                "...OOOOOOOOOOOOOOOOOOOO...",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHKKKKKKKKKKKKKKKKHCO..",
                "..OCHKWWBBKKKKKKWWBBKHCO..",
                "..OCHKKKKKKKKKKKKKKKKHCO..",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHHHHSSRRRRRRSSHHHCSO..",
                "...OCHHHHHSSSSSSHHHHCCSO..",
                "....OOCCCCCCCCCCCCCSOO....",
                "....OKKSS........OKKSS....",
                "....OOOOO........OOOOO...."
            ],
            [
                "....OKO............OKO....",
                "....OKO............OKO....",
                "...OOOOOOOOOOOOOOOOOOOO...",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHKKKKKKKKKKKKKKKKHCO..",
                "..OCHK--BBKKKKKK--BBKHCO..",
                "..OCHKKKKKKKKKKKKKKKKHCO..",
                "..OCHHHHHHHHHHHHHHHHHHCO..",
                "..OCHHHHSSRRRRRRSSHHHCSO..",
                "...OCHHHHHSSSSSSHHHHCCSO..",
                "....OOCCCCCCCCCCCCCSOO....",
                ".....OKKSS......OKKSS.....",
                ".....OOOOO......OOOOO....."
            ]
        ],
        ADULT: [
            [
                "...OKKO............OKKO...",
                "...OKKO............OKKO...",
                "..OOOOOOOOOOOOOOOOOOOOOO..",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHKKKKKKKKKKKKKKKKKKHCO.",
                ".OCHKWWWBBBKKKKKKWWWBBKHCO",
                ".OCHKKKKKKKKKKKKKKKKKKHCO.",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHHHHSSSRRRRRRSSSHHHCSO.",
                "..OCHHHHHSSSSSSSSHHHHCCSO.",
                "...OOCCCCCCCCCCCCCCCCCCO..",
                "...OKKKSS........OKKKSS...",
                "...OOOOOO........OOOOOO..."
            ],
            [
                "...OKKO............OKKO...",
                "...OKKO............OKKO...",
                "..OOOOOOOOOOOOOOOOOOOOOO..",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHKKKKKKKKKKKKKKKKKKHCO.",
                ".OCHK---BBBKKKKKK---BBKHCO",
                ".OCHKKKKKKKKKKKKKKKKKKHCO.",
                ".OCHHHHHHHHHHHHHHHHHHHHCO.",
                ".OCHHHHSSSRRRRRRSSSHHHCSO.",
                "..OCHHHHHSSSSSSSSHHHHCCSO.",
                "...OOCCCCCCCCCCCCCCCCCCO..",
                "....OKKKSS......OKKKSS....",
                "....OOOOOO......OOOOOO...."
            ]
        ]
    },
    // --- SPECIES: NEKO ---
    neko: {
        TEEN: [
            [
                "...OKO..............OKO...",
                "..OKPCO............OCPKO..",
                ".OKPPCSO..........OSPPKKO.",
                "..OOOO..............OOOO..",
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
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                "....OCHHSS......OCHHSS....",
                "....OOOOOO......OOOOOO...."
            ],
            [
                "...OKO..............OKO...",
                "..OKPCO............OCPKO..",
                ".OKPPCSO..........OSPPKKO.",
                "..OOOO..............OOOO..",
                ".....OOOOOOOOOOOOOOOO.....",
                "...OOCHHHHHHHHHHHHHHCCOO..",
                "..OCHHHHHHHHHHHHHHCCCCCSO.",
                ".OCHHHHHHHHHHHHHHCCCCCCCSO",
                ".OCHHH--HHHHHHHH--CCCCCCSO",
                ".OCHHHBBHHHHHHHHBBCCCCCCSO",
                ".OCHHPPHHHHHHHHHPPSCCCCCSO",
                ".OCHHHHSSRRRRSSHHHCCCCCCSO",
                ".OCHHHHHSSSSSSHHHHCCCCCCSO",
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                ".....OCHHSS....OCHHSS.....",
                ".....OOOOOO....OOOOOO....."
            ]
        ],
        ADULT: [
            [
                "..OKKO..............OKKO..",
                ".OKPPCO............OCPPKO.",
                "OKPPPCSO..........OSPPPKKO",
                ".OOOOO..............OOOOO.",
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
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO....",
                "....OCHHSS......OCHHSS.OCO",
                "....OOOOOO......OOOOOO.OOO"
            ],
            [
                "..OKKO..............OKKO..",
                ".OKPPCO............OCPPKO.",
                "OKPPPCSO..........OSPPPKKO",
                ".OOOOO..............OOOOO.",
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
                "..OCHHHHHHHHHHHHHCCCCCCSO.",
                "...OOCHHHHHHHHHHHCCCCSOO..",
                "....OOCCCCCCCCCCCCCSOO.OKO",
                ".....OCHHSS....OCHHSS..OCO",
                ".....OOOOOO....OOOOOO..OOO"
            ]
        ]
    }
};

function renderPixelSprite() {
    if (!petCanvas) return;
    const ctx = petCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 32, 32);

    const stageIdx = currentStageIndex();
    const stageName = STAGES[stageIdx];
    const speciesKey = state.species || "bunny";
    const palette = PALETTES[speciesKey] || PALETTES.bunny;

    let spriteList = SPRITES.BABY;
    if (stageName === "EGG") {
        spriteList = SPRITES.EGG;
    } else if (stageName === "BABY") {
        spriteList = SPRITES.BABY;
    } else {
        const specObj = SPRITES[speciesKey] || SPRITES.bunny;
        spriteList = (stageName === "TEEN" ? specObj.TEEN : specObj.ADULT) || specObj.TEEN;
    }

    let frameIdx = spriteAnimFrame % spriteList.length;
    if (state.sleeping) frameIdx = 1;

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
            let color = palette[char] || "#ffffff";

            if (state.neglectMarks > 0 && r === 8 && (c === 7 || c === 8)) {
                color = palette.S || "#94a3b8";
            }

            ctx.fillStyle = color;
            ctx.fillRect(offsetX + c, offsetY + r, 1, 1);
        }
    }

    // Render Ascended Halo/Crown
    if (stageName === "ASCENDED") {
        ctx.fillStyle = palette.Y || "#fde047";
        ctx.fillRect(offsetX + Math.floor(cols / 2) - 4, offsetY - 3, 9, 2);
        ctx.fillRect(offsetX + Math.floor(cols / 2) - 3, offsetY - 5, 2, 2);
        ctx.fillRect(offsetX + Math.floor(cols / 2) + 1, offsetY - 5, 2, 2);
        ctx.fillRect(offsetX + Math.floor(cols / 2) - 1, offsetY - 6, 2, 2);
    }
}

function startSpriteLoop() {
    if (spriteAnimTimer) clearInterval(spriteAnimTimer);
    spriteAnimTimer = setInterval(() => {
        spriteAnimFrame = (spriteAnimFrame + 1) % 2;
        renderPixelSprite();
    }, 750);
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

function renderPoops() {
    if (!poopLayerEl) return;
    poopLayerEl.innerHTML = "";
    if (state.poops > 0) {
        const positions = [18, 170, 95];
        for (let i = 0; i < Math.min(3, state.poops); i += 1) {
            const poop = document.createElement("div");
            poop.className = "poop-item";
            poop.textContent = "💩";
            poop.style.left = positions[i] + "px";
            poopLayerEl.appendChild(poop);
        }
    }
}

function playAnim(animClass, durationMs) {
    if (!petEl) return;
    if (animTimeout) clearTimeout(animTimeout);
    petEl.classList.remove("anim-bounce", "anim-zoomies", "anim-tickle", "anim-panic", "anim-spin", "anim-flip", "anim-sick");
    petEl.classList.add(animClass);
    animTimeout = setTimeout(() => {
        if (petEl) {
            petEl.classList.remove(animClass);
            if (state.isSick || state.poops >= 2) {
                petEl.classList.add("anim-sick");
            }
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
        if (p.parentNode) p.parentNode.removeChild(p);
    }, 1250);
}

function triggerBubbleWash() {
    if (!cleanLayerEl) return;
    cleanLayerEl.hidden = false;
    cleanLayerEl.innerHTML = "";
    for (let i = 0; i < 14; i += 1) {
        const b = document.createElement("div");
        b.className = "clean-bubble";
        const size = Math.floor(Math.random() * 16 + 8);
        b.style.width = size + "px";
        b.style.height = size + "px";
        b.style.left = Math.floor(Math.random() * 180 + 20) + "px";
        b.style.bottom = Math.floor(Math.random() * 40 + 10) + "px";
        b.style.setProperty("--bdx", (Math.random() * 40 - 20) + "px");
        b.style.animationDelay = (Math.random() * 0.4) + "s";
        cleanLayerEl.appendChild(b);
    }
    setTimeout(() => {
        if (cleanLayerEl) {
            cleanLayerEl.hidden = true;
            cleanLayerEl.innerHTML = "";
        }
    }, 1100);
}

function ensureAudio() {
    if (!state.soundOn) return null;
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
    if (!state.soundOn) return;
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

function sfxClean() {
    playTone(600, 0.06, "sine", 0, 0.08);
    playTone(800, 0.06, "sine", 0.06, 0.08);
    playTone(1000, 0.08, "sine", 0.12, 0.09);
}

function applyDecay() {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - state.lastSeen);
    const hours = Math.min(MAX_DECAY_HOURS, elapsedMs / 3600000);

    if (state.hatched) {
        state.ageHours += elapsedMs / 3600000;
        updateEvolutionSpecies();

        if (hours > 0.002) {
            const before = Math.min(state.hunger, state.happiness, state.energy);
            state.hunger = clamp(state.hunger - hours * 7, 0, 100);
            state.happiness = clamp(state.happiness - hours * 5, 0, 100);
            if (!state.sleeping) {
                state.energy = clamp(state.energy - hours * 4, 0, 100);
            } else {
                state.energy = clamp(state.energy + hours * 8, 0, 100);
            }

            // Poop generation over time
            if (hours > 1.5 && state.poops < 3) {
                state.poops = clamp(state.poops + 1, 0, 3);
            }

            const after = Math.min(state.hunger, state.happiness, state.energy);
            if (before >= 18 && after < 18) {
                state.neglectMarks += 1;
                state.isSick = true;
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
    const spec = SPECIES_LIST.find((s) => s.id === state.species) || SPECIES_LIST[0];

    if (state.isSick || mood === "sick") {
        return who + " feels unwell… Use HEAL / CLEAN!";
    }
    if (state.poops > 0) {
        return "Mess on the stage! Time to CLEAN 🧼";
    }
    if (mood === "sleeping") {
        return who + " is dreaming of " + (state.favFood ? state.favFood : "stars") + "… 💤";
    }
    if (mood === "sad") {
        return who + " missed you. Play with me?";
    }
    if (stage === "EGG") {
        return "Tap FEED to hatch your companion!";
    }
    if (stage === "ASCENDED") {
        return who + " is an Ascended Legend! ✨";
    }
    if (hr < 8) {
        return state.trait === "nocturnal" ? "The dark is cozy." : "Yawn… early morning!";
    }
    if (hr > 21 && state.trait === "nocturnal") {
        return "Night owl energy! Wide awake!";
    }
    if (state.trait === "clingy") {
        return "Stay close. " + who + " adores you! 💖";
    }
    if (state.trait === "fussy") {
        return "Only the best snacks for " + who + ".";
    }
    if (state.trait === "brave") {
        return who + " is ready for any challenge!";
    }
    if (state.trait === "curious") {
        return "What are we exploring next?";
    }
    if (state.bond > 60) {
        return who + " trusts you with all its heart! 💖";
    }
    if (stage === "BABY") {
        return "Hi! I'm " + who + "! Feed me?";
    }
    return `Gen ${state.generation} ${spec.name}. Your faithful familiar.`;
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
        } catch (error) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
                        return { line: parsed.line.trim() };
                    }
                } catch (inner) { }
            }
        }
        if (raw && !raw.startsWith("<")) {
            const cleaned = raw.replace(/^["']|["']$/g, "").trim();
            if (cleaned) return { line: cleaned };
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
    const spec = SPECIES_LIST.find((s) => s.id === state.species) || SPECIES_LIST[0];
    return [
        "You are " + state.name + ", a tiny pixel-art tamagotchi companion living inside rabbit r1.",
        "Species: " + spec.name + ". Trait: " + (state.trait || "chill") + ".",
        "Stage: " + STAGES[currentStageIndex()] + ". Gen: " + state.generation + ".",
        "Day " + dayNumber() + ". Mood: " + moodId() + ". Bond: " + state.bond + "/100.",
        state.isSick ? "Currently feeling sick and needs medicine." : "",
        state.poops > 0 ? "The room has a mess that needs cleaning." : "",
        "Speak warmly in first person, one punchy sentence, 12 words max.",
        "No markdown. Return ONLY JSON: {\"line\":\"...\"}"
    ].filter(Boolean).join(" ");
}

function render() {
    const stage = STAGES[currentStageIndex()];
    if (nameLabelEl) nameLabelEl.textContent = mode === "name" ? (nameDraft || "_") : state.name;
    if (metaLabelEl) metaLabelEl.textContent = `GEN ${state.generation} · D${dayNumber()} ${stage}`;

    // Hide all overlays first
    if (passportOverlayEl) passportOverlayEl.hidden = mode !== "stats";
    if (settingsOverlayEl) settingsOverlayEl.hidden = (mode !== "settings" && mode !== "wipe_confirm");
    if (gameLayerEl) gameLayerEl.hidden = mode !== "game_catch";
    if (rhythmLayerEl) rhythmLayerEl.hidden = mode !== "game_rhythm";

    if (actionBtnEl) actionBtnEl.classList.remove("is-danger");

    if (mode === "name") {
        if (actionBtnEl) actionBtnEl.textContent = LETTERS[letterIndex];
        if (hintEl) hintEl.textContent = "scroll: letter · side: add · hold: save";
    } else if (mode === "food") {
        const f = FOODS[foodIndex];
        if (actionBtnEl) actionBtnEl.textContent = f.name;
        if (hintEl) hintEl.textContent = "scroll: food · side: feed · hold: back";
    } else if (mode === "play_select") {
        const games = ["1. BERRY CATCH", "2. RHYTHM BEAT"];
        if (actionBtnEl) actionBtnEl.textContent = games[playSelectIndex];
        if (hintEl) hintEl.textContent = "scroll: game · side: play · hold: back";
    } else if (mode === "game_catch") {
        if (actionBtnEl) actionBtnEl.textContent = "CATCH!";
        if (hintEl) hintEl.textContent = "scroll: move · catch items!";
    } else if (mode === "game_rhythm") {
        if (actionBtnEl) actionBtnEl.textContent = "HIT BEAT!";
        if (hintEl) hintEl.textContent = "side: hit note on bar! · hold: exit";
    } else if (mode === "train") {
        const trick = TRICKS[trainIndex];
        const unlocked = state.bond >= trick.bondReq;
        if (actionBtnEl) actionBtnEl.textContent = (unlocked ? "DO " : "🔒 ") + trick.name;
        if (hintEl) hintEl.textContent = unlocked ? `${trick.desc} · hold: back` : `Needs ${trick.bondReq}% Bond · hold: back`;
    } else if (mode === "bag") {
        if (!state.bag || state.bag.length === 0) {
            if (actionBtnEl) actionBtnEl.textContent = "EMPTY BAG";
            if (hintEl) hintEl.textContent = "forage on WALK · hold: back";
        } else {
            const item = ARTIFACTS.find((a) => a.id === state.bag[bagIndex]) || ARTIFACTS[0];
            if (actionBtnEl) actionBtnEl.textContent = item.icon + " " + item.name;
            if (hintEl) hintEl.textContent = item.rarity + " " + (bagIndex + 1) + "/" + state.bag.length + " · hold: back";
        }
    } else if (mode === "sign") {
        if (actionBtnEl) actionBtnEl.textContent = signBuffer.length + "/" + SIGN_LEN;
        if (hintEl) hintEl.textContent = state.handshake.length
            ? "scroll/shake x3 · hold: exit"
            : "teach: scroll/shake x3 · hold: exit";
    } else if (mode === "stats") {
        if (actionBtnEl) actionBtnEl.textContent = "CLOSE PASSPORT";
        if (hintEl) hintEl.textContent = "side: back · hold: back";
        renderPassport();
    } else if (mode === "settings") {
        renderSettings();
    } else if (mode === "wipe_confirm") {
        renderWipeConfirm();
    } else {
        if (actionBtnEl) actionBtnEl.textContent = ACTIONS[actionIndex];
        if (hintEl) hintEl.textContent = "scroll: care · side: do · hold: speak";
    }

    renderPixelBar(barHappyEl, state.happiness);
    renderPixelBar(barHungerEl, state.hunger);
    renderPixelBar(barEnergyEl, state.energy);
    renderPoops();

    if (meterHappyEl) meterHappyEl.setAttribute("aria-valuenow", Math.round(state.happiness));
    if (meterHungerEl) meterHungerEl.setAttribute("aria-valuenow", Math.round(state.hunger));
    if (meterEnergyEl) meterEnergyEl.setAttribute("aria-valuenow", Math.round(state.energy));

    renderPixelSprite();
}

function renderPassport() {
    const spec = SPECIES_LIST.find((s) => s.id === state.species) || SPECIES_LIST[0];
    const fav = FOODS.find((f) => f.id === state.favFood) || FOODS[0];
    if (passNameEl) passNameEl.textContent = state.name;
    if (passGenEl) passGenEl.textContent = `GEN ${state.generation}`;
    if (passSpeciesEl) passSpeciesEl.textContent = spec.name;
    if (passTraitEl) passTraitEl.textContent = (state.trait || "CHILL").toUpperCase();
    if (passAgeBondEl) passAgeBondEl.textContent = `D${dayNumber()} · ${Math.round(state.bond)}%`;
    if (passFavFoodEl) passFavFoodEl.textContent = fav.name;
    const stars = Math.min(5, Math.max(1, Math.round(state.discipline / 20)));
    if (passDisciplineEl) passDisciplineEl.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
}

function renderSettings() {
    const items = [
        { label: `SOUND: ${state.soundOn ? "ON 🔊" : "MUTE 🔇"}` },
        { label: `CAMERA: ${state.camPref ? "ON 👁️" : "OFF"}` },
        { label: "RENAME PET ✏️" },
        { label: "RE-TRAIN HANDSHAKE 🤝" },
        { label: `REBIRTH / ASCEND (GEN ${state.generation + 1}) 🐣` },
        { label: "⚠️ WIPE ALL / RESET", danger: true },
        { label: "◀ BACK TO PET" }
    ];

    if (settingsTitleEl) settingsTitleEl.textContent = "SETTINGS";
    if (settingsContentEl) {
        settingsContentEl.innerHTML = items.map((it, idx) => `
            <div class="settings-item ${idx === settingsIndex ? 'is-selected' : ''}">
                <span>${it.label}</span>
                <span>${idx === settingsIndex ? '▶' : ''}</span>
            </div>
        `).join("");
    }

    if (actionBtnEl) {
        actionBtnEl.textContent = items[settingsIndex].label;
        if (items[settingsIndex].danger) actionBtnEl.classList.add("is-danger");
    }
    if (hintEl) hintEl.textContent = "scroll: select · side: toggle · hold: exit";
}

function renderWipeConfirm() {
    if (settingsTitleEl) settingsTitleEl.textContent = "⚠️ FACTORY RESET";
    if (settingsContentEl) {
        settingsContentEl.innerHTML = `
            <div class="wipe-warning">
                DELETE ALL DATA?<br>
                Progress & memories will be lost forever.
            </div>
            <div class="settings-item ${wipeConfirmChoice === 0 ? 'is-selected' : ''}">
                <span>[ KEEP PET / CANCEL ]</span>
                <span>${wipeConfirmChoice === 0 ? '▶' : ''}</span>
            </div>
            <div class="settings-item ${wipeConfirmChoice === 1 ? 'is-selected' : ''}" style="color:#ef4444;">
                <span>[ CONFIRM WIPE ALL ]</span>
                <span>${wipeConfirmChoice === 1 ? '▶' : ''}</span>
            </div>
        `;
    }

    actionBtnEl.textContent = wipeConfirmChoice === 1 ? "CONFIRM WIPE" : "CANCEL";
    if (wipeConfirmChoice === 1) actionBtnEl.classList.add("is-danger");
    hintEl.textContent = "scroll: choice · side: execute";
}

function say(text) {
    if (speechEl) speechEl.textContent = text;
    if (statusEl) statusEl.textContent = text;
}

// --- Petting / Interaction ---
function petPetting() {
    if (!state.hatched || state.sleeping) return;
    playAnim("anim-tickle", 450);
    spawnParticle("❤️", 0, -15);
    spawnParticle("✨", 10, -25);
    sfxPurr();
    state.happiness = clamp(state.happiness + 6, 0, 100);
    state.bond = clamp(state.bond + 1.5, 0, 100);
    say("Purr… " + state.name + " loves your touch!");
    render();
    saveState();
}

// --- Feeding ---
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

    // Occasional poop after eating
    if (state.care.feed % 3 === 0 && state.poops < 3) {
        state.poops += 1;
    }

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
        say("Ah… peaceful and serene.");
    } else {
        say("Nom nom! Delicious!");
    }

    mode = "care";
    updateEvolutionSpecies();
    render();
    saveState();
}

// --- Clean Bath Activity ---
function doCleanAction() {
    hatchIfNeeded();
    state.sleeping = false;
    state.care.clean += 1;
    state.poops = 0;
    state.happiness = clamp(state.happiness + 15, 0, 100);
    state.bond = clamp(state.bond + 4, 0, 100);

    triggerBubbleWash();
    sfxClean();
    playAnim("anim-bounce", 700);
    spawnParticle("🧼", -15, -20);
    spawnParticle("✨", 15, -20);
    say("Sparkling clean! All fresh and squeaky!");
    render();
    saveState();
}

// --- Heal / Clinic Activity ---
function doHealAction() {
    hatchIfNeeded();
    state.sleeping = false;
    state.care.heal += 1;
    state.isSick = false;
    state.neglectMarks = Math.max(0, state.neglectMarks - 1);
    state.hunger = clamp(state.hunger + 25, 30, 100);
    state.energy = clamp(state.energy + 30, 40, 100);
    state.happiness = clamp(state.happiness + 20, 0, 100);

    playTone(523, 0.1, "sine", 0, 0.1);
    playTone(659, 0.1, "sine", 0.1, 0.1);
    playTone(880, 0.2, "sine", 0.2, 0.12);
    spawnParticle("🩹", 0, -15);
    spawnParticle("🧪", 12, -25);
    spawnParticle("💖", -12, -25);
    playAnim("anim-bounce", 600);
    say("Cured! Vitality fully restored!");
    render();
    saveState();
}

// --- Train & Tricks ---
function enterTrainMenu() {
    hatchIfNeeded();
    mode = "train";
    trainIndex = 0;
    render();
    say("Select a trick to perform!");
}

function doTrainTrick() {
    const trick = TRICKS[trainIndex];
    if (state.bond < trick.bondReq) {
        say(`Keep bonding! Unlocks at ${trick.bondReq}% Bond.`);
        chirp(300, 0.08);
        return;
    }
    state.discipline = clamp(state.discipline + 12, 0, 100);
    state.bond = clamp(state.bond + 3, 0, 100);
    state.happiness = clamp(state.happiness + 10, 0, 100);
    state.care.train += 1;

    playAnim(trick.anim, 800);
    sfxWin();
    spawnParticle("⭐", -10, -20);
    spawnParticle("✨", 10, -20);
    say(`Mastered ${trick.name}! Bravo!`);
    render();
    saveState();
}

// --- Mini-Games Hub ---
function enterPlaySelect() {
    hatchIfNeeded();
    if (state.energy < 10) {
        say("Too exhausted to play! Nap first?");
        return;
    }
    mode = "play_select";
    playSelectIndex = 0;
    render();
    say("Choose a mini-game!");
}

function startChosenGame() {
    if (playSelectIndex === 0) {
        startCatchGame();
    } else {
        startRhythmGame();
    }
}

// Game 1: Catch the Berry
function startCatchGame() {
    mode = "game_catch";
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

    if (gameScoreLabelEl) gameScoreLabelEl.textContent = "00 PTS";
    if (gameTimerLabelEl) gameTimerLabelEl.textContent = "10s";
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

    state.highScores.catch = Math.max(state.highScores.catch || 0, gameScore);
    const bonusHappy = Math.min(45, Math.round(gameScore * 0.6) + 10);
    const bonusBond = Math.min(20, Math.round(gameScore * 0.3) + 2);
    state.happiness = clamp(state.happiness + bonusHappy, 0, 100);
    state.bond = clamp(state.bond + bonusBond, 0, 100);

    mode = "care";
    playAnim("anim-bounce", 800);
    sfxWin();
    say(`Score: ${gameScore}! +${bonusHappy} HAP, +${bonusBond} BOND!`);
    updateEvolutionSpecies();
    render();
    saveState();
}

// Game 2: Rhythm Pulse
function startRhythmGame() {
    mode = "game_rhythm";
    rhythmActive = true;
    rhythmScore = 0;
    rhythmCombo = 0;
    rhythmNotes = [];
    state.sleeping = false;
    state.care.play += 1;
    state.energy = clamp(state.energy - 10, 0, 100);

    if (rhythmLayerEl) rhythmLayerEl.hidden = false;
    if (rhythmScoreLabelEl) rhythmScoreLabelEl.textContent = "000 PTS";
    if (rhythmComboLabelEl) rhythmComboLabelEl.textContent = "x0";
    if (rhythmFeedbackEl) rhythmFeedbackEl.textContent = "";

    say("Hit side button when note hits target!");
    render();

    let noteCount = 0;
    rhythmSpawnInterval = setInterval(() => {
        if (!rhythmActive) return;
        spawnRhythmNote();
        noteCount += 1;
        if (noteCount >= 16) {
            clearInterval(rhythmSpawnInterval);
            setTimeout(() => {
                if (rhythmActive) endRhythmGame();
            }, 2500);
        }
    }, 700);

    requestAnimationFrame(updateRhythmGame);
}

function spawnRhythmNote() {
    if (!rhythmTrackEl) return;
    const note = {
        el: document.createElement("div"),
        y: 0,
        speed: 2.2
    };
    note.el.className = "rhythm-note";
    note.el.style.top = "0px";
    rhythmTrackEl.appendChild(note.el);
    rhythmNotes.push(note);
}

function updateRhythmGame() {
    if (!rhythmActive) return;

    for (let i = rhythmNotes.length - 1; i >= 0; i -= 1) {
        const note = rhythmNotes[i];
        note.y += note.speed;
        note.el.style.top = note.y + "px";

        if (note.y > 90) {
            rhythmCombo = 0;
            if (rhythmComboLabelEl) rhythmComboLabelEl.textContent = "x0";
            showRhythmFeedback("MISS", "#ef4444");
            if (note.el.parentNode) note.el.parentNode.removeChild(note.el);
            rhythmNotes.splice(i, 1);
        }
    }

    requestAnimationFrame(updateRhythmGame);
}

function hitRhythmBeat() {
    if (!rhythmActive || rhythmNotes.length === 0) return;
    const targetY = 65;
    let closestIdx = -1;
    let minDiff = 999;

    for (let i = 0; i < rhythmNotes.length; i += 1) {
        const diff = Math.abs(rhythmNotes[i].y - targetY);
        if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
        }
    }

    if (closestIdx !== -1 && minDiff < 22) {
        const note = rhythmNotes[closestIdx];
        if (minDiff < 8) {
            rhythmScore += 30;
            rhythmCombo += 1;
            showRhythmFeedback("PERFECT! ✨", "#34d399");
            sfxBoing();
        } else {
            rhythmScore += 15;
            rhythmCombo += 1;
            showRhythmFeedback("GOOD! 🎵", "#22d3ee");
            chirp(700, 0.05);
        }
        if (rhythmScoreLabelEl) rhythmScoreLabelEl.textContent = rhythmScore + " PTS";
        if (rhythmComboLabelEl) rhythmComboLabelEl.textContent = "x" + rhythmCombo;
        if (note.el.parentNode) note.el.parentNode.removeChild(note.el);
        rhythmNotes.splice(closestIdx, 1);
    } else {
        rhythmCombo = 0;
        if (rhythmComboLabelEl) rhythmComboLabelEl.textContent = "x0";
        showRhythmFeedback("MISS", "#ef4444");
        chirp(200, 0.05);
    }
}

function showRhythmFeedback(text, color) {
    if (!rhythmFeedbackEl) return;
    rhythmFeedbackEl.textContent = text;
    rhythmFeedbackEl.style.color = color;
}

function endRhythmGame() {
    rhythmActive = false;
    if (rhythmSpawnInterval) clearInterval(rhythmSpawnInterval);
    rhythmSpawnInterval = null;

    if (rhythmLayerEl) rhythmLayerEl.hidden = true;
    if (rhythmTrackEl) rhythmTrackEl.querySelectorAll(".rhythm-note").forEach((n) => n.remove());

    state.highScores.rhythm = Math.max(state.highScores.rhythm || 0, rhythmScore);
    const bonusHappy = Math.min(50, Math.round(rhythmScore * 0.25) + 15);
    const bonusBond = Math.min(25, Math.round(rhythmScore * 0.15) + 5);
    state.happiness = clamp(state.happiness + bonusHappy, 0, 100);
    state.bond = clamp(state.bond + bonusBond, 0, 100);
    state.discipline = clamp(state.discipline + 10, 0, 100);

    mode = "care";
    playAnim("anim-bounce", 800);
    sfxWin();
    say(`Rhythm Score: ${rhythmScore}! +${bonusHappy} HAP!`);
    updateEvolutionSpecies();
    render();
    saveState();
}

// --- Walk / Foraging ---
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
        updateEvolutionSpecies();
        render();
        saveState();
    }, 1300);
}

// --- Backpack Collection ---
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

// --- Care Router ---
function doCareAction() {
    const action = ACTIONS[actionIndex];
    ensureAudio();

    if (action === "FEED") { enterFoodMenu(); return; }
    if (action === "PLAY") { enterPlaySelect(); return; }
    if (action === "TRAIN") { enterTrainMenu(); return; }
    if (action === "CLEAN") { doCleanAction(); return; }
    if (action === "HEAL") { doHealAction(); return; }
    if (action === "WALK") { doWalkAction(); return; }
    if (action === "BAG") { enterBagView(); return; }
    if (action === "SIGN") { enterSign(); return; }
    if (action === "STATS") { mode = "stats"; render(); say("Viewing Pet Passport."); return; }
    if (action === "SETTINGS") { mode = "settings"; settingsIndex = 0; render(); say("Settings Menu."); return; }

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
            say("Awake and energized!");
        }
    }

    state.lastSeen = Date.now();
    render();
    saveState();
}

function cycleAction(delta) {
    if (mode === "game_catch") {
        movePetGame(delta * 18);
        return;
    }
    if (mode === "food") {
        cycleFood(delta);
        return;
    }
    if (mode === "play_select") {
        playSelectIndex = (playSelectIndex + delta + 2) % 2;
        render();
        return;
    }
    if (mode === "train") {
        trainIndex = (trainIndex + delta + TRICKS.length) % TRICKS.length;
        render();
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
    if (mode === "settings") {
        settingsIndex = (settingsIndex + delta + 7) % 7;
        render();
        return;
    }
    if (mode === "wipe_confirm") {
        wipeConfirmChoice = (wipeConfirmChoice + delta + 2) % 2;
        render();
        return;
    }
    if (mode === "stats") {
        return;
    }

    actionIndex = (actionIndex + delta + ACTIONS.length) % ACTIONS.length;
    render();
    if (statusEl) statusEl.textContent = ACTIONS[actionIndex];
}

function onSideClick() {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) return;
    lastSideClickAt = now;

    if (mode === "game_catch") return;
    if (mode === "game_rhythm") {
        hitRhythmBeat();
        return;
    }
    if (mode === "food") {
        feedSelectedFood();
        return;
    }
    if (mode === "play_select") {
        startChosenGame();
        return;
    }
    if (mode === "train") {
        doTrainTrick();
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
    if (mode === "stats") {
        mode = "care";
        render();
        say("Back with " + state.name + ".");
        return;
    }
    if (mode === "settings") {
        handleSettingsSelect();
        return;
    }
    if (mode === "wipe_confirm") {
        handleWipeConfirm();
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

function handleSettingsSelect() {
    if (settingsIndex === 0) {
        state.soundOn = !state.soundOn;
        say(`Sound: ${state.soundOn ? "Enabled" : "Muted"}`);
        if (state.soundOn) sfxBoing();
        render();
        saveState();
        return;
    }
    if (settingsIndex === 1) {
        toggleCam();
        return;
    }
    if (settingsIndex === 2) {
        enterName();
        return;
    }
    if (settingsIndex === 3) {
        state.handshake = [];
        enterSign();
        return;
    }
    if (settingsIndex === 4) {
        performRebirth();
        return;
    }
    if (settingsIndex === 5) {
        mode = "wipe_confirm";
        wipeConfirmChoice = 0;
        render();
        say("WARNING: Factory reset save data?");
        return;
    }
    if (settingsIndex === 6) {
        mode = "care";
        render();
        say("Back with " + state.name + ".");
        return;
    }
}

function performRebirth() {
    state.generation += 1;
    state.hatched = false;
    state.hatchedAt = 0;
    state.bornAt = Date.now();
    state.ageHours = 0;
    state.hunger = 80;
    state.happiness = 80;
    state.energy = 90;
    state.bond = 15;
    state.poops = 0;
    state.isSick = false;
    state.neglectMarks = 0;
    state.care = { feed: 0, play: 0, train: 0, clean: 0, heal: 0, sleep: 0, walk: 0 };
    mode = "care";
    sfxWin();
    spawnParticle("✨", 0, -10);
    spawnParticle("🐣", 10, -20);
    say(`Gen ${state.generation} egg ready! Tap FEED to hatch!`);
    render();
    saveState();
}

async function handleWipeConfirm() {
    if (wipeConfirmChoice === 0) {
        mode = "settings";
        render();
        say("Wipe cancelled. Pet is safe!");
        return;
    }

    // Full Factory Reset / Wipe Data
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            await window.creationStorage.plain.removeItem(STORAGE_KEY);
        }
    } catch (e) { }
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { }

    state.name = "BIT";
    state.species = "bunny";
    state.trait = "chill";
    state.hatched = false;
    state.hunger = 70;
    state.happiness = 70;
    state.energy = 80;
    state.bond = 10;
    state.discipline = 20;
    state.ageHours = 0;
    state.generation = 1;
    state.sleeping = false;
    state.poops = 0;
    state.isSick = false;
    state.lastSeen = Date.now();
    state.bornAt = Date.now();
    state.hatchedAt = 0;
    state.care = { feed: 0, play: 0, train: 0, clean: 0, heal: 0, sleep: 0, walk: 0 };
    state.tricks = ["spin"];
    state.bag = [];
    state.neglectMarks = 0;
    state.handshake = [];
    state.favFood = "berry";
    state.dislikeFood = "pepper";
    state.highScores = { catch: 0, rhythm: 0 };

    mode = "care";
    playTone(300, 0.1, "sawtooth");
    playTone(200, 0.15, "sawtooth", 0.1);
    say("Reset complete. Tap FEED to hatch fresh egg.");
    render();
    saveState();
}

function onLongPress() {
    if (mode === "food" || mode === "bag" || mode === "play_select" || mode === "train" || mode === "stats" || mode === "settings" || mode === "wipe_confirm") {
        mode = "care";
        render();
        say("Back with " + state.name + ".");
        return;
    }
    if (mode === "game_catch") {
        endCatchGame();
        return;
    }
    if (mode === "game_rhythm") {
        endRhythmGame();
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
        say("Handshake paused.");
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
        console.warn("Familiar speak fallback", error);
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
    say("Spell my name! Scroll letter, click add.");
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
        say("Locked. That's our secret sign! 🤝");
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
        say("Camera window closed.");
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        say("Camera unavailable.");
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
        say("Camera error.");
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
        try { camStream.getTracks().forEach((t) => t.stop()); } catch (e) { }
        camStream = null;
    }
}

async function startMic() {
    if (micTimer || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
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
        try { micSource.disconnect(); } catch (e) { }
        micSource = null;
    }
    if (micAnalyser) {
        try { micAnalyser.disconnect(); } catch (e) { }
        micAnalyser = null;
    }
    if (micStream) {
        try { micStream.getTracks().forEach((t) => t.stop()); } catch (e) { }
        micStream = null;
    }
}

function startLiveTick() {
    if (liveTickTimer) clearInterval(liveTickTimer);
    liveTickTimer = setInterval(() => {
        if (!document.hidden && !gameActive && !rhythmActive) {
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
        species: state.species,
        trait: state.trait,
        hatched: state.hatched,
        hunger: state.hunger,
        happiness: state.happiness,
        energy: state.energy,
        bond: state.bond,
        discipline: state.discipline,
        ageHours: state.ageHours,
        generation: state.generation,
        sleeping: state.sleeping,
        poops: state.poops,
        isSick: state.isSick,
        soundOn: state.soundOn,
        lastSeen: state.lastSeen,
        bornAt: state.bornAt,
        hatchedAt: state.hatchedAt || 0,
        care: Object.assign({}, state.care),
        tricks: (state.tricks || []).slice(),
        bag: (state.bag || []).slice(),
        favFood: state.favFood || "",
        dislikeFood: state.dislikeFood || "",
        neglectMarks: state.neglectMarks,
        handshake: state.handshake.slice(),
        camPref: state.camPref,
        highScores: Object.assign({}, state.highScores)
    };
}

function applySnapshot(saved) {
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.name === "string" && saved.name.trim()) {
        state.name = saved.name.trim().slice(0, NAME_MAX).toUpperCase();
    }
    if (SPECIES_LIST.some((s) => s.id === saved.species)) {
        state.species = saved.species;
    }
    if (TRAITS.indexOf(saved.trait) !== -1) {
        state.trait = saved.trait;
    }
    if (typeof saved.hatched === "boolean") {
        state.hatched = saved.hatched;
    }
    ["hunger", "happiness", "energy", "bond", "discipline", "ageHours", "generation", "poops", "neglectMarks"].forEach((key) => {
        if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
            state[key] = Math.max(0, saved[key]);
        }
    });
    if (typeof saved.sleeping === "boolean") state.sleeping = saved.sleeping;
    if (typeof saved.isSick === "boolean") state.isSick = saved.isSick;
    if (typeof saved.soundOn === "boolean") state.soundOn = saved.soundOn;
    if (typeof saved.lastSeen === "number" && Number.isFinite(saved.lastSeen)) state.lastSeen = saved.lastSeen;
    if (typeof saved.bornAt === "number" && Number.isFinite(saved.bornAt)) state.bornAt = saved.bornAt;
    if (typeof saved.hatchedAt === "number" && Number.isFinite(saved.hatchedAt)) state.hatchedAt = saved.hatchedAt;

    if (saved.care && typeof saved.care === "object") {
        ["feed", "play", "train", "clean", "heal", "sleep", "walk"].forEach((key) => {
            if (typeof saved.care[key] === "number" && Number.isFinite(saved.care[key])) {
                state.care[key] = Math.max(0, Math.round(saved.care[key]));
            }
        });
    }
    if (Array.isArray(saved.bag)) {
        state.bag = saved.bag.filter((id) => ARTIFACTS.some((a) => a.id === id));
    }
    if (Array.isArray(saved.tricks)) {
        state.tricks = saved.tricks;
    }
    if (typeof saved.favFood === "string") state.favFood = saved.favFood;
    if (typeof saved.dislikeFood === "string") state.dislikeFood = saved.dislikeFood;
    if (Array.isArray(saved.handshake)) {
        state.handshake = saved.handshake.filter((s) => s === "up" || s === "down" || s === "shake").slice(0, SIGN_LEN);
    }
    if (typeof saved.camPref === "boolean") state.camPref = saved.camPref;
    if (saved.highScores && typeof saved.highScores === "object") {
        state.highScores = Object.assign({ catch: 0, rhythm: 0 }, saved.highScores);
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
    if (mode === "game_catch" || mode === "game_rhythm") return;

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
        try { accel.stop(); } catch (e) { }
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
    if (rhythmActive) endRhythmGame();
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

    if (actionBtnEl) {
        actionBtnEl.addEventListener("click", (event) => {
            event.stopPropagation();
            onSideClick();
        });
    }

    if (petEl) {
        petEl.addEventListener("click", (event) => {
            event.stopPropagation();
            petPetting();
        });
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest(".action") || event.target.closest(".pet") || event.target.closest(".settings-card") || event.target.closest(".passport-card")) {
            return;
        }
        cycleAction(1);
    });

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

    document.addEventListener("touchstart", () => {
        touchMoved = false;
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
            if (!touchMoved) onLongPress();
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
        if (mode === "game_rhythm") {
            if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                hitRhythmBeat();
                return;
            }
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            cycleAction(-1);
            return;
        }
        if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
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
                if (rhythmActive) endRhythmGame();
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
    updateEvolutionSpecies();
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
            updateEvolutionSpecies();
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
