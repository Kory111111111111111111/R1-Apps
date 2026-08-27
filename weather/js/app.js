const STORAGE_KEY = "weatherState";
const SIDE_CLICK_DEBOUNCE_MS = 120;
const FETCH_TIMEOUT_MS = 9000;
const LLM_TIMEOUT_MS = 25000;
const US_ZIP_RE = /^\d{5}(?:-?\d{4})?$/;
const ZIP_LENGTH = 5;

let state = {
    lat: 40.7128,
    lon: -74.0060,
    cityName: "New York",
    zipCode: "10001",
    units: "imperial",
    currentViewIndex: 0 // 0: Current, 1: Hourly, 2: Daily, 3: Location
};

const views = ["viewCurrent", "viewHourly", "viewDaily", "viewLocation"];
let lastSideClickAt = 0;
let weatherCache = null;
let zipDigits = "";
let isFetching = false;

let pendingLlmResolve = null;
let pendingLlmReject = null;
let llmTimeoutId = null;

// DOM Elements
const locationNameEl = document.getElementById("locationName");
const tempUnitEl = document.getElementById("tempUnit");
const currentIconEl = document.getElementById("currentIcon");
const currentTempEl = document.getElementById("currentTemp");
const currentConditionEl = document.getElementById("currentCondition");
const detailHumidityEl = document.getElementById("detailHumidity");
const detailWindEl = document.getElementById("detailWind");
const hourlyListEl = document.getElementById("hourlyList");
const dailyListEl = document.getElementById("dailyList");
const dots = document.querySelectorAll(".dot");
const statusEl = document.getElementById("status");
const zipDisplayEl = document.getElementById("zipDisplay");
const zipPadEl = document.getElementById("zipPad");
const browserCityRowEl = document.getElementById("browserCityRow");
const cityInputEl = document.getElementById("cityInput");
const citySetBtnEl = document.getElementById("citySetBtn");
const locationStatusEl = document.getElementById("locationStatus");
const appEl = document.getElementById("app");

function hasPluginHandler() {
    return typeof PluginMessageHandler !== "undefined";
}

function isUsZip(query) {
    return US_ZIP_RE.test(String(query).trim());
}

function normalizeZip(query) {
    return String(query).trim().slice(0, ZIP_LENGTH);
}

function toNumber(value, fallback = NaN) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function stripMarkdownFences(text) {
    return String(text)
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseLlmJson(data) {
    const sources = [data?.data, data?.message].filter((value) => value != null && value !== "");
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
                wantsR1Response: false,
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

async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// SVG Weather Icons Generator
function getWeatherSvg(code) {
    switch (code) {
        case 0:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>`;
        case 1:
        case 2:
        case 3:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>`;
        case 45:
        case 48:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="10" x2="20" y2="10"></line>
                    <line x1="6" y1="14" x2="18" y2="14"></line>
                    <line x1="8" y1="6" x2="16" y2="6"></line>
                    <line x1="5" y1="18" x2="19" y2="18"></line>
                </svg>`;
        case 51:
        case 53:
        case 55:
        case 61:
        case 63:
        case 65:
        case 80:
        case 81:
        case 82:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
                    <line x1="8" y1="19" x2="8" y2="21"></line>
                    <line x1="12" y1="19" x2="12" y2="21"></line>
                    <line x1="16" y1="19" x2="16" y2="21"></line>
                </svg>`;
        case 71:
        case 73:
        case 75:
        case 77:
        case 85:
        case 86:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
                    <line x1="8" y1="18" x2="8" y2="18.01"></line>
                    <line x1="12" y1="18" x2="12" y2="18.01"></line>
                    <line x1="16" y1="18" x2="16" y2="18.01"></line>
                </svg>`;
        case 95:
        case 96:
        case 99:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path>
                    <polyline points="13 11 9 17 15 17 11 23"></polyline>
                </svg>`;
        default:
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                </svg>`;
    }
}

function getWeatherText(code) {
    switch (code) {
        case 0: return "Clear sky";
        case 1:
        case 2:
        case 3: return "Partly cloudy";
        case 45:
        case 48: return "Foggy";
        case 51:
        case 53:
        case 55: return "Drizzle";
        case 61:
        case 63:
        case 65: return "Rain";
        case 71:
        case 73:
        case 75: return "Snow";
        case 80:
        case 81:
        case 82: return "Rain showers";
        case 95:
        case 96:
        case 99: return "Thunderstorm";
        default: return "Fair";
    }
}

function conditionTextToCode(text) {
    const value = String(text || "").toLowerCase();
    if (value.includes("clear") || value.includes("sunny")) return 0;
    if (value.includes("fog")) return 45;
    if (value.includes("drizzle")) return 53;
    if (value.includes("thunder")) return 95;
    if (value.includes("snow")) return 71;
    if (value.includes("rain") || value.includes("shower")) return 61;
    if (value.includes("cloud")) return 2;
    return 1;
}

/* --- Persistence (creationStorage + localStorage, mirrors dice/metronome) --- */

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

function locationSnapshot() {
    return {
        lat: state.lat,
        lon: state.lon,
        cityName: state.cityName,
        zipCode: state.zipCode || "",
        units: state.units
    };
}

function isValidSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        return false;
    }
    if (!Number.isFinite(snapshot.lat) || snapshot.lat < -90 || snapshot.lat > 90) {
        return false;
    }
    if (!Number.isFinite(snapshot.lon) || snapshot.lon < -180 || snapshot.lon > 180) {
        return false;
    }
    if (snapshot.zipCode && !/^\d{5}$/.test(String(snapshot.zipCode))) {
        return false;
    }
    if (snapshot.units && snapshot.units !== "imperial" && snapshot.units !== "metric") {
        return false;
    }
    if (snapshot.cityName != null && typeof snapshot.cityName !== "string") {
        return false;
    }
    return true;
}

function applySnapshot(snapshot) {
    state.lat = snapshot.lat;
    state.lon = snapshot.lon;
    if (snapshot.cityName) {
        state.cityName = snapshot.cityName;
    }
    if (snapshot.zipCode) {
        state.zipCode = snapshot.zipCode;
    }
    if (snapshot.units === "imperial" || snapshot.units === "metric") {
        state.units = snapshot.units;
    }
}

function parseStoredJson(raw, encoded) {
    const json = encoded ? base64ToUtf8(raw) : raw;
    return JSON.parse(json);
}

async function loadStoredState() {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            const stored = await window.creationStorage.plain.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = parseStoredJson(stored, true);
                if (isValidSnapshot(parsed)) {
                    applySnapshot(parsed);
                    return;
                }
            }
        }
    } catch (error) {
        console.warn("creationStorage read failed", error);
    }

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return;
        }
        let parsed;
        try {
            parsed = parseStoredJson(stored, false);
        } catch (rawError) {
            parsed = parseStoredJson(stored, true);
        }
        if (isValidSnapshot(parsed)) {
            applySnapshot(parsed);
        }
    } catch (error) {
        console.warn("localStorage read failed", error);
    }
}

async function saveStoredState() {
    const payload = JSON.stringify(locationSnapshot());
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

function setLocationStatus(message, isError) {
    locationStatusEl.textContent = message || "";
    locationStatusEl.classList.toggle("error", Boolean(isError));
}

function renderZipDisplay() {
    const padded = (zipDigits + "-----").slice(0, ZIP_LENGTH);
    zipDisplayEl.textContent = padded.split("").join(" ");
}

function resetZipDigits() {
    zipDigits = state.zipCode ? normalizeZip(state.zipCode) : "";
    renderZipDisplay();
}

async function geocodeZipViaApi(zip) {
    const zip5 = normalizeZip(zip);
    const res = await fetchWithTimeout(`https://api.zippopotam.us/us/${zip5}`, FETCH_TIMEOUT_MS);
    if (!res.ok) {
        throw new Error("ZIP not found");
    }
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) {
        throw new Error("ZIP not found");
    }
    return {
        name: `${place["place name"]}, ${place["state abbreviation"]} ${zip5}`,
        lat: parseFloat(place.latitude),
        lon: parseFloat(place.longitude),
        zipCode: zip5
    };
}

async function geocodeCityViaApi(query) {
    const res = await fetchWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`,
        FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
        throw new Error("Geocode failed");
    }
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) {
        throw new Error("No results");
    }
    const parts = [result.name];
    if (result.admin1) {
        parts.push(result.admin1);
    }
    if (result.country_code && result.country_code !== "US") {
        parts.push(result.country);
    }
    return {
        name: parts.join(", "),
        lat: result.latitude,
        lon: result.longitude,
        zipCode: ""
    };
}

async function geocodeZipViaLlm(zip) {
    const zip5 = normalizeZip(zip);
    const message = `The query "${zip5}" is a US ZIP code. Return ONLY valid JSON with the city name, state abbreviation, latitude and longitude: {"name":"City, ST ${zip5}","lat":0.0,"lon":0.0}`;
    const parsed = await sendLlmRequest(message);
    if (!parsed?.name || parsed.lat == null || parsed.lon == null) {
        throw new Error("Invalid geocode response");
    }
    return {
        name: parsed.name,
        lat: Number(parsed.lat),
        lon: Number(parsed.lon),
        zipCode: zip5
    };
}

async function geocodeCityViaLlm(query) {
    const message = `Geocode the place "${query}". Return ONLY valid JSON: {"name":"City, Region","lat":0.0,"lon":0.0}`;
    const parsed = await sendLlmRequest(message);
    if (!parsed?.name || parsed.lat == null || parsed.lon == null) {
        throw new Error("Invalid geocode response");
    }
    return {
        name: parsed.name,
        lat: Number(parsed.lat),
        lon: Number(parsed.lon),
        zipCode: ""
    };
}

async function geocode(query) {
    const trimmed = String(query).trim();
    if (!trimmed) {
        throw new Error("Enter a ZIP or city");
    }

    if (isUsZip(trimmed)) {
        try {
            return await geocodeZipViaApi(trimmed);
        } catch (error) {
            console.warn("ZIP API geocode failed", error);
            if (hasPluginHandler()) {
                return await geocodeZipViaLlm(trimmed);
            }
            throw error;
        }
    }

    try {
        return await geocodeCityViaApi(trimmed);
    } catch (error) {
        console.warn("City API geocode failed", error);
        if (hasPluginHandler()) {
            return await geocodeCityViaLlm(trimmed);
        }
        throw error;
    }
}

function buildOpenMeteoUrl() {
    const tempUnitParam = state.units === "imperial" ? "fahrenheit" : "celsius";
    const windUnitParam = state.units === "imperial" ? "mph" : "kmh";
    return `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnitParam}&wind_speed_unit=${windUnitParam}&timezone=auto&forecast_days=5`;
}

async function fetchWeatherFromOpenMeteo() {
    const res = await fetchWithTimeout(buildOpenMeteoUrl(), FETCH_TIMEOUT_MS);
    if (!res.ok) {
        throw new Error("Network error");
    }
    return res.json();
}

function normalizeLlmWeather(parsed) {
    const windUnit = state.units === "imperial" ? "mph" : "km/h";

    if (parsed.temp != null || parsed.condition != null) {
        const weatherCode = conditionTextToCode(parsed.condition);
        const temp = toNumber(parsed.temp);
        if (!Number.isFinite(temp)) {
            throw new Error("Invalid LLM weather temp");
        }
        const humidity = toNumber(parsed.humidity, 0);
        const wind = toNumber(parsed.wind, 0);

        const dailyEntries = Array.isArray(parsed.daily) ? parsed.daily.slice(0, 5) : [];
        const dailyTimes = [];
        const dailyMax = [];
        const dailyMin = [];
        const dailyCodes = [];

        const today = new Date();
        today.setHours(12, 0, 0, 0);

        if (dailyEntries.length > 0) {
            dailyEntries.forEach((entry, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() + i);
                dailyTimes.push(d.toISOString());
                dailyMax.push(toNumber(entry.hi ?? entry.max, temp));
                dailyMin.push(toNumber(entry.lo ?? entry.min, temp));
                dailyCodes.push(conditionTextToCode(entry.condition || parsed.condition));
            });
        }

        const now = new Date();
        return {
            current: {
                temperature_2m: temp,
                relative_humidity_2m: humidity,
                weather_code: weatherCode,
                wind_speed_10m: wind
            },
            current_units: {
                wind_speed_10m: windUnit
            },
            hourly: {
                time: [now.toISOString()],
                temperature_2m: [temp],
                weather_code: [weatherCode]
            },
            daily: {
                time: dailyTimes,
                temperature_2m_max: dailyMax,
                temperature_2m_min: dailyMin,
                weather_code: dailyCodes
            }
        };
    }

    const current = parsed.current || {};
    const hourly = parsed.hourly || {};
    const daily = parsed.daily || {};

    const weatherCode = current.weather_code != null
        ? toNumber(current.weather_code, 1)
        : conditionTextToCode(current.condition || parsed.condition);

    const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
    const hourlyTemps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
    const hourlyCodes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];

    const dailyTimes = Array.isArray(daily.time) ? daily.time.slice(0, 5) : [];
    const dailyMax = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max.slice(0, 5) : [];
    const dailyMin = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min.slice(0, 5) : [];
    const dailyCodes = Array.isArray(daily.weather_code) ? daily.weather_code.slice(0, 5) : [];

    const temp = toNumber(current.temperature_2m ?? current.temp ?? parsed.temp);
    if (!Number.isFinite(temp)) {
        throw new Error("Invalid LLM weather temp");
    }

    const now = new Date();
    const resolvedHourly = hourlyTimes.length > 0
        ? { time: hourlyTimes, temperature_2m: hourlyTemps, weather_code: hourlyCodes }
        : { time: [now.toISOString()], temperature_2m: [temp], weather_code: [weatherCode] };

    return {
        current: {
            temperature_2m: temp,
            relative_humidity_2m: toNumber(current.relative_humidity_2m ?? current.humidity ?? parsed.humidity, 0),
            weather_code: weatherCode,
            wind_speed_10m: toNumber(current.wind_speed_10m ?? current.wind ?? parsed.wind, 0)
        },
        current_units: {
            wind_speed_10m: current.wind_unit || windUnit
        },
        hourly: resolvedHourly,
        daily: {
            time: dailyTimes,
            temperature_2m_max: dailyMax,
            temperature_2m_min: dailyMin,
            weather_code: dailyCodes
        }
    };
}

async function fetchWeatherViaLlm() {
    const tempUnit = state.units === "imperial" ? "Fahrenheit" : "Celsius";
    const windUnit = state.units === "imperial" ? "mph" : "km/h";
    const message = `Weather for ${state.cityName} at latitude ${state.lat}, longitude ${state.lon}. Use ${tempUnit} for temperatures and ${windUnit} for wind. Return valid JSON ONLY, no markdown, no explanation. Shape exactly: {"temp":72,"feels":70,"humidity":45,"wind":8,"condition":"clear","daily":[{"day":"Today","hi":80,"lo":62},{"day":"Tomorrow","hi":78,"lo":60}]}. condition must be one of: clear, partly cloudy, cloudy, fog, drizzle, rain, snow, thunderstorm. Up to 5 daily entries with day, hi, lo.`;
    const parsed = await sendLlmRequest(message);
    return normalizeLlmWeather(parsed);
}

async function fetchWeather() {
    if (isFetching) {
        return;
    }
    isFetching = true;

    locationNameEl.textContent = state.cityName;
    tempUnitEl.textContent = state.units === "imperial" ? "°F" : "°C";
    currentConditionEl.textContent = "Fetching forecast";
    statusEl.textContent = "Loading weather";

    try {
        weatherCache = await fetchWeatherFromOpenMeteo();
        renderWeather();
        statusEl.textContent = "Weather updated";
    } catch (error) {
        console.error("Direct weather fetch failed", error);
        if (hasPluginHandler()) {
            currentConditionEl.textContent = "Trying backup…";
            statusEl.textContent = "Open-Meteo failed, using LLM";
            try {
                weatherCache = await fetchWeatherViaLlm();
                renderWeather();
                statusEl.textContent = "Weather updated via LLM";
                isFetching = false;
                return;
            } catch (llmError) {
                console.error("LLM weather failed", llmError);
            }
        }

        weatherCache = null;
        currentConditionEl.textContent = "Can't load forecast";
        statusEl.textContent = "Forecast unavailable";
    } finally {
        isFetching = false;
    }
}

function renderWeather() {
    if (!weatherCache?.current) {
        return;
    }

    const curr = weatherCache.current;
    currentIconEl.innerHTML = getWeatherSvg(curr.weather_code);
    currentTempEl.textContent = `${Math.round(curr.temperature_2m)}°`;
    currentConditionEl.textContent = getWeatherText(curr.weather_code);
    detailHumidityEl.textContent = `H: ${Math.round(curr.relative_humidity_2m)}%`;
    const windUnit = weatherCache.current_units?.wind_speed_10m || (state.units === "imperial" ? "mph" : "km/h");
    detailWindEl.textContent = `W: ${Math.round(curr.wind_speed_10m)} ${windUnit}`;

    const hourly = weatherCache.hourly || { time: [], temperature_2m: [], weather_code: [] };
    const nowIdx = hourly.time.length > 0
        ? hourly.time.findIndex((t) => new Date(t) >= new Date())
        : -1;
    const startIdx = nowIdx === -1 ? 0 : nowIdx;
    let hourlyHtml = "";
    const hourlyCount = hourly.time.length;
    if (hourlyCount === 0) {
        hourlyListEl.innerHTML = "";
    } else {
        for (let i = startIdx; i < Math.min(hourly.time.length, startIdx + 12); i++) {
            const timeStr = new Date(hourly.time[i]).toLocaleTimeString([], { hour: "numeric", hour12: true });
            const temp = Math.round(hourly.temperature_2m[i]);
            const svgIcon = getWeatherSvg(hourly.weather_code[i]);
            hourlyHtml += `
            <div class="hourly-item">
                <span class="hourly-time">${timeStr}</span>
                <span class="hourly-icon">${svgIcon}</span>
                <span class="hourly-temp">${temp}°</span>
            </div>
        `;
        }
        hourlyListEl.innerHTML = hourlyHtml;
    }

    const daily = weatherCache.daily || { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] };
    let dailyHtml = "";
    const daysToShow = Math.min(5, daily.time.length);
    for (let i = 0; i < daysToShow; i++) {
        const d = new Date(daily.time[i]);
        const dayName = i === 0 ? "Today" : d.toLocaleDateString([], { weekday: "short" });
        const maxT = Math.round(daily.temperature_2m_max[i]);
        const minT = Math.round(daily.temperature_2m_min[i]);
        const svgIcon = getWeatherSvg(daily.weather_code[i]);
        dailyHtml += `
            <div class="daily-item">
                <span class="daily-day">${dayName}</span>
                <span class="daily-icon">${svgIcon}</span>
                <span class="daily-temps"><span>${maxT}°</span><span>${minT}°</span></span>
            </div>
        `;
    }
    dailyListEl.innerHTML = dailyHtml;
}

function setView(index) {
    state.currentViewIndex = (index + views.length) % views.length;

    views.forEach((viewId, idx) => {
        const el = document.getElementById(viewId);
        el.classList.toggle("active", idx === state.currentViewIndex);
    });

    dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === state.currentViewIndex);
    });

    appEl.classList.toggle("location-open", state.currentViewIndex === 3);

    const viewNames = ["Current Weather", "Hourly Forecast", "5-Day Forecast", "Location"];
    statusEl.textContent = `Switched to ${viewNames[state.currentViewIndex]}`;
}

async function applyLocation(result) {
    state.lat = result.lat;
    state.lon = result.lon;
    state.cityName = result.name;
    state.zipCode = result.zipCode || "";
    zipDigits = state.zipCode;
    renderZipDisplay();
    locationNameEl.textContent = state.cityName;
    setLocationStatus(`Set to ${state.cityName}`, false);
    await saveStoredState();
    setView(0);
    await fetchWeather();
}

async function submitZip() {
    if (zipDigits.length !== ZIP_LENGTH) {
        setLocationStatus("Enter a 5-digit ZIP", true);
        return;
    }
    setLocationStatus("Looking up ZIP...", false);
    try {
        const result = await geocode(zipDigits);
        await applyLocation(result);
    } catch (error) {
        console.error("ZIP geocode failed", error);
        setLocationStatus("ZIP lookup failed. Try again.", true);
    }
}

async function submitCity() {
    const query = cityInputEl.value.trim();
    if (!query) {
        setLocationStatus("Enter a city name", true);
        return;
    }
    setLocationStatus("Looking up city...", false);
    try {
        const result = await geocode(query);
        await applyLocation(result);
    } catch (error) {
        console.error("City geocode failed", error);
        setLocationStatus("City lookup failed. Try again.", true);
    }
}

function onPadDigit(digit) {
    if (zipDigits.length >= ZIP_LENGTH) {
        return;
    }
    zipDigits += digit;
    renderZipDisplay();
    setLocationStatus("", false);
    if (zipDigits.length === ZIP_LENGTH) {
        submitZip();
    }
}

function onPadBackspace() {
    zipDigits = zipDigits.slice(0, -1);
    renderZipDisplay();
    setLocationStatus("", false);
}

function initializeZipPad() {
    zipPadEl.addEventListener("click", (event) => {
        event.stopPropagation();
        const button = event.target.closest(".pad-key");
        if (!button) {
            return;
        }

        const digit = button.dataset.digit;
        const action = button.dataset.action;
        if (digit != null) {
            onPadDigit(digit);
            return;
        }
        if (action === "back") {
            onPadBackspace();
            return;
        }
        if (action === "set") {
            submitZip();
        }
    });
}

function initializeBrowserCityInput() {
    if (!hasPluginHandler()) {
        browserCityRowEl.classList.remove("hidden");
    }

    citySetBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        submitCity();
    });

    cityInputEl.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
            event.preventDefault();
            submitCity();
        }
    });
}

function initializeHardware() {
    window.addEventListener("scrollUp", () => {
        setView(state.currentViewIndex - 1);
    });

    window.addEventListener("scrollDown", () => {
        setView(state.currentViewIndex + 1);
    });

    window.addEventListener("sideClick", () => {
        const now = Date.now();
        if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) {
            return;
        }
        lastSideClickAt = now;

        state.units = state.units === "imperial" ? "metric" : "imperial";
        saveStoredState();
        fetchWeather();
        statusEl.textContent = `Switched to ${state.units} units`;
    });
}

function initializeFallbackInput() {
    document.addEventListener("click", (event) => {
        if (event.target.closest(".zip-pad, .browser-city-row, .location-input, .city-set-btn")) {
            return;
        }
        setView(state.currentViewIndex + 1);
    });
}

async function init() {
    await loadStoredState();
    resetZipDigits();
    initializeZipPad();
    initializeBrowserCityInput();
    initializeHardware();
    initializeFallbackInput();
    await fetchWeather();
}

init();
