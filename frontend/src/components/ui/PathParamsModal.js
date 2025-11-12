"use client";
import { useState, useEffect } from "react";

export default function PathParamsModal({
  open,
  onClose,
  defaults = { rowGapMeters: 5, wpGapMeters: 3 },
  onSubmit, // (rowGapMeters:number, wpGapMeters:number) => void
}) {
  const [rowGap, setRowGap] = useState(defaults.rowGapMeters ?? 5);
  const [wpGap, setWpGap]   = useState(defaults.wpGapMeters ?? 3);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (open) {
      setRowGap(defaults.rowGapMeters ?? 5);
      setWpGap(defaults.wpGapMeters ?? 3);
      setError("");
    }
  }, [open, defaults]);

  if (!open) return null;

  const toFloat = (v) => {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(",", ".")); // support comma decimal
    return n;
  };

  const handleSubmit = () => {
    const rg = toFloat(rowGap);
    const wg = toFloat(wpGap);
    if (!Number.isFinite(rg) || rg <= 0) return setError("Row gap must be a positive number.");
    if (!Number.isFinite(wg) || wg <= 0) return setError("Waypoint gap must be a positive number.");
    onSubmit(rg, wg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white text-black shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/10">
          <h3 className="text-lg font-semibold">Path Settings</h3>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-black/5">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Row gap (meters)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={rowGap}
              onChange={(e) => setRowGap(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-black/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Waypoint gap (meters)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={wpGap}
              onChange={(e) => setWpGap(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-black/10 text-sm"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-black/10 hover:bg-black/5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-md bg-black text-white hover:bg-black/90"
          >
            Use Settings
          </button>
        </div>
      </div>
    </div>
  );
}
