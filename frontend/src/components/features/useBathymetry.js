"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useBathymetry(telemetry) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [bathymetryData, setBathymetryData] = useState([]);
  const intervalRef = useRef(null);
  // Keep latest telemetry in a ref so the recording interval reads fresh data
  // without re-creating itself on every WebSocket tick.
  const telemetryRef = useRef(telemetry);
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setHasStarted(true);
    setBathymetryData([]);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const resetHasStarted = useCallback(() => {
    setHasStarted(false);
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    intervalRef.current = setInterval(() => {
      const t = telemetryRef.current;
      const posData = t?.GLOBAL_POSITION_INT?.payload;
      const depth =
        t?.DISTANCE_SENSOR?.payload?.current_distance ??
        t?.RANGEFINDER?.payload?.distance ??
        null;

      setBathymetryData((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          latitude: posData?.lat ?? null,
          longitude: posData?.lon ?? null,
          depth: depth ?? 0,
        },
      ]);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording]);

  const downloadCSV = useCallback(() => {
    if (bathymetryData.length === 0) return;

    const header = "timestamp,latitude,longitude,depth\n";
    const rows = bathymetryData
      .map((d) => `${d.timestamp},${d.latitude},${d.longitude},${d.depth}`)
      .join("\n");
    const csv = header + rows;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bathymetry-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [bathymetryData]);

  return {
    isRecording,
    hasStarted,
    bathymetryData,
    startRecording,
    stopRecording,
    downloadCSV,
    resetHasStarted,
  };
}
