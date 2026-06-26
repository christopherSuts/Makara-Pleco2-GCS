"use client";

export default function ControlsPanel({
  onManual,
  onAuto,
  onRTL,
  onSendWP,
  hasPath
}) {
  const btnClass = "p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum text-xs font-semibold flex items-center justify-center";
  const disabledClass = "p-2 rounded-md text-amv-white bg-gray-400 cursor-not-allowed shadow-sm border border-gray-400 text-xs font-semibold flex items-center justify-center";

  return (
    <div className="bg-amv-grey/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-xl h-full flex flex-col items-center gap-2 overflow-auto">
      <h3 className="text-sm font-bold text-center text-amv-white uppercase tracking-wider w-full shrink-0">Controls</h3>

      <div className="w-full grid grid-cols-1 gap-1.5 shrink-0">
        <button onClick={onManual} className="bg-amv-plum/20 hover:bg-amv-plum/30 text-amv-plum border border-amv-plum/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
          Manual
        </button>
        <button onClick={onAuto} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
          Auto
        </button>
        <button onClick={onRTL} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs font-bold transition uppercase tracking-wide">
          RTL
        </button>
      </div>
      
      <div className="w-full h-[1px] bg-white/10 my-0.5 shrink-0"></div>

      <div className="w-full grid grid-cols-1 gap-1.5 shrink-0">
        <button
            onClick={onSendWP} 
            disabled={!hasPath}
            className={`border rounded-lg px-3 py-1.5 text-xs font-bold transition ${hasPath ? 'bg-amv-maroon text-white border-amv-maroon hover:bg-amv-maroon/80' : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'}`}
        >
            Send WP
        </button>
      </div>
    </div>
  );
}
