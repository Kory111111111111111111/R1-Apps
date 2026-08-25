const STORAGE_KEY = "lastTypeId";
const DEFAULT_TYPE_ID = "d6";
const SIDE_CLICK_DEBOUNCE_MS = 120;

const TYPES = [
    { id: "coin", label: "COIN", sides: 2, kind: "coin" },
    { id: "d4", label: "D4", sides: 4, kind: "die" },
    { id: "d6", label: "D6", sides: 6, kind: "die" },
    { id: "d8", label: "D8", sides: 8, kind: "die" },
    { id: "d10", label: "D10", sides: 10, kind: "die" },
    { id: "d12", label: "D12", sides: 12, kind: "die" },
    { id: "d20", label: "D20", sides: 20, kind: "die" }
];

const currentTypeEl = document.getElementById("currentType");
const prevTypeEl = document.getElementById("prevType");
const nextTypeEl = document.getElementById("nextType");
const resultEl = document.getElementById("result");

let typeIndex = TYPES.findIndex((type) => type.id === DEFAULT_TYPE_ID);
let lastSideClickAt = 0;

function typeAt(index) {
    const wrapped = (index + TYPES.length) % TYPES.length;
    return TYPES[wrapped];
}

function randomInt(min, maxInclusive) {
    const range = maxInclusive - min + 1;
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const buf = new Uint32Array(1);
        const limit = Math.floor(0x100000000 / range) * range;
        let value;
        do {
            window.crypto.getRandomValues(buf);
            value = buf[0];
        } while (value >= limit);
        return min + (value % range);
    }
    return min + Math.floor(Math.random() * range);
}

function rollValue(type) {
    const n = randomInt(1, type.sides);
    if (type.kind === "coin") {
        return n === 1 ? "HEADS" : "TAILS";
    }
    return String(n);
}

function renderType() {
    const current = typeAt(typeIndex);
    const prev = typeAt(typeIndex - 1);
    const next = typeAt(typeIndex + 1);

    currentTypeEl.textContent = current.label;
    prevTypeEl.textContent = prev.label;
    nextTypeEl.textContent = next.label;

    resultEl.textContent = "—";
    resultEl.classList.toggle("is-coin", current.kind === "coin");
    resultEl.classList.remove("is-rolling");
}

function cycleType(delta) {
    typeIndex = (typeIndex + delta + TYPES.length) % TYPES.length;
    renderType();
    saveLastType(typeAt(typeIndex).id);
}

function roll() {
    const type = typeAt(typeIndex);
    const value = rollValue(type);

    resultEl.classList.toggle("is-coin", type.kind === "coin");
    resultEl.textContent = value;
    resultEl.classList.remove("is-rolling");
    void resultEl.offsetWidth;
    resultEl.classList.add("is-rolling");
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
