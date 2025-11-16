"use client";
export default function CenterModeToggle({ centerMode, setCenterMode }) {
  const isASV = centerMode === "asv";
  const isGCS = centerMode === "gcs";
  const isFree = centerMode === "free";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setCenterMode("asv")}
        className={`px-3 py-1.5 rounded-md text-sm shadow
          ${isASV ? "bg-black text-white" : "bg-white/90 text-black border border-black/10"}`}
        title="Center map on ASV"
      >
        ASV
      </button>
      <button
        onClick={() => setCenterMode("gcs")}
        className={`px-3 py-1.5 rounded-md text-sm shadow
          ${isGCS ? "bg-black text-white" : "bg-white/90 text-black border border-black/10"}`}
        title="Center map on GCS"
      >
        GCS
      </button>
      <button
        onClick={() => setCenterMode("free")}
        className={`px-3 py-1.5 rounded-md text-sm shadow
          ${isFree ? "bg-black text-white" : "bg-white/90 text-black border border-black/10"}`}
        title="Free pan/zoom"
      >
        Free
      </button>
    </div>
  );
}
