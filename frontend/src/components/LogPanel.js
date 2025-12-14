"use client";
import { useEffect, useRef, useState } from "react";

const MAX_LINES = 400;

function sevName(n) {
  const map = {0:"EMERG",1:"ALERT",2:"CRIT",3:"ERR",4:"WARN",5:"NOTICE",6:"INFO",7:"DEBUG",8:"TRACE",9:"UNKNOWN"};
  return map[Number(n)] ?? String(n ?? "");
}

export default function LogPanel({ telemetry, className = "" }) {
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

  const Box = ({ children }) => (
    <div className="rounded-xl border border-black/15 bg-white/80 p-2 h-40 overflow-auto">
      {/* wrap long lines so we don't create horizontal page scroll */}
      <pre className="m-0 text-[11px] leading-5 font-mono tabular-nums whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );

  return (
    <div className={`flex flex-col gap-2 h-full bg-amv-grey/90 backdrop-blur-md rounded-2xl border border-white/10 p-3 shadow-xl ${className}`}>
      
      {/* ArduPilot Messages */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="text-xs font-bold text-center text-amv-white uppercase tracking-wider mb-1 shrink-0">ArduPilot Messages</div>
        <div className="rounded-xl border border-white/5 bg-amv-black/30 p-1.5 flex-1 overflow-auto min-h-0">
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
         <div className="text-xs font-bold text-center text-amv-white uppercase tracking-wider mb-1 shrink-0">WebSocket / Backend</div>
         <div className="rounded-xl border border-white/5 bg-amv-black/30 p-1.5 flex-1 overflow-auto min-h-0">
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
