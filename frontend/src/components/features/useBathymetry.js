"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useBathymetry(telemetry, depthOverride) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [bathymetryData, setBathymetryData] = useState([]);
  const intervalRef = useRef(null);

  
  // const lat = pos?.lat;
  // const lon = pos?.lon;

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
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        const posData = telemetry?.GLOBAL_POSITION_INT?.payload;
        if (posData) {
          const depth = depthOverride !== undefined ? depthOverride : 0.0;
          setBathymetryData((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              latitude: posData.lat,
              longitude: posData.lon,
              depth,
            },
          ]);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording, telemetry, depthOverride]);

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
