/**
 * connectionConfig.js — Centralized WebSocket endpoint configuration.
 *
 * Modes:
 *   "hybrid"  → wss://<tailscale-hostname>:<ssl-port>/ws   (default)
 *   "offline" → ws://<lan-ip>:<plain-port>/ws               (desktop-only)
 *
 * Persistence: localStorage in browser, electron-store in Electron.
 */

// Default endpoint values — configurable via environment or settings UI
const DEFAULTS = {
  hybridHost: "amv-onboard.tailc2fe55.ts.net",
  hybridPort: 9000,
  offlineHost: "10.10.10.3",
  offlinePort: 9001,
};

const STORAGE_KEY = "pleco-gcs-connection-mode";
const SETTINGS_KEY = "pleco-gcs-connection-settings";

// ---------------------------------------------------------------------------
//  Runtime detection
// ---------------------------------------------------------------------------

/** True when running inside the Electron shell. */
export function isElectron() {
  return (
    typeof window !== "undefined" &&
    typeof window.IS_ELECTRON !== "undefined" &&
    window.IS_ELECTRON === true
  );
}

/** True when the page was loaded over HTTPS (Vercel / browser). */
export function isSecureOrigin() {
  return (
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
  );
}

// ---------------------------------------------------------------------------
//  Settings persistence (host/port overrides)
// ---------------------------------------------------------------------------

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(partial) {
  try {
    const current = loadSettings();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...current, ...partial })
    );
  } catch {
    /* SSR or private-mode — ignore */
  }
}

export function getSettings() {
  const saved = loadSettings();
  return {
    hybridHost: saved.hybridHost || DEFAULTS.hybridHost,
    hybridPort: saved.hybridPort || DEFAULTS.hybridPort,
    offlineHost: saved.offlineHost || DEFAULTS.offlineHost,
    offlinePort: saved.offlinePort || DEFAULTS.offlinePort,
  };
}

export function updateSettings(partial) {
  saveSettings(partial);
}

// ---------------------------------------------------------------------------
//  Mode persistence
// ---------------------------------------------------------------------------

/** @returns {"hybrid"|"offline"} */
export function getMode() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === "offline" ? "offline" : "hybrid";
  } catch {
    return "hybrid";
  }
}

/** @param {"hybrid"|"offline"} mode */
export function setMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  // Notify useTelemetry (and anyone else) that the mode changed
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("connection-mode-changed", { detail: { mode } }));
  }
}

// ---------------------------------------------------------------------------
//  URL builders
// ---------------------------------------------------------------------------

/** Build the WebSocket URL for the currently selected mode. */
export function getWsUrl(mode) {
  const m = mode || getMode();
  const s = getSettings();
  if (m === "offline") {
    return `ws://${s.offlineHost}:${s.offlinePort}/ws`;
  }
  return `wss://${s.hybridHost}:${s.hybridPort}/ws`;
}

// ---------------------------------------------------------------------------
//  Connection test
// ---------------------------------------------------------------------------

/**
 * Try a WebSocket handshake to the given URL; resolves true on open,
 * false on error/timeout.
 */
export function testConnection(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, timeoutMs);
      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        ws.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
