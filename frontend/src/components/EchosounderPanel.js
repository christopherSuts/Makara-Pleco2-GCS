"use client";

import { useMemo } from "react";

function depthToColor(depth, maxDepth = 10) {
  const ratio = Math.min(depth / maxDepth, 1);
  const hue = 0 + ratio * 280;
  const saturation = 80;
  const lightness = 50 - ratio * 20;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default function EchosounderPanel({ telemetry, isRecording, onStart, onStop, onDownload, depthOverride, currentDepth, confidence }) {
  const displayDepth = currentDepth !== undefined && currentDepth !== null && currentDepth > 0 
    ? currentDepth 
    : (depthOverride !== undefined ? depthOverride : 0);

  // Format confidence for display
  const displayConfidence = confidence !== null && confidence !== undefined 
    ? `${Math.round(confidence)}%` 
    : "–";

  const pos = telemetry?.GLOBAL_POSITION_INT?.payload;
  const lat = pos?.lat ? (pos.lat / 1e7).toFixed(6) : "–";
  const lon = pos?.lon ? (pos.lon / 1e7).toFixed(6) : "–";

  const maxDisplayDepth = 20;
  const sensorY = 30;
  const bottomY = 90;
  const waterSurfaceY = 20;
  
  const bottomPosition = useMemo(() => {
    const scale = (bottomY - sensorY) / maxDisplayDepth;
    const pixelDepth = Math.min(displayDepth * scale, bottomY - sensorY);
    return sensorY + pixelDepth;
  }, [displayDepth]);

  return (
    <div className="bg-amv-grey/90 border border-white/10 rounded-2xl p-3 shadow-xl h-full flex flex-col items-center relative backdrop-blur-md">
      <h3 className="text-sm font-bold text-center text-amv-white mb-1 w-full shrink-0 uppercase tracking-wider flex items-center justify-center gap-2">
        Echogram
        {isRecording && (
          <span className="flex items-center gap-1 text-xs text-red-400 animate-pulse">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            REC
          </span>
        )}
      </h3>

      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0 overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full max-h-[120px]">
          <defs>
            <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(30, 100, 180, 0.3)" />
              <stop offset="100%" stopColor="rgba(10, 50, 100, 0.5)" />
            </linearGradient>
          </defs>

          <line x1="10" y1={waterSurfaceY} x2="90" y2={waterSurfaceY} stroke="rgba(100, 180, 255, 0.6)" strokeWidth="1" strokeDasharray="4,2" />
          
          <rect x="20" y={waterSurfaceY} width="60" height={bottomY - waterSurfaceY} fill="url(#waterGradient)" opacity="0.3" />

          <path d="M 35 13 L 40 18 L 60 18 L 65 13 Z" fill="rgba(255, 255, 255, 0.8)" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="0.5" />
          <rect x="45" y="8" width="12" height="5" rx="1" fill="rgba(200, 200, 200, 0.9)" />
          <rect x="47" y="9" width="8" height="2" rx="0.5" fill="rgba(100, 150, 200, 0.7)" />

          <rect x="46" y={sensorY} width="8" height="6" rx="1" fill="rgba(255, 255, 255, 0.9)" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="0.5" />
          <line x1="50" y1={sensorY} x2="50" y2="18" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
          <path d={`M 46 ${sensorY + 6} L 40 ${sensorY + 12} L 60 ${sensorY + 12} L 54 ${sensorY + 6} Z`} fill="rgba(100, 200, 255, 0.3)" />

          <line x1="50" y1={sensorY + 6} x2="50" y2={bottomPosition} stroke={depthToColor(displayDepth, maxDisplayDepth)} strokeWidth="1.5" strokeDasharray="3,2" />

          {[5, 10, 15, 20].map((depth) => {
            const y = sensorY + 6 + (depth / maxDisplayDepth) * (bottomY - sensorY - 6);
            return (
              <g key={depth}>
                <line x1="45" y1={y} x2="55" y2={y} stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.5" />
                <text x="42" y={y + 1} fontSize="3" fill="rgba(255, 255, 255, 0.4)" textAnchor="end">{depth}m</text>
              </g>
            );
          })}

          <rect x="15" y={bottomPosition} width="70" height={bottomY - bottomPosition} fill={depthToColor(displayDepth, maxDisplayDepth)} opacity="0.7" />
          <line x1="15" y1={bottomPosition} x2="85" y2={bottomPosition} stroke={depthToColor(displayDepth, maxDisplayDepth)} strokeWidth="1" />

          {[20, 30, 40, 50, 60, 70, 80].map((x) => (
            <path key={x} d={`M ${x} ${bottomPosition} L ${x + 3} ${bottomPosition + 2} L ${x + 6} ${bottomPosition}`} fill="none" stroke="rgba(0, 0, 0, 0.2)" strokeWidth="0.5" />
          ))}

          <text x="75" y={(sensorY + 6 + bottomPosition) / 2} fontSize="6" fill="#000000" textAnchor="middle" fontWeight="bold">
            {displayDepth.toFixed(1)}m
          </text>

          <text x="50" y="5" fontSize="3" fill="rgba(255, 255, 255, 0.6)" textAnchor="middle">ASV</text>
          <text x="50" y={sensorY + 14} fontSize="3" fill="rgba(100, 200, 255, 0.8)" textAnchor="middle">Echo</text>
          <text x="88" y={waterSurfaceY - 2} fontSize="2.5" fill="rgba(100, 180, 255, 0.6)" textAnchor="end">Water</text>
        </svg>
      </div>

      <div className="w-full mt-1 pt-1 border-t border-white/10 text-xs text-amv-white space-y-0.5 shrink-0">
        <div className="flex justify-between">
          <span className="opacity-60">Depth:</span>
          <span className="font-mono font-bold text-black">{displayDepth.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Confidence:</span>
          <span className="font-mono font-bold text-black">{displayConfidence}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Lat:</span>
          <span className="font-mono">{lat}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Lon:</span>
          <span className="font-mono">{lon}</span>
        </div>
      </div>

      <div className="w-full mt-2 flex gap-2 shrink-0">
        {!isRecording ? (
          <button onClick={onStart} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
            START
          </button>
        ) : (
          <>
            <button onClick={onStop} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
              STOP
            </button>
            <button onClick={onDownload} className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
              CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}