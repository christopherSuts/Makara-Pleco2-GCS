"use client";

import { useMemo, useState, useEffect } from "react";

export default function EchosounderPanel({ telemetry }) {
  // State untuk menyimpan history depth untuk efek scrolling
  const [depthHistory, setDepthHistory] = useState([]);
  const MAX_HISTORY = 50; // Jumlah data points untuk ditampilkan

  // Get depth from DISTANCE_SENSOR or RANGEFINDER
  const distanceSensor = telemetry?.DISTANCE_SENSOR?.payload;
  const rangefinder = telemetry?.RANGEFINDER?.payload;

  // Prioritas: DISTANCE_SENSOR (modern) > RANGEFINDER (legacy)
  const currentDepth = distanceSensor?.current_distance ?? rangefinder?.distance ?? 0;

  // Update history ketika ada data baru
  useEffect(() => {
    if (currentDepth !== undefined && currentDepth !== null) {
      setDepthHistory(prev => {
        const newHistory = [...prev, currentDepth];
        // Batasi jumlah history
        if (newHistory.length > MAX_HISTORY) {
          return newHistory.slice(-MAX_HISTORY);
        }
        return newHistory;
      });
    }
  }, [currentDepth]);

  // Lat/Lon from Global Position
  const pos = telemetry?.GLOBAL_POSITION_INT?.payload;
  const lat = pos?.lat ? pos.lat.toFixed(6) : "–";
  const lon = pos?.lon ? pos.lon.toFixed(6) : "–";

  // Range settings: 0m (bottom) to 100m (top)
  const MIN_DEPTH = 0;
  const MAX_DEPTH = 100;

  // Function to get color based on depth (RGB gradient)
  // Red (close/dangerous) -> Yellow -> Green (far/safe)
  const getDepthColor = (depth) => {
    // Clamp depth to range
    const clampedDepth = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, depth));

    // Normalize to 0-1 range
    const normalized = clampedDepth / MAX_DEPTH;

    // Color gradient:
    // 0-30m: Red (255,0,0) -> Yellow (255,255,0) - DANGER
    // 30-60m: Yellow (255,255,0) -> Light Green (128,255,0) - CAUTION
    // 60-100m: Light Green (128,255,0) -> Green (0,255,0) - SAFE

    let r, g, b;

    if (normalized < 0.3) {
      // Red to Yellow (0-30m)
      const t = normalized / 0.3;
      r = 255;
      g = Math.round(255 * t);
      b = 0;
    } else if (normalized < 0.6) {
      // Yellow to Light Green (30-60m)
      const t = (normalized - 0.3) / 0.3;
      r = Math.round(255 * (1 - t));
      g = 255;
      b = 0;
    } else {
      // Light Green to Green (60-100m)
      const t = (normalized - 0.6) / 0.4;
      r = 0;
      g = 255;
      b = Math.round(100 * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculate position for current depth indicator
  const getDepthPosition = (depth) => {
    const clampedDepth = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, depth));
    // Position from bottom (0m at bottom, 100m at top)
    return ((clampedDepth / MAX_DEPTH) * 100).toFixed(1);
  };

  const depthColor = getDepthColor(currentDepth);
  const depthPosition = getDepthPosition(currentDepth);

  return (
    <div className="bg-amv-grey/90 border border-white/10 rounded-2xl p-3 shadow-xl h-full flex flex-col items-center relative backdrop-blur-md">
      <h3 className="text-sm font-bold text-center text-amv-white mb-2 w-full shrink-0 uppercase tracking-wider">Echogram</h3>

      {/* Visual Bar Container */}
      <div className="flex-1 w-full flex items-center justify-center gap-3 min-h-0 overflow-hidden px-2">

        {/* Depth Scale */}
        <div className="flex flex-col justify-between h-full text-[10px] text-amv-white/60 font-mono">
          <span>100m</span>
          <span>75m</span>
          <span>50m</span>
          <span>25m</span>
          <span>0m</span>
        </div>

        {/* Main Depth Bar with Gradient Background */}
        <div className="relative flex-1 h-full max-w-[80px] bg-gradient-to-b from-green-500 via-yellow-500 to-red-500 rounded-lg border-2 border-white/30 overflow-hidden">

          {/* Current Depth Indicator */}
          <div
            className="absolute left-0 right-0 transition-all duration-300 ease-out"
            style={{
              bottom: `${depthPosition}%`,
              height: '4px',
              backgroundColor: 'white',
              boxShadow: `0 0 10px ${depthColor}, 0 0 20px ${depthColor}`,
            }}
          />

          {/* Depth Value Floating Label */}
          <div
            className="absolute left-0 right-0 transition-all duration-300 ease-out flex justify-center"
            style={{
              bottom: `calc(${depthPosition}% + 6px)`,
            }}
          >
            <div
              className="px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-lg"
              style={{
                backgroundColor: depthColor,
              }}
            >
              {currentDepth.toFixed(1)}m
            </div>
          </div>

          {/* History Trail (optional - untuk efek echogram scrolling) */}
          {depthHistory.slice(-20).map((depth, idx) => {
            const opacity = (idx + 1) / 20; // Fade in effect
            const pos = getDepthPosition(depth);
            return (
              <div
                key={`history-${idx}`}
                className="absolute left-0 right-0 transition-all duration-100"
                style={{
                  bottom: `${pos}%`,
                  height: '2px',
                  backgroundColor: getDepthColor(depth),
                  opacity: opacity * 0.3,
                }}
              />
            );
          })}
        </div>

        {/* Color Legend */}
        <div className="flex flex-col justify-between h-full text-[9px] text-amv-white/70">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm border border-white/20"></div>
            <span>Safe</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-sm border border-white/20"></div>
            <span>Caution</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-sm border border-white/20"></div>
            <span>Danger</span>
          </div>
        </div>
      </div>

      {/* Data Footer */}
      <div className="w-full mt-2 pt-2 border-t border-white/10 text-xs text-amv-white space-y-0.5 shrink-0">
        <div className="flex justify-between">
          <span className="opacity-60">Depth:</span>
          <span className="font-mono font-bold" style={{ color: depthColor }}>
            {currentDepth.toFixed(1)} m
          </span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Range:</span>
          <span className="font-mono text-[10px]">{MIN_DEPTH}-{MAX_DEPTH}m</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Lat:</span>
          <span className="font-mono text-[10px]">{lat}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">Lon:</span>
          <span className="font-mono text-[10px]">{lon}</span>
        </div>
      </div>
    </div>
  );
}
