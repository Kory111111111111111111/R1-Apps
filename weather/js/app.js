const STORAGE_KEY = "weatherState";
const SIDE_CLICK_DEBOUNCE_MS = 120;

let state = {
    lat: 40.7128,
    lon: -74.0060,
    cityName: "New York",
    units: "imperial", // 'imperial' (°F, mph) or 'metric' (°C, km/h)
    currentViewIndex: 0 // 0: Current, 1: Hourly, 2: Daily (5-Day)
};

const views = ["viewCurrent", "viewHourly", "viewDaily"];
let lastSideClickAt = 0;
let weatherCache = null;

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

// SVG Weather Icons Generator
function getWeatherSvg(code) {
    // WMO Weather codes -> SVG graphics
    switch (code) {
        case 0: // Clear sky
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
        case 3: // Partly cloudy / Cloudy
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>`;
        case 45:
        case 48: // Fog
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
        case 82: // Rain
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
        case 86: // Snow
            return `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
                    <line x1="8" y1="18" x2="8" y2="18.01"></line>
                    <line x1="12" y1="18" x2="12" y2="18.01"></line>
                    <line x1="16" y1="18" x2="16" y2="18.01"></line>
                </svg>`;
        case 95:
        case 96:
        case 99: // Thunderstorm
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

// Load saved state
async function loadStoredState() {
    try {
        if (window.creationStorage?.plain) {
            const raw = await window.creationStorage.plain.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(atob(raw));
                state = { ...state, ...parsed };
            }
        } else {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                state = { ...state, ...JSON.parse(raw) };
            }
        }
    } catch (e) {
        console.warn("Failed to load state", e);
    }
}

async function saveStoredState() {
    try {
        const payload = btoa(JSON.stringify(state));
        if (window.creationStorage?.plain) {
            await window.creationStorage.plain.setItem(STORAGE_KEY, payload);
        } else {
            localStorage.setItem(STORAGE_KEY, payload);
        }
    } catch (e) {
        console.warn("Failed to save state", e);
    }
}

// Fetch Weather Data from Open-Meteo
async function fetchWeather() {
    locationNameEl.textContent = state.cityName;
    tempUnitEl.textContent = state.units === "imperial" ? "°F" : "°C";

    const tempUnitParam = state.units === "imperial" ? "fahrenheit" : "celsius";
    const windUnitParam = state.units === "imperial" ? "mph" : "kmh";

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,time&daily=weather_code,temperature_2m_max,temperature_2m_min,time&temperature_unit=${tempUnitParam}&wind_speed_unit=${windUnitParam}&timezone=auto`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");
        weatherCache = await res.json();
        renderWeather();
    } catch (e) {
        console.error("Weather fetch failed", e);
        currentConditionEl.textContent = "Offline / Error";
        statusEl.textContent = "Failed to load weather data.";
    }
}

function renderWeather() {
    if (!weatherCache) return;

    const curr = weatherCache.current;
    currentIconEl.innerHTML = getWeatherSvg(curr.weather_code);
    currentTempEl.textContent = `${Math.round(curr.temperature_2m)}°`;
    currentConditionEl.textContent = getWeatherText(curr.weather_code);
    detailHumidityEl.textContent = `H: ${curr.relative_humidity_2m}%`;
    detailWindEl.textContent = `W: ${Math.round(curr.wind_speed_10m)} ${weatherCache.current_units.wind_speed_10m}`;

    // Render Hourly (next 12 hours)
    const nowIdx = weatherCache.hourly.time.findIndex(t => new Date(t) >= new Date()) || 0;
    let hourlyHtml = "";
    for (let i = Math.max(0, nowIdx); i < Math.min(weatherCache.hourly.time.length, nowIdx + 12); i++) {
        const timeStr = new Date(weatherCache.hourly.time[i]).toLocaleTimeString([], { hour: 'numeric', hour12: true });
        const temp = Math.round(weatherCache.hourly.temperature_2m[i]);
        const svgIcon = getWeatherSvg(weatherCache.hourly.weather_code[i]);
        hourlyHtml += `
            <div class="hourly-item">
                <span class="hourly-time">${timeStr}</span>
                <span class="hourly-icon">${svgIcon}</span>
                <span class="hourly-temp">${temp}°</span>
            </div>
        `;
    }
    hourlyListEl.innerHTML = hourlyHtml;

    // Render 5-Day Forecast
    let dailyHtml = "";
    const daysToShow = Math.min(5, weatherCache.daily?.time?.length || 0);
    for (let i = 0; i < daysToShow; i++) {
        const d = new Date(weatherCache.daily.time[i]);
        const dayName = i === 0 ? "Today" : d.toLocaleDateString([], { weekday: 'short' });
        const maxT = Math.round(weatherCache.daily.temperature_2m_max[i]);
        const minT = Math.round(weatherCache.daily.temperature_2m_min[i]);
        const svgIcon = getWeatherSvg(weatherCache.daily.weather_code[i]);
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

// Switch Views
function setView(index) {
    state.currentViewIndex = (index + views.length) % views.length;
    
    views.forEach((vId, idx) => {
        const el = document.getElementById(vId);
        if (idx === state.currentViewIndex) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });

    dots.forEach((dot, idx) => {
        if (idx === state.currentViewIndex) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });

    const viewNames = ["Current Weather", "Hourly Forecast", "5-Day Forecast"];
    statusEl.textContent = `Switched to ${viewNames[state.currentViewIndex]}`;
}

// Hardware Event Listeners
window.addEventListener("scrollUp", () => {
    setView(state.currentViewIndex - 1);
});

window.addEventListener("scrollDown", () => {
    setView(state.currentViewIndex + 1);
});

window.addEventListener("sideClick", () => {
    const now = Date.now();
    if (now - lastSideClickAt < SIDE_CLICK_DEBOUNCE_MS) return;
    lastSideClickAt = now;

    state.units = state.units === "imperial" ? "metric" : "imperial";
    saveStoredState();
    fetchWeather();
    statusEl.textContent = `Switched to ${state.units} units`;
});

// Click fallback for desktop preview testing
document.addEventListener("click", () => {
    setView(state.currentViewIndex + 1);
});

// Init
async function init() {
    await loadStoredState();
    await fetchWeather();
}

init();
