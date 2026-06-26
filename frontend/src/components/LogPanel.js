"use client";
import { useEffect, useRef, useState } from "react";

const MAX_LINES = 400;

function sevName(n) {
  const map = {0:"EMERG",1:"ALERT",2:"CRIT",3:"ERR",4:"WARN",5:"NOTICE",6:"INFO",7:"DEBUG",8:"TRACE",9:"UNKNOWN"};
  return map[Number(n)] ?? String(n ?? "");
}

export default function LogPanel({ telemetry, isBackendConnected, className = "" }) {
  const [ap, setAp] = useState([]);   // ArduPilot Messages (STATUSTEXT)
  const [ws, setWs] = useState([]);   // Backend / WS status (WS_LOG)
  const lastStatustextRef = useRef(null);
  const lastWsRef = useRef(null);

  // Append on every new STATUSTEXT frame
  useEffect(() => {
    const m = telemetry?.STATUSTEXT;
    if (!m || m === lastStatustextRef.current) return;
    lastStatustextRef.current = m;
    const p = m.payload || {};
    const line = {
      ts: m.server_ts || new Date().toISOString(),
      sev: p.severity,
      text: (p.text || p.message || "").trim(),
    };
    setAp(prev => [...prev, line].slice(-MAX_LINES));
  }, [telemetry?.STATUSTEXT]);

  // Append on every new WS_LOG frame
  useEffect(() => {
    const m = telemetry?.WS_LOG;
    if (!m || m === lastWsRef.current) return;
    lastWsRef.current = m;
    const p = m.payload || {};
    const line = {
      ts: p.ts || m.server_ts || new Date().toISOString(),
      level: (p.level || "info").toUpperCase(),
      text: p.msg || "",
    };
    setWs(prev => [...prev, line].slice(-MAX_LINES));
  }, [telemetry?.WS_LOG]);

  return (
    <div className="bg-amv-grey/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-xl h-full flex flex-col gap-1 overflow-auto">
      
      {/* ArduPilot Messages */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex justify-center items-center gap-2 mb-1 shrink-0 relative">
             <div className="text-xs font-bold text-amv-white uppercase tracking-wider">ArduPilot Messages</div>
        </div>
        <div className={"rounded-xl border border-white/5 bg-amv-black/30 p-1.5 flex-1 overflow-auto min-h-0" + (isBackendConnected ? " opacity-100" : " opacity-40 grayscale pointer-events-none")}>
          <pre className="m-0 text-[11px] leading-5 font-mono tabular-nums whitespace-pre-wrap">
            {ap.map((l, i) => (
                <div key={i} className="border-b border-white/5 last:border-0 pb-0.5 mb-0.5">
                <span className="text-amv-white/50">{l.ts}</span>{" "}
                <span className={`px-1 rounded font-bold ${l.sev <= 4 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-amv-white/80"}`}>{sevName(l.sev)}</span>{" "}
                <span className="text-amv-white/90">{l.text}</span>
                </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-white/10 shrink-0"></div>

      {/* WebSocket / Backend */}
      <div className="flex-1 min-h-0 flex flex-col">
         <div className="flex justify-center items-center gap-2 mb-1 shrink-0 relative">
             <div className="text-xs font-bold text-amv-white uppercase tracking-wider">WebSocket</div>
             <div className={`w-2 h-2 rounded-full ${isBackendConnected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500/50"}`} title={isBackendConnected ? "Telemetry Live" : "No Signal"}></div>
        </div>
         <div className={"rounded-xl border border-white/5 bg-amv-black/30 p-1.5 flex-1 overflow-auto min-h-0" + (isBackendConnected ? " opacity-100" : " opacity-40 grayscale pointer-events-none")}>
          <pre className="m-0 text-[11px] leading-5 font-mono tabular-nums whitespace-pre-wrap">
            {ws.map((l, i) => (
                <div key={i} className="border-b border-white/5 last:border-0 pb-0.5 mb-0.5">
                <span className="text-amv-white/50">{l.ts}</span>{" "}
                <span className="px-1 rounded bg-white/10 text-amv-white/80">{l.level}</span>{" "}
                <span className="text-amv-white/90">{l.text}</span>
                </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
