"use client";

/**
 * /review — Log Playback / Review mode.
 *
 * A NEW mode, fully separate from the live telemetry view (app/page.js). It
 * replays a pre-recorded, already-filtered bathymetry survey CSV — no
 * WebSocket, no useTelemetry, no MAVLink. All state lives in usePlayback.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PlaybackMapWrapper from "@/components/PlaybackMapWrapper";
import { usePlayback } from "@/components/features/usePlayback";
import { depthToColorDynamic } from "@/lib/depthColor";

// Lazy-loaded 3D viewer — three.js/delaunator only download when opened.
const BathymetryModal = dynamic(() => import("@/components/Mapping3DModal"), {
  ssr: false,
});

const SPEEDS = [4, 8, 16, 32];

export default function ReviewPage() {
  const pb = usePlayback();
  const fileRef = useRef(null);
  const [showSurface, setShowSurface] = useState(false); // 2D interpolated overlay
  const [bathyOpen, setBathyOpen] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0); // accepted-confidence threshold (shared 2D/3D)

  // Reset the threshold to the data's minimum whenever a new survey is loaded.
  useEffect(() => {
    setMinConfidence(Math.floor(pb.confidenceRange[0]));
  }, [pb.confidenceRange[0], pb.confidenceRange[1]]);

  // Feed the 3D viewer directly from the loaded CSV (shape: {lat, lon, depth_m}).
  const bathyPoints = useMemo(
    () =>
      pb.rows.map((r) => ({
        lat: r.lat,
        lon: r.lng,
        depth_m: r.depth,
        depth_confidence: r.depth_confidence,
      })),
    [pb.rows]
  );

  // Points for the 2D interpolated overlay ({lat, lng, depth, conf}).
  const surveyPoints = useMemo(
    () =>
      pb.rows.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        depth: r.depth,
        conf: r.depth_confidence,
      })),
    [pb.rows]
  );

  // How many soundings clear the current confidence threshold.
  const acceptedCount = useMemo(
    () =>
      pb.rows.filter(
        (r) => !Number.isFinite(r.depth_confidence) || r.depth_confidence >= minConfidence
      ).length,
    [pb.rows, minConfidence]
  );

  const hasData = pb.total > 0;
  const cur = pb.current;

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) pb.loadFile(file);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-amv-black text-amv-white font-sans">
      {/* Map background */}
      <div className="absolute inset-0 z-0">
        <PlaybackMapWrapper
          segments={pb.segments}
          current={pb.current}
          bounds={pb.bounds}
          depthRange={pb.depthRange}
          points={surveyPoints}
          showSurface={showSurface}
          minConfidence={minConfidence}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-amv-grey/90 backdrop-blur-md border border-white/10 px-3 py-2 shadow-xl">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/15 transition"
            title="Back to live telemetry"
          >
            ← Live
          </Link>
          <span className="text-sm font-bold uppercase tracking-wider text-amv-white/90">
            Review Mode
          </span>
          <span className="text-[11px] text-amv-white/40">Log Playback</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-amv-grey/90 backdrop-blur-md border border-white/10 px-3 py-2 shadow-xl">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onPick}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg px-3 py-1.5 text-xs font-bold bg-amv-maroon text-white border border-amv-maroon hover:bg-amv-maroon/80 transition"
          >
            {hasData ? "Load Another CSV" : "Load Survey CSV"}
          </button>
          {pb.fileName && (
            <span className="text-[11px] font-mono text-amv-white/60 max-w-[220px] truncate">
              {pb.fileName}
            </span>
          )}
        </div>

        {pb.error && (
          <div className="pointer-events-auto rounded-2xl bg-red-500/20 border border-red-500/50 px-3 py-2 text-xs text-red-200 shadow-xl">
            {pb.error}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasData && !pb.error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-2xl bg-amv-grey/90 backdrop-blur-md border border-white/10 px-6 py-5 text-center shadow-xl max-w-sm">
            <div className="text-sm font-bold text-amv-white mb-1">No survey loaded</div>
            <div className="text-xs text-amv-white/60 mb-3">
              Load a filtered bathymetry CSV to replay the survey track. Points are
              segmented by window; gaps are shown as breaks, not connected.
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg px-4 py-2 text-xs font-bold bg-amv-maroon text-white border border-amv-maroon hover:bg-amv-maroon/80 transition"
            >
              Load Survey CSV
            </button>
          </div>
        </div>
      )}

      {/* Bottom control dock */}
      {hasData && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(920px,calc(100vw-24px))]">
          <div className="rounded-2xl bg-amv-grey/90 backdrop-blur-md border border-white/10 px-4 py-3 shadow-xl">
            {/* Readout row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mb-2">
              <Readout label="Time" value={cur?.est_time_jakarta ?? "—"} mono />
              <Readout
                label="Depth"
                value={Number.isFinite(cur?.depth) ? `${cur.depth.toFixed(2)} m` : "—"}
                color={cur ? depthToColorDynamic(cur.depth, pb.depthRange[0], pb.depthRange[1]) : undefined}
              />
              <Readout
                label="Lat, Lng"
                value={cur ? `${cur.lat.toFixed(6)}, ${cur.lng.toFixed(6)}` : "—"}
                mono
              />
              <Readout label="Session" value={cur?.session ?? "—"} mono />
              <Readout label="Window" value={cur?.window_id ?? "—"} mono />
              <Readout label="Sats" value={Number.isFinite(cur?.satellites) ? cur.satellites : "—"} mono />

              {/* Dynamic depth legend: red = min depth → green = max depth */}
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-amv-white/45 font-mono text-[10px]">
                  {pb.depthRange[0].toFixed(1)}m
                </span>
                <span
                  className="h-2 w-24 rounded"
                  style={{
                    background:
                      "linear-gradient(to right, rgb(255,0,0), rgb(255,255,0), rgb(0,255,0))",
                  }}
                />
                <span className="text-amv-white/45 font-mono text-[10px]">
                  {pb.depthRange[1].toFixed(1)}m
                </span>
                <span className="text-amv-white/50 font-mono ml-3">
                  {pb.index + 1} / {pb.total}
                </span>
              </span>
            </div>

            {/* Scrubber */}
            <input
              type="range"
              min={0}
              max={Math.max(0, pb.total - 1)}
              value={pb.index}
              onChange={(e) => pb.seek(e.target.value)}
              className="w-full accent-amv-maroon cursor-pointer"
            />

            {/* Transport controls */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => pb.seek(0)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/15 transition"
                title="Jump to start"
              >
                ⏮
              </button>
              <button
                onClick={pb.isPlaying ? pb.pause : pb.play}
                className="rounded-lg px-4 py-1.5 text-xs font-bold bg-amv-maroon text-white border border-amv-maroon hover:bg-amv-maroon/80 transition min-w-[84px]"
              >
                {pb.isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={() => pb.seek(pb.total - 1)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/15 transition"
                title="Jump to end"
              >
                ⏭
              </button>

              <div className="flex items-center gap-1 ml-2">
                <span className="text-[11px] text-amv-white/50">Speed</span>
                <select
                  value={pb.pointsPerSec}
                  onChange={(e) => pb.setPointsPerSec(Number(e.target.value))}
                  className="rounded-lg bg-amv-black/40 border border-white/15 px-2 py-1 text-xs text-amv-white"
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s} pts/s
                    </option>
                  ))}
                </select>
              </div>

              {/* Confidence filter — the range thumb is the draggable point */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-amv-white/50 whitespace-nowrap">
                  Depth Measurement Confidence ≥ {minConfidence}%
                </span>
                <input
                  type="range"
                  min={Math.floor(pb.confidenceRange[0])}
                  max={100}
                  step={1}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-28 accent-amv-maroon cursor-pointer"
                  title="Minimum accepted depth-measurement confidence"
                />
                <span className="text-[10px] text-amv-white/40 font-mono whitespace-nowrap">
                  {acceptedCount}/{pb.total}
                </span>
              </div>

              <button
                onClick={() => setBathyOpen(true)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold bg-amv-plum/20 hover:bg-amv-plum/30 text-amv-plum border border-amv-plum/50 transition ml-2"
                title="Open the interpolated 3D survey surface"
              >
                3D Surface
              </button>

              <label className="flex items-center gap-1.5 ml-auto text-[11px] text-amv-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSurface}
                  onChange={(e) => setShowSurface(e.target.checked)}
                  className="accent-amv-maroon"
                />
                2D Surface
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3D interpolated survey surface (TIN, masked), fed by the loaded CSV */}
      {bathyOpen && hasData && (
        <BathymetryModal
          open
          onClose={() => setBathyOpen(false)}
          points={bathyPoints}
          title="3D Survey Surface (Review)"
          minConfidence={minConfidence}
          onMinConfidenceChange={setMinConfidence}
          confidenceRange={pb.confidenceRange}
        />
      )}
    </div>
  );
}

function Readout({ label, value, mono = false, color }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-amv-white/45 uppercase tracking-wide text-[10px]">{label}</span>
      <span
        className={`font-bold ${mono ? "font-mono" : ""}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </span>
  );
}
