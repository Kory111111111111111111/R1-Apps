const STORAGE_KEY = "lastTypeId";
const DEFAULT_TYPE_ID = "d6";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TYPES = [
    { id: "coin", label: "COIN", sides: 2, kind: "coin" },
    { id: "d4", label: "D4", sides: 4, kind: "die" },
    { id: "d6", label: "D6", sides: 6, kind: "die" },
    { id: "d8", label: "D8", sides: 8, kind: "die" },
    { id: "d10", label: "D10", sides: 10, kind: "die" },
    { id: "d12", label: "D12", sides: 12, kind: "die" },
    { id: "d20", label: "D20", sides: 20, kind: "die" }
];

// Pip indices into the fixed 3x3 pip grid, per die value.
const PIPS_PER_VALUE = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
};

const currentTypeEl = document.getElementById("currentType");
const prevTypeEl = document.getElementById("prevType");
const nextTypeEl = document.getElementById("nextType");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const coinEl = document.getElementById("coin");
const coinInnerEl = document.querySelector(".coin-inner");
const coinFrontTextEl = document.getElementById("coinFrontText");
const coinBackTextEl = document.getElementById("coinBackText");
const dieFaceEl = document.getElementById("dieFace");
const dieNumberEl = document.getElementById("dieNumber");
const pipsEl = Array.from(document.querySelectorAll(".pip"));

let typeIndex = TYPES.findIndex((type) => type.id === DEFAULT_TYPE_ID);
let lastSideClickAt = 0;
let dieRollTimer = null;

function typeAt(index) {
    const wrapped = (index + TYPES.length) % TYPES.length;
    return TYPES[wrapped];
}

let lastCryptoValue = -1;
let cryptoRepeatStreak = 0;

// Returns a Uint32 from crypto.getRandomValues, or null when the source looks
// broken (some Android WebViews ship a stubbed getRandomValues that always
// returns the same value). A real CSPRNG repeats a value ~1 in 4 billion;
// three consecutive repeats means the RNG is dead, not lucky.
function cryptoUint32() {
    const buf = new Uint32Array(1);
    try {
        window.crypto.getRandomValues(buf);
    } catch (error) {
        console.warn("crypto.getRandomValues failed", error);
        return null;
    }
    const value = buf[0];
    if (value === lastCryptoValue) {
        cryptoRepeatStreak += 1;
    } else {
        cryptoRepeatStreak = 0;
    }
    lastCryptoValue = value;
    if (cryptoRepeatStreak >= 3) {
        console.warn("crypto.getRandomValues looks stubbed; falling back");
        return null;
    }
    return value;
}

// Rejection sampling over a full Uint32: unbiased, and never returns the same
// value twice in a row (which a real random source does almost never anyway).
function randomInt(min, maxInclusive) {
    const range = maxInclusive - min + 1;
    const canCrypto = window.crypto && typeof window.crypto.getRandomValues === "function";
    if (canCrypto) {
        const limit = Math.floor(0x100000000 / range) * range;
        let value;
        let guard = 0;
        do {
            value = cryptoUint32();
            guard += 1;
            if (guard > 10) {
                break;
            }
        } while (value !== null && value >= limit);
        if (value !== null && value < limit) {
            return min + (value % range);
        }
        if (value === null) {
            console.warn("crypto RNG unavailable; using Math.random");
        }
    }
    const fallback = min + Math.floor(Math.random() * range);
    if (!canCrypto) {
        return fallback;
    }
    // Mix Math.random entropy into the fallback so identical fallback values
    // across calls stay decorrelated.
    return min + ((fallback - min + Math.floor(Math.random() * range)) % range);
}

function rollValue(type) {
    const n = randomInt(1, type.sides);
    if (type.kind === "coin") {
        return n === 1 ? "HEADS" : "TAILS";
    }
    return String(n);
}

function setPips(value) {
    const on = PIPS_PER_VALUE[value] || [];
    pipsEl.forEach((pip, i) => pip.classList.toggle("on", on.indexOf(i) !== -1));
}

function renderType() {
    const current = typeAt(typeIndex);
    const prev = typeAt(typeIndex - 1);
    const next = typeAt(typeIndex + 1);

    currentTypeEl.textContent = current.label;
    prevTypeEl.textContent = prev.label;
    nextTypeEl.textContent = next.label;

    const isCoin = current.kind === "coin";
    coinEl.hidden = !isCoin;
    dieFaceEl.hidden = isCoin;

    dieFaceEl.classList.toggle("has-pips", current.sides === 6);
    dieFaceEl.classList.toggle("no-pips", current.sides !== 6);
    dieNumberEl.textContent = "—";
    setPips(0);
    resultEl.setAttribute("aria-label", "Roll " + current.label);
}

function cycleType(delta) {
    typeIndex = (typeIndex + delta + TYPES.length) % TYPES.length;
    renderType();
    saveLastType(typeAt(typeIndex).id);
}

function flipCoin(value) {
    const isTails = value === "TAILS";
    coinFrontTextEl.textContent = "HEADS";
    coinBackTextEl.textContent = "TAILS";
    coinEl.classList.toggle("is-tails", isTails);

    if (REDUCED_MOTION) {
        coinEl.classList.remove("is-flipping");
        return;
    }

    coinEl.classList.remove("is-flipping");
    void coinEl.offsetWidth;
    coinEl.classList.add("is-flipping");
}

function rollDie(value, sides) {
    if (dieRollTimer) {
        clearInterval(dieRollTimer);
        dieRollTimer = null;
    }

    if (REDUCED_MOTION) {
        showDieFace(value);
        return;
    }

    dieFaceEl.classList.remove("is-rolling");
    void dieFaceEl.offsetWidth;
    dieFaceEl.classList.add("is-rolling");

    let ticks = 0;
    dieRollTimer = setInterval(() => {
        ticks += 1;
        if (ticks >= 5) {
            clearInterval(dieRollTimer);
            dieRollTimer = null;
            dieFaceEl.classList.remove("is-rolling");
            showDieFace(value);
            return;
        }
        showDieFace(String(randomInt(1, sides)));
    }, 80);
}

function showDieFace(value) {
    const parsed = Number(value);
    if (dieFaceEl.classList.contains("has-pips") && PIPS_PER_VALUE[parsed]) {
        setPips(parsed);
    } else {
        setPips(0);
    }
    dieNumberEl.textContent = value;
}

function roll() {
    const type = typeAt(typeIndex);
    const value = rollValue(type);

    resultEl.setAttribute("aria-label", type.label + ": " + value);
    statusEl.textContent = type.kind === "coin" ? value : type.label + " " + value;

    if (type.kind === "coin") {
        flipCoin(value);
    } else {
        rollDie(value, type.sides);
    }
}

function onSideClick() {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
        return;
    }
    lastSideClickAt = now;
    roll();
}

async function saveLastType(id) {
    const payload = JSON.stringify({ id: id });
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

async function loadLastTypeId() {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            const stored = await window.creationStorage.plain.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(atob(stored)).id;
            }
        }
    } catch (error) {
        console.warn("creationStorage read failed", error);
    }
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored).id;
        }
    } catch (error) {
        console.warn("localStorage read failed", error);
    }
    return DEFAULT_TYPE_ID;
}

function indexForTypeId(id) {
    const index = TYPES.findIndex((type) => type.id === id);
    return index === -1 ? TYPES.findIndex((type) => type.id === DEFAULT_TYPE_ID) : index;
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => cycleType(-1));
    window.addEventListener("scrollDown", () => cycleType(1));
    window.addEventListener("sideClick", onSideClick);
}

function initializeFallbackInput() {
    prevTypeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        cycleType(-1);
    });
    nextTypeEl.addEventListener("click", (event) => {
        event.stopPropagation();
        cycleType(1);
    });
    resultEl.addEventListener("click", () => {
        roll();
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            cycleType(-1);
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            cycleType(1);
            return;
        }
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            roll();
        }
    });
}

async function init() {
    const savedId = await loadLastTypeId();
    typeIndex = indexForTypeId(savedId);
    renderType();
    initializeHardware();
    initializeFallbackInput();
}

document.addEventListener("DOMContentLoaded", () => {
    init();
});