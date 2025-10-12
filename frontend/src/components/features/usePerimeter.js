"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const DEMO_BASE = { lat: -6.144353601068162, lng: 106.88533858899994 };

export function usePerimeter() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showStopModal, setShowStopModal] = useState(false);

    const [recordedTrack, setRecordedTrack] = useState([]);

    const [showLoadModal, setShowLoadModal] = useState(false);

    const openLoad = useCallback(() => setShowLoadModal(true), []);
    const closeLoad = useCallback(() => setShowLoadModal(false), []);

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
        setRecordedTrack(normalized);
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
        if (!isRecording) return;             // not recording → no interval
        const id = setInterval(() => {
            if (isPaused) return;             // paused → skip sampling
            // advance synthetic motion
            thetaRef.current += 0.06;
            const rLat = 0.00035 * Math.sin(thetaRef.current); // ~40 m
            const rLng = 0.00045 * Math.cos(thetaRef.current); // ~50 m
            baseRef.current = {
                lat: baseRef.current.lat,
                lng: baseRef.current.lng + 0.00001,            // slow east drift
            };
            const lat = baseRef.current.lat + rLat;
            const lng = baseRef.current.lng + rLng;
            pushSample(lat, lng);
            // lightweight log so you can confirm ticks
            // console.log("tick", lat.toFixed(6), lng.toFixed(6));
        }, 500); // 2 Hz
        return () => clearInterval(id);       // cleanup on stop/pause/unmount
    }, [isRecording, isPaused, pushSample]);

    const start = useCallback(() => {
        setRecordedTrack([]);
        setIsRecording(true);
        setIsPaused(false);
    }, []);

    const pause = useCallback(() => setIsPaused(true), []);
    const play = useCallback(() => setIsPaused(false), []);
    const stop = useCallback(() => setShowStopModal(true), []);

    const dontSaveOrClear = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setRecordedTrack([]);
        setShowStopModal(false);
    }, []);

    const save = useCallback(() => {
        // Here you could also POST to backend instead of client download
        if (recordedTrack.length < 2) {
            alert("No movement to save.");
            return;
        }
        const payload = {
            type: "asv-perimeter-track",
            startedAt: recordedTrack[0]?.t ?? Date.now(),
            endedAt: recordedTrack.at(-1)?.t ?? Date.now(),
            points: recordedTrack, // [{lat,lng,t}]
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `perimeter_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);

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
        perimeterPath: recordedTrack,
    };
}
