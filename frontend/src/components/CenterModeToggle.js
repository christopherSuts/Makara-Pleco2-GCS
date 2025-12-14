"use client";
export default function CenterModeToggle({ centerMode, setCenterMode }) {
  const isASV = centerMode === "asv";
  const isGCS = centerMode === "gcs";
  const isFree = centerMode === "free";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setCenterMode("asv")}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-md transition-all
          ${isASV ? "bg-amv-maroon text-white ring-1 ring-white/20" : "bg-amv-grey/90 text-amv-white/70 border border-white/10 hover:bg-amv-grey hover:text-amv-white"}`}
        title="Center map on ASV"
      >
        ASV
      </button>
      <button
        onClick={() => setCenterMode("gcs")}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-md transition-all
          ${isGCS ? "bg-amv-maroon text-white ring-1 ring-white/20" : "bg-amv-grey/90 text-amv-white/70 border border-white/10 hover:bg-amv-grey hover:text-amv-white"}`}
        title="Center map on GCS"
      >
        GCS
      </button>
      <button
        onClick={() => setCenterMode("free")}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-md transition-all
          ${isFree ? "bg-amv-maroon text-white ring-1 ring-white/20" : "bg-amv-grey/90 text-amv-white/70 border border-white/10 hover:bg-amv-grey hover:text-amv-white"}`}
        title="Free pan/zoom"
      >
        Free
      </button>
    </div>
  );
}
