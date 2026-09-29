/* Pocket Dungeon shared runtime.
 *
 * Small helpers duplicated across the sibling apps in this repo: base64/UTF-8
 * coercion for the R1 storage bridge, and SDK feature detection. Loaded before
 * the engine so any module can use them; no bundler, no build step.
 */
(function (global) {
    "use strict";

    function hasCreationStorage() {
        return !!(global.creationStorage && global.creationStorage.plain
            && typeof global.creationStorage.plain.getItem === "function");
    }

    function hasPluginHandler() {
        // PluginMessageHandler is injected as a bare global by the R1 SDK.
        return typeof PluginMessageHandler !== "undefined" && !!PluginMessageHandler
            && typeof PluginMessageHandler.postMessage === "function";
    }

    function hasNativeEvents() {
        // scrollUp/scrollDown/sideClick/longPressStart are dispatched by the device.
        return typeof global.scrollUp !== "undefined" || typeof global.scrollDown !== "undefined"
            || typeof global.sideClick !== "undefined" || typeof global.longPressStart !== "undefined";
    }

    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = "";
        // Chunked to avoid blowing the argument limit on large payloads.
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
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

    /* Persist a JSON payload: R1 creationStorage (base64) first, localStorage as
     * the always-available mirror. Never throws; both paths are best-effort. */
    async function saveJson(key, payload, encode) {
        try {
            if (hasCreationStorage()) {
                const value = encode ? encode(payload) : payload;
                await global.creationStorage.plain.setItem(key, value);
            }
        } catch (error) {
            console.warn("creationStorage write failed", error);
        }
        try {
            global.localStorage.setItem(key, payload);
        } catch (error) {
            console.warn("localStorage write failed", error);
        }
    }

    /* Load a JSON payload, tolerating both the base64 and plain encodings. */
    async function loadJson(key, decode) {
        if (hasCreationStorage()) {
            try {
                const stored = await global.creationStorage.plain.getItem(key);
                if (stored) {
                    if (decode) {
                        try {
                            return JSON.parse(decode(stored));
                        } catch (error) {
                            return JSON.parse(stored);
                        }
                    }
                    return JSON.parse(stored);
                }
            } catch (error) {
                console.warn("creationStorage read failed", error);
            }
        }
        try {
            const stored = global.localStorage.getItem(key);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn("localStorage read failed", error);
        }
        return null;
    }

    global.PDRuntime = {
        hasCreationStorage: hasCreationStorage,
        hasPluginHandler: hasPluginHandler,
        hasNativeEvents: hasNativeEvents,
        utf8ToBase64: utf8ToBase64,
        base64ToUtf8: base64ToUtf8,
        saveJson: saveJson,
        loadJson: loadJson
    };
})(typeof window !== "undefined" ? window : global);
