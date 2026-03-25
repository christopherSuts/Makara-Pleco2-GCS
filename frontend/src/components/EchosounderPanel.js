"use client";

export default function EchosounderPanel({ telemetry, isRecording, onStart, onStop, onDownload, depthOverride }) {
  const depth = depthOverride !== undefined ? depthOverride.toFixed(1) : "0.0";

  const pos = telemetry?.GLOBAL_POSITION_INT?.payload;
  const lat = pos?.lat ? (pos.lat / 1e7).toFixed(6) : "–";
  const lon = pos?.lon ? (pos.lon / 1e7).toFixed(6) : "–";

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

      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-1 min-h-0 overflow-hidden">
         <div className="flex-1 w-12 bg-gradient-to-b from-[#ff6b6b] to-[#8b4dff] rounded-lg border border-white/20 relative w-full max-w-[4rem]">
         </div>
         <div className="text-[10px] text-amv-white/60 shrink-0">0m - max</div>
      </div>

      <div className="w-full mt-1 pt-1 border-t border-white/10 text-xs text-amv-white space-y-0.5 shrink-0">
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

      <div className="w-full mt-2 flex gap-2 shrink-0">
        {!isRecording ? (
          <button
            onClick={onStart}
            className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide"
          >
            START
          </button>
        ) : (
          <>
            <button
              onClick={onStop}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide"
            >
              STOP
            </button>
            <button
              onClick={onDownload}
              className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide"
            >
              CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
