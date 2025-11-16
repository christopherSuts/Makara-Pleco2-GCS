"use client";
import { useState } from "react";

function validatePathJSON(obj) {
  if (!obj || obj.type !== "asv-path") return "Invalid file type.";
  if (!Array.isArray(obj.points) || obj.points.length < 2) return "Path needs at least 2 points.";
  const bad = obj.points.find(
    (p) => !Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)
  );
  if (bad) return "Each point must have numeric lat/lng.";
  // waypoints are optional; boundaryRef is optional metadata
  return null;
}

export default function LoadPathModal({ open, onClose, onImport }) {
  const [tab, setTab] = useState("offline"); // offline | online
  const [onlineUrl, setOnlineUrl] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleFile = async (file) => {
    setError("");
    try {
      // BOM-safe read
      const buf = await file.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const obj = JSON.parse(text);
      const err = validatePathJSON(obj);
      if (err) { setError(err); return; }
      onImport(obj); // hand off to parent (will call path.load(obj))
    } catch (e) {
      setError(`Failed to read JSON file: ${e?.message || e}`);
    }
  };

  const handleFetch = async () => {
    setError("");
    if (!onlineUrl) { setError("Enter a URL."); return; }
    try {
      const res = await fetch(onlineUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const obj = await res.json();
      const err = validatePathJSON(obj);
      if (err) { setError(err); return; }
      onImport(obj);
    } catch (e) {
      setError("Failed to fetch or parse JSON. (Check CORS/URL.)");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl bg-white text-black shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/10">
          <h3 className="text-lg font-semibold">Load Saved Path</h3>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-black/5">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex rounded-lg border border-black/10 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${tab === "offline" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setTab("offline")}
            >Offline (from file)</button>
            <button
              className={`px-3 py-1.5 text-sm ${tab === "online" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setTab("online")}
            >Online (from URL)</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {tab === "offline" && (
            <div className="space-y-3">
              <p className="text-sm text-black/70">
                Select an <code>.json</code> created by “Save Current Path”.
              </p>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-md file:border file:border-black/10 file:bg-white file:hover:bg-black/5"
              />
            </div>
          )}

          {tab === "online" && (
            <div className="space-y-3">
              <p className="text-sm text-black/70">
                Enter a URL to a path JSON.
              </p>
              <input
                type="url"
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://example.com/paths/abc.json"
                className="w-full px-3 py-2 rounded-md border border-black/10 text-sm"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleFetch}
                  className="px-4 py-2 rounded-md bg-black text-white hover:bg-black/90"
                >
                  Load from URL
                </button>
              </div>
            </div>
          )}

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/10 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-black/10 hover:bg-black/5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
