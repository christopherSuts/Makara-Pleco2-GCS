"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  getMode,
  setMode,
  getWsUrl,
  getSettings,
  testConnection,
  isElectron,
  isSecureOrigin,
} from "@/lib/connectionConfig";

/**
 * Detect whether Tailscale is routing via the local P2P path (direct)
 * or through a DERP relay by measuring RTT to the middleware /snapshot.
 *
 * Heuristic: RTT < 50ms ≈ local 5 GHz link (P2P direct); otherwise DERP relay.
 */
async function detectTailscaleRoute(settings) {
  const url = `https://${settings.hybridHost}:${settings.hybridPort}/snapshot`;
  try {
    const t0 = performance.now();
    await fetch(url, { mode: "no-cors", cache: "no-store" });
    const rtt = performance.now() - t0;
    if (rtt < 50) return { route: "P2P Direct", rttMs: Math.round(rtt), color: "text-emerald-400" };
    if (rtt < 150) return { route: "P2P / Low Latency", rttMs: Math.round(rtt), color: "text-sky-400" };
    return { route: "DERP Relay", rttMs: Math.round(rtt), color: "text-amber-400" };
  } catch {
    return { route: "Unknown", rttMs: null, color: "text-amv-white/40" };
  }
}

/**
 * Connection mode selector — Hybrid (wss:// via Tailscale) vs Full-Offline
 * (ws:// direct LAN).  Persists selection to localStorage.
 */
export default function ConnectionModeSelector({ isConnected, connectionStatus = "connected", connectionMode }) {
  const isChecking = connectionStatus === "connecting" && !isConnected;
  const [open, setOpen] = useState(false);
  const [mode, setLocalMode] = useState("hybrid");
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({});
  const [tsRoute, setTsRoute] = useState(null); // { route, rttMs, color }

  // Sync from localStorage on mount
  useEffect(() => {
    setLocalMode(getMode());
    setSettings(getSettings());
  }, []);

  // Probe Tailscale route when connected in Hybrid mode
  useEffect(() => {
    if (!isConnected || mode !== "hybrid") {
      setTsRoute(null);
      return;
    }
    const s = getSettings();
    let cancelled = false;
    const probe = async () => {
      const result = await detectTailscaleRoute(s);
      if (!cancelled) setTsRoute(result);
    };
    probe();
    const iv = setInterval(probe, 10000); // re-check every 10s
    return () => { cancelled = true; clearInterval(iv); };
  }, [isConnected, mode]);

  const switchMode = (m) => {
    setLocalMode(m);
    setMode(m);
  };

  const handleTest = async () => {
    const url = getWsUrl(mode);
    setTesting(true);
    const ok = await testConnection(url);
    setTesting(false);
    if (ok) {
      toast.success(`✓ Connected to ${url}`);
    } else {
      toast.error(`✗ Cannot reach ${url}`);
    }
  };

  const offlineBlocked = !isElectron() && isSecureOrigin();
  const wsUrl = getWsUrl(mode);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!e.target.closest("[data-conn-selector]")) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" data-conn-selector>
      {/* Toggle button — uses the AMV theme colors */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
          "border backdrop-blur-md shadow-xl transition-all duration-200",
          "bg-amv-grey/90 text-amv-white border-white/15",
          "hover:border-amv-maroon/50 hover:shadow-amv-maroon/10",
        ].join(" ")}
        title={`Mode: ${mode === "hybrid" ? "Hybrid" : "Full-Offline"} — ${wsUrl}`}
      >
        {/* Status dot: green=connected, amber=checking, red=disconnected */}
        <span
          className={[
            "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-amv-grey",
            isConnected
              ? "bg-emerald-400 ring-emerald-400/40"
              : isChecking
                ? "bg-amber-400 ring-amber-400/40 animate-pulse"
                : "bg-rose-400 ring-rose-400/40 animate-pulse",
          ].join(" ")}
        />
        <span>{mode === "hybrid" ? "Hybrid" : "Local"}</span>
        {/* Tailscale route badge in Hybrid */}
        {mode === "hybrid" && isConnected && tsRoute && (
          <span className={`text-[10px] font-normal ${tsRoute.color}`}>
            {tsRoute.route}
            {tsRoute.rttMs !== null && ` · ${tsRoute.rttMs}ms`}
          </span>
        )}
        {/* Chevron */}
        <svg className={`w-3 h-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-[9999] min-w-80 rounded-2xl border border-white/10 bg-amv-grey/95 text-amv-white shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden animate-[fadeIn_150ms_ease-out]">
          {/* Header */}
          <div className="px-4 py-2 bg-amv-maroon/20 border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-amv-white/85 flex items-center justify-between">
            <span>Connection Mode</span>
            {isConnected ? (
              <span className="text-emerald-400 normal-case tracking-normal">● Connected</span>
            ) : isChecking ? (
              <span className="text-amber-400 normal-case tracking-normal animate-pulse">● Checking…</span>
            ) : (
              <span className="text-rose-400 normal-case tracking-normal animate-pulse">● Disconnected</span>
            )}
          </div>

          <div className="p-3 space-y-2">
            {/* Hybrid option */}
            <button
              onClick={() => switchMode("hybrid")}
              className={[
                "w-full text-left rounded-xl px-3 py-2.5 transition-all",
                "border",
                mode === "hybrid"
                  ? "border-amv-maroon/60 bg-amv-maroon/15"
                  : "border-white/5 bg-white/5 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">🌐 Hybrid</span>
                {mode === "hybrid" && (
                  <span className="text-[10px] bg-amv-maroon/30 text-amv-white/90 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amv-white/55 mt-0.5 font-mono">
                wss://{settings.hybridHost}:{settings.hybridPort}/ws
              </div>
              <div className="text-[10px] text-amv-white/40 mt-0.5">
                Tailscale — auto-selects P2P direct or DERP relay
              </div>
              {/* Tailscale route indicator */}
              {mode === "hybrid" && isConnected && tsRoute && (
                <div className={`text-[10px] mt-1 flex items-center gap-1 ${tsRoute.color}`}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {tsRoute.route}
                  {tsRoute.rttMs !== null && (
                    <span className="text-amv-white/30 ml-1">RTT {tsRoute.rttMs}ms</span>
                  )}
                </div>
              )}
            </button>

            {/* Full-Offline option */}
            <button
              onClick={() => {
                if (offlineBlocked) {
                  toast.warn(
                    "Local (offline) connection requires the desktop app — browsers block ws:// from HTTPS pages."
                  );
                  return;
                }
                switchMode("offline");
              }}
              className={[
                "w-full text-left rounded-xl px-3 py-2.5 transition-all",
                "border",
                mode === "offline"
                  ? "border-amv-maroon/60 bg-amv-maroon/15"
                  : "border-white/5 bg-white/5 hover:bg-white/10",
                offlineBlocked ? "opacity-50" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">📡 Local (offline)</span>
                {mode === "offline" && (
                  <span className="text-[10px] bg-amv-maroon/30 text-amv-white/90 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amv-white/55 mt-0.5 font-mono">
                ws://{settings.offlineHost}:{settings.offlinePort}/ws
              </div>
              <div className="text-[10px] text-amv-white/40 mt-0.5">
                Direct LAN (10.10.10.x) — no Tailscale dependency
              </div>
              {offlineBlocked && (
                <div className="text-[10px] text-amber-400/80 mt-1">
                  ⚠️ Requires the desktop app (mixed-content blocked)
                </div>
              )}
            </button>

            {/* Test connection */}
            <button
              onClick={handleTest}
              disabled={testing}
              className={[
                "w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium",
                "border border-white/10 bg-white/5 hover:bg-white/10 transition-all",
                testing ? "opacity-50 cursor-wait" : "",
              ].join(" ")}
            >
              {testing ? (
                <>
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-amv-white/30 border-t-amv-white animate-spin" />
                  Testing…
                </>
              ) : (
                "🔌 Test Connection"
              )}
            </button>

            {/* Current endpoint */}
            <div className="text-[10px] text-amv-white/35 text-center pt-1 font-mono truncate">
              {wsUrl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
