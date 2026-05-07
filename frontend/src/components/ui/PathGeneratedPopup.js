"use client";

export default function PathGeneratedPopup({
  open,
  pointCount = 0,
  pathLengthMeters = 0,
  onClose,
}) {
  if (!open) return null;

  const meters = Number(pathLengthMeters || 0);
  const km = meters / 1000;
  const speedMps = 5;
  const estimatedSeconds = meters / speedMps;
  const hh = Math.floor(estimatedSeconds / 3600);
  const mm = Math.floor((estimatedSeconds % 3600) / 60);
  const ss = Math.floor(estimatedSeconds % 60);
  const eta = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const etaCompleteDate = new Date(Date.now() + estimatedSeconds * 1000);
  const etaComplete = etaCompleteDate.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="fixed bottom-6 left-24 z-[1200] pointer-events-auto">
      <div className="w-[360px] rounded-2xl border border-cyan-300/50 bg-cyan-950/95 text-cyan-50 shadow-[0_14px_36px_rgba(8,145,178,0.45)] backdrop-blur-md overflow-hidden">
        <div className="px-4 py-1.5 bg-cyan-400/20 border-b border-cyan-200/20 text-[11px] tracking-[0.18em] uppercase text-cyan-100/90">
          Mission Summary
        </div>
        <div className="px-4 py-3 border-b border-cyan-200/20">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold tracking-wide">Path Generated</h3>
            <button
              onClick={onClose}
              className="px-2 py-0.5 rounded hover:bg-white/10 transition"
              aria-label="Close path summary"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-cyan-100/80">Estimated Time:</span>
              <span className="font-mono font-bold">{eta}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyan-100/80">Estimated Complete:</span>
              <span className="font-mono font-bold text-right">{etaComplete}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-900/35 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-cyan-100/70">Waypoints</div>
              <div className="font-mono font-bold text-lg leading-tight">{pointCount}</div>
            </div>
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-900/35 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-cyan-100/70">Distance</div>
              <div className="font-mono font-bold text-lg leading-tight">{km.toFixed(3)} km</div>
              <div className="text-[11px] text-cyan-100/70">{meters.toFixed(1)} m</div>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-200/20 bg-cyan-900/40 px-3 py-3 space-y-2">
            <div className="h-1.5 w-full rounded-full bg-cyan-200/20 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-200" />
            </div>
            <div className="text-[11px] text-cyan-100/75">
              Estimated from current path length.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
