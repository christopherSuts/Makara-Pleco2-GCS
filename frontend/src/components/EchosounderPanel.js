"use client";

export default function EchosounderPanel({ telemetry }) {
  // Placeholder logic for depth
  const depth = "0.0"; 
  
  // Lat/Lon from Global Position
  const pos = telemetry?.GLOBAL_POSITION_INT?.payload;
  const lat = pos?.lat ? (pos.lat / 1e7).toFixed(6) : "–";
  const lon = pos?.lon ? (pos.lon / 1e7).toFixed(6) : "–";

  return (
    <div className="bg-amv-grey/90 border border-white/10 rounded-2xl p-4 shadow-xl h-full flex flex-col items-center relative backdrop-blur-md">
      <h3 className="text-sm font-bold text-center text-amv-white mb-2 w-full shrink-0 uppercase tracking-wider">Echogram</h3>
      
      {/* Visual Bar */}
      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-2 min-h-0 overflow-hidden">
         <div className="flex-1 w-12 bg-gradient-to-b from-[#ff6b6b] to-[#8b4dff] rounded-lg border border-white/20 relative w-full max-w-[4rem]">
           {/* Graph placeholder */}
         </div>
         <div className="text-[10px] text-amv-white/60 shrink-0">0m - max</div>
      </div>

      {/* Data Footer */}
      <div className="w-full mt-2 pt-2 border-t border-white/10 text-xs text-amv-white space-y-1 shrink-0">
         <div className="flex justify-between">
            <span className="opacity-60">Depth:</span>
            <span className="font-mono font-bold">{depth} m</span>
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
    </div>
  );
}
