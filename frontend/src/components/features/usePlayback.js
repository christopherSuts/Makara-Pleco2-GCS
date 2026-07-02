"use client";

/**
 * usePlayback — client-side log review state for the bathymetry survey replay.
 *
 * Isolated from the live telemetry path: it never touches useTelemetry or the
 * WebSocket. It parses an already-filtered CSV (every row is "valid":
 * gps_fix_type >= 3 AND depth_confidence >= 60) and exposes:
 *   - segments: one per (session|window_id) so the map never draws a line
 *     across a temporal dropout (window_id groups have no gap > 2s).
 *   - rows: all points ordered by est_time_jakarta for the timeline scrubber.
 *   - play/pause/seek: index stepping (points/sec), NOT wall-clock — so the
 *     ~8-minute gap between the two sessions doesn't stall playback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";

/**
 * Robust sort key. est_time_jakarta is a reconstructed wall-clock string (the
 * logger's RTC recorded epoch-1970 times), accurate to ~seconds — good enough
 * to ORDER points. If it isn't parseable, fall back to session order + elapsed
 * seconds so sessions stay separated and internally ordered.
 */
function timeSortKey(row, sessionIndex) {
  const parsed = Date.parse(row.est_time_jakarta);
  if (Number.isFinite(parsed)) return parsed;
  const elapsed = Number(row.elapsed_s_in_session);
  return sessionIndex * 1e9 + (Number.isFinite(elapsed) ? elapsed : 0);
}

export function usePlayback() {
  const [rows, setRows] = useState([]);        // cleaned points, ordered by time
  const [segments, setSegments] = useState([]); // [{ key, session, window_id, points:[{lat,lng,depth}] }]
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pointsPerSec, setPointsPerSec] = useState(8);
  const timerRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const cleaned = (res.data || [])
            .map((r) => ({
              session: r.session,
              window_id: r.window_id,
              est_time_jakarta: r.est_time_jakarta,
              elapsed_s_in_session: Number(r.elapsed_s_in_session),
              lat: Number(r.latitude),
              lng: Number(r.longitude),
              altitude: Number(r.altitude),
              depth: Number(r.depth),
              depth_confidence: Number(r.depth_confidence),
              gps_fix_type: Number(r.gps_fix_type),
              satellites: Number(r.satellites),
              yaw: Number(r.yaw),
              pitch: Number(r.pitch),
              roll: Number(r.roll),
            }))
            // defensive: rows are pre-filtered, but never trust NaN coords
            .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

          if (!cleaned.length) {
            setError("No valid rows found (need numeric latitude/longitude).");
            setRows([]);
            setSegments([]);
            return;
          }

          // Session appearance order → fallback sort tiebreak
          const sessionsSeen = [];
          for (const r of cleaned) {
            if (!sessionsSeen.includes(r.session)) sessionsSeen.push(r.session);
          }
          for (const r of cleaned) {
            r._sortKey = timeSortKey(r, sessionsSeen.indexOf(r.session));
          }

          // Global timeline order (for the scrubber / moving marker)
          cleaned.sort((a, b) => a._sortKey - b._sortKey);

          // Segments keyed by session|window_id, in timeline order. A new
          // (session|window_id) always starts a fresh polyline — this is what
          // prevents fabricating a path across a >2s dropout or the 8-min gap.
          const segMap = new Map();
          const segList = [];
          for (const r of cleaned) {
            const key = `${r.session}|${r.window_id}`;
            let seg = segMap.get(key);
            if (!seg) {
              seg = { key, session: r.session, window_id: r.window_id, points: [] };
              segMap.set(key, seg);
              segList.push(seg);
            }
            seg.points.push({ lat: r.lat, lng: r.lng, depth: r.depth });
          }

          setRows(cleaned);
          setSegments(segList);
          setIndex(0);
          setIsPlaying(false);
        } catch (e) {
          setError(`Parse error: ${e?.message || e}`);
        }
      },
      error: (e) => setError(`CSV read error: ${e?.message || e}`),
    });
  }, []);

  // Index-stepping playback loop (paced by points/sec, not real time).
  useEffect(() => {
    if (!isPlaying || rows.length === 0) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i >= rows.length - 1 ? i : i + 1));
    }, Math.max(20, 1000 / pointsPerSec));
    return () => clearInterval(timerRef.current);
  }, [isPlaying, pointsPerSec, rows.length]);

  // Auto-pause at the end of the timeline.
  useEffect(() => {
    if (isPlaying && rows.length && index >= rows.length - 1) setIsPlaying(false);
  }, [index, isPlaying, rows.length]);

  const play = useCallback(() => {
    if (!rows.length) return;
    setIndex((i) => (i >= rows.length - 1 ? 0 : i)); // restart if at end
    setIsPlaying(true);
  }, [rows.length]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const seek = useCallback(
    (i) => {
      const n = Number(i);
      setIndex(Math.max(0, Math.min(rows.length - 1, Number.isFinite(n) ? n : 0)));
    },
    [rows.length]
  );

  const bounds = useMemo(() => {
    if (!rows.length) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const r of rows) {
      if (r.lat < minLat) minLat = r.lat;
      if (r.lat > maxLat) maxLat = r.lat;
      if (r.lng < minLng) minLng = r.lng;
      if (r.lng > maxLng) maxLng = r.lng;
    }
    return [[minLat, minLng], [maxLat, maxLng]];
  }, [rows]);

  const depthRange = useMemo(() => {
    if (!rows.length) return [0, 100];
    let mn = Infinity, mx = -Infinity;
    for (const r of rows) {
      if (Number.isFinite(r.depth)) {
        if (r.depth < mn) mn = r.depth;
        if (r.depth > mx) mx = r.depth;
      }
    }
    return Number.isFinite(mn) ? [mn, mx] : [0, 100];
  }, [rows]);

  const confidenceRange = useMemo(() => {
    if (!rows.length) return [0, 100];
    let mn = Infinity, mx = -Infinity;
    for (const r of rows) {
      if (Number.isFinite(r.depth_confidence)) {
        if (r.depth_confidence < mn) mn = r.depth_confidence;
        if (r.depth_confidence > mx) mx = r.depth_confidence;
      }
    }
    return Number.isFinite(mn) ? [mn, mx] : [0, 100];
  }, [rows]);

  return {
    loadFile,
    fileName,
    error,
    rows,
    segments,
    bounds,
    depthRange,
    confidenceRange,
    index,
    current: rows[index] || null,
    total: rows.length,
    isPlaying,
    play,
    pause,
    seek,
    pointsPerSec,
    setPointsPerSec,
  };
}
