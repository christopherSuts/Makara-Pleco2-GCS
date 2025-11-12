"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const DEMO_BASE = { lat: -6.144353601068162, lng: 106.88533858899994 };
const MIN_DIST_M = 2;           // only append if moved at least this far
const MIN_INTERVAL_MS = 1000;   // throttle appending to at most once per second

function haversineMeters(a, b) {
  // a,b: {lat, lng}
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function usePerimeter(asvPosition) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showStopModal, setShowStopModal] = useState(false);

    const [recordedTrack, setRecordedTrack] = useState([]);
    const [finalRecordedTrack, setFinalRecordedTrack] = useState([]);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [loadedPerimeterMeta, setLoadedPerimeterMeta] = useState(null);

    const openLoad = useCallback(() => setShowLoadModal(true), []);
    const closeLoad = useCallback(() => setShowLoadModal(false), []);
    const lastAppendTsRef = useRef(0);

    // Accepts the parsed JSON from the modal and updates the track
    const importPerimeterJSON = useCallback((obj) => {
        // normalize: ensure points have lat/lng/t
        const normalized = (obj.points || []).map(p => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            t:  Number(p.t ?? Date.now())
        })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

        if (normalized.length < 2) {
            alert("File loaded, but it doesn't have enough points.");
            return;
        }
        setFinalRecordedTrack(normalized);
        setLoadedPerimeterMeta({
            name: obj.name || "Imported perimeter",
            count: normalized.length,
            startedAt: obj.startedAt ?? null,
            endedAt: obj.endedAt ?? null,
        });
        setIsRecording(false);
        setIsPaused(false);
        setShowStopModal(false);
        setShowLoadModal(false);
    }, []);

    // --- demo movement generator (remove when wiring real telemetry) --- !!!
    // replace with real telemetry feed later
    const baseRef = useRef({ ...DEMO_BASE });
    const thetaRef = useRef(0);
    const pushSample = useCallback((lat, lng) => {
        setRecordedTrack(prev => [...prev, { lat, lng, t: Date.now() }]);
    }, []);

    useEffect(() => {
        if (!isRecording || isPaused) return;
        if (!asvPosition || !asvPosition.payload) return;
        
        const { lat, lon } = asvPosition.payload;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        if (lat === 0 && lon === 0) return;

        const now = Date.now();
        if (now - lastAppendTsRef.current < MIN_INTERVAL_MS) return;

        const nextPt = { lat, lng: lon };

        setRecordedTrack((prev) => {
        if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversineMeters(last, nextPt);
            if (d < MIN_DIST_M) {
            // too close — skip
            return prev;
            }
        }
        lastAppendTsRef.current = now;
        return [...prev, nextPt];
        });
    }, [asvPosition, isRecording, isPaused]);

    const start = useCallback(() => {
        setRecordedTrack([]);
        setIsRecording(true);
        setIsPaused(false);
    }, []);

    // const pause = useCallback(() => setIsPaused(true), []);
    // const play = useCallback(() => setIsPaused(false), []);
    // const stop = useCallback(() => setShowStopModal(true), []);

    const play  = () => { setIsRecording(true);  setIsPaused(false);  };
    const pause = () => { setIsPaused(true); };
    const stop  = () => { setIsRecording(false); setIsPaused(false); setShowStopModal(true);};

    const dontSaveOrClear = useCallback((opts = {}) => {        
        const { clearSaved = false } = opts;
        setIsRecording(false);
        setIsPaused(false);
        setRecordedTrack([]);
        setShowStopModal(false);
        if (clearSaved) {
            setFinalRecordedTrack([]);
            setLoadedPerimeterMeta(null);
        }
    }, []);

    const save = useCallback(() => {
        if (recordedTrack.length < 2) {
            alert("No movement to save.");
            return;
        }

        setFinalRecordedTrack(recordedTrack);
        const payload = {
            type: "asv-perimeter-track",
            startedAt: finalRecordedTrack[0]?.t ?? Date.now(),
            endedAt: finalRecordedTrack.at(-1)?.t ?? Date.now(),
            points: finalRecordedTrack, // [{lat,lng,t}]
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `perimeter_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        setRecordedTrack([]);
        setIsRecording(false);
        setIsPaused(false);
        setShowStopModal(false);
    }, [recordedTrack]);

    // --- API for telemetry hookup later ---
    /** Call this from  real telemetry stream */
    const addTelemetryPoint = useCallback((lat, lng) => {
        if (isRecording && !isPaused) pushSample(lat, lng);
    }, [isRecording, isPaused, pushSample]);

    const cancel = useCallback(() => setShowStopModal(false), []);

    return {
        isRecording, isPaused, showStopModal,
        start, pause, play, stop, cancel, dontSaveOrClear, save,
        recordedTrack, setRecordedTrack,
        addTelemetryPoint, // future real ASV hook
        showLoadModal, openLoad, closeLoad, importPerimeterJSON,
        finalRecordedTrack, loadedPerimeterMeta,
    };
}
