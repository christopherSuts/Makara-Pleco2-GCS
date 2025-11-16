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
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <div>
        <div className="text-sm font-semibold mb-1">ArduPilot Messages</div>
        <Box>
          {ap.map((l, i) => (
            <div key={i}>
              <span className="text-black/60">{l.ts}</span>{" "}
              <span className="px-1 rounded bg-black/5">{sevName(l.sev)}</span>{" "}
              <span>{l.text}</span>
            </div>
          ))}
        </Box>
      </div>
      <div>
        <div className="text-sm font-semibold mb-1">WebSocket / Backend</div>
        <Box>
          {ws.map((l, i) => (
            <div key={i}>
              <span className="text-black/60">{l.ts}</span>{" "}
              <span className="px-1 rounded bg-black/5">{l.level}</span>{" "}
              <span>{l.text}</span>
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}
