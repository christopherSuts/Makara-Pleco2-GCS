"use client";
import React from "react";

const RAD2DEG = 180 / Math.PI;

function gpsFixLabel(fixType) {
  switch (Number(fixType)) {
    case 0: return "NO GPS";
    case 1: return "NO FIX";
    case 2: return "2D";
    case 3: return "3D";
    case 4: return "DGPS";
    case 5: return "RTK Float";
    case 6: return "RTK Fixed";
    default: return String(fixType ?? "–");
  }
}

// Reusable label component - scaled up
function LabelValue({ label, value, suffix = "" }) {
  return (
    <div className="flex flex-col items-center mt-2">
      <span className="text-xs font-bold text-amv-white/60 uppercase tracking-wider">{label}</span>
      <span className="text-[14px] font-mono text-lg font-bold text-amv-white">
        {value == null ? "–" : `${value}${suffix}`}
      </span>
    </div>
  );
}

export default function YawPitchRollPanel({ telemetry }) {
  const gpsRaw = telemetry?.GPS_RAW_INT?.payload || telemetry?.GPS2_RAW?.payload || null;
  const satCount = Number.isFinite(gpsRaw?.satellites_visible) ? gpsRaw.satellites_visible : null;
  const fixText = gpsFixLabel(gpsRaw?.fix_type);

  const att = telemetry?.ATTITUDE?.payload || null;
  const rollDeg = Number.isFinite(att?.roll) ? att.roll * RAD2DEG : 0;
  const pitchDeg = Number.isFinite(att?.pitch) ? att.pitch * RAD2DEG : 0;
  const yawDeg = Number.isFinite(att?.yaw) ? att.yaw * RAD2DEG : 0;

  // Display values (fixed decimals)
  const rollDisp = Number.isFinite(att?.roll) ? rollDeg.toFixed(1) : null;
  const pitchDisp = Number.isFinite(att?.pitch) ? pitchDeg.toFixed(1) : null;
  const yawDisp = Number.isFinite(att?.yaw) ? (yawDeg < 0 ? yawDeg+360 : yawDeg).toFixed(0) : null;

  // Continuous rotation logic to prevent flip at 180/-180 boundary
  const continuousYawRef = React.useRef(yawDeg);
  const previousInputYawRef = React.useRef(yawDeg);

  // Calculate delta only if input changed
  if (yawDeg !== previousInputYawRef.current) {
      let delta = yawDeg - previousInputYawRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      
      continuousYawRef.current += delta;
      previousInputYawRef.current = yawDeg;
  }

  const continuousYaw = continuousYawRef.current;

  return (
    <div className="h-full flex flex-col bg-amv-grey/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
      {/* Top Bar: GPS Info */}
      <div className="mb-4 shrink-0 bg-amv-black/40 text-amv-white border border-white/10 rounded-xl px-4 py-2 text-sm flex justify-between items-center shadow-inner">
        <div>
          <span className="font-bold mr-2 text-amv-white/70">Fix:</span>
          <span className="font-mono font-bold">{fixText}</span>
        </div>
         {/* Vertical separator */}
         <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
        <div>
          <span className="font-bold mr-2 text-amv-white/70">Sat:</span>
          <span className="font-mono font-bold">{satCount ?? "–"}</span>
        </div>
      </div>

      {/* Indicators Row */}
      <div className="flex-1 flex items-center justify-between gap-4 min-h-0">
        
        {/* YAW: Compass - Scaled Up (50%) */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-[90px]">
          <div className="relative w-20 h-20 rounded-full border-[3px] border-white/10 bg-amv-black/50 flex items-center justify-center shadow-inner overflow-hidden">
            {/* North Marker */}
            <div className="absolute top-1 text-[9px] font-bold text-yellow-400">N</div>
            <div className="absolute bottom-1 text-[9px] font-bold text-white/30">S</div>
            <div className="absolute left-1 text-[9px] font-bold text-white/30">W</div>
            <div className="absolute right-1 text-[9px] font-bold text-white/30">E</div>
            
            {/* Rotating Arrow */}
            <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out will-change-transform"
                style={{ transform: `rotate(${continuousYaw}deg)` }}
            >
               <svg viewBox="0 0 24 24" className="w-10 h-10 drop-shadow-md">
                 <path d="M12 3 L20 22 L12 17 L4 22 Z" fill="#ef4444" stroke="none" />
               </svg>
            </div>
          </div>
          <LabelValue label="Yaw" value={yawDisp} suffix="°" />
        </div>

        {/* PITCH: Artificial Horizon - Scaled Up (50%) */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-[90px]">
          <div className="relative w-20 h-20 rounded-xl border-[3px] border-white/10 bg-amv-black/50 overflow-hidden shadow-inner">
             {/* Horizon Container */}
             <div 
               className="w-[300%] h-[300%] absolute left-[-100%] transition-transform duration-300 ease-out will-change-transform"
               style={{ 
                   top: "-100%",
                   transform: `translateY(${pitchDeg * 2.5}px) rotate(${-rollDeg}deg)` // Scaled sensitivity
               }}
             >
                <div className="h-1/2 bg-[#38bdf8] border-b border-white relative">
                    <div className="absolute bottom-5 w-full border-t border-white/20 flex justify-center"><span className="text-[7px] text-white bg-slate-800/20 px-1 rounded">10</span></div>
                </div>
                <div className="h-1/2 bg-[#65a30d]">
                    <div className="absolute top-5 w-full border-b border-white/20 flex justify-center"><span className="text-[7px] text-white bg-slate-800/20 px-1 rounded">10</span></div>
                </div>
             </div>

             {/* Center Reference */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-10 h-[2px] bg-yellow-400 shadow-[0_0_2px_black]"></div>
                 <div className="absolute w-3 h-1.5 border-b-[3px] border-l-[3px] border-r-[3px] border-red-500 border-t-0"></div> 
             </div>
          </div>
          <LabelValue label="Pitch" value={pitchDisp} suffix="°" />
        </div>

        {/* ROLL: Rolling Boat - Scaled Up (50%) */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-[90px]">
          <div className="relative w-20 h-20 rounded-full border-[3px] border-white/10 bg-amv-black/50 flex items-center justify-center shadow-inner overflow-hidden">
             {/* Bank Index Marks */}
             <div className="absolute top-1 w-1 h-2 bg-yellow-500"></div>
             <div className="absolute bottom-1 w-1 h-2 bg-white/30"></div>
             <div className="absolute left-1 w-2 h-1 bg-white/30"></div>
             <div className="absolute right-1 w-2 h-1 bg-white/30"></div>

             {/* Rotating Boat */}
             <div 
                className="transition-transform duration-300 ease-out will-change-transform"
                style={{ transform: `rotate(${rollDeg}deg)` }}
             >
                <svg viewBox="0 0 64 64" className="w-14 h-14 drop-shadow-lg">
                   <path d="M10 40 Q 32 55, 54 40 Z" fill="#38BDF8" opacity="0.5" />
                   <path d="M16 36 L20 48 L44 48 L48 36 Z" fill="#ef4444" stroke="white" strokeWidth="2" />
                   <rect x="30" y="20" width="4" height="18" fill="white" />
                   <path d="M20 36 L32 20 L44 36" fill="none" stroke="white" strokeWidth="2" />
                </svg>
             </div>
          </div>
          <LabelValue label="Roll" value={rollDisp} suffix="°" />
        </div>

      </div>
    </div>
  );
}
