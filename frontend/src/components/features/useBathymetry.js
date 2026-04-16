"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useBathymetry(telemetry, depthOverride) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [bathymetryData, setBathymetryData] = useState([]);
  const intervalRef = useRef(null);

  // Prefer RANGEFINDER (simple distance in meters), fall back to DISTANCE_SENSOR (cm converted to meters)
  const rangeData = telemetry?.RANGEFINDER?.payload;
  const distSensorData = telemetry?.DISTANCE_SENSOR?.payload;
  
  let currentDepthValue = 0.0;
  if (rangeData && rangeData.distance !== undefined && rangeData.distance !== null) {
    currentDepthValue = rangeData.distance;
  } else if (distSensorData && distSensorData.distance !== undefined && distSensorData.distance !== null) {
    currentDepthValue = distSensorData.distance;  // Already converted to meters in backend
  } else if (depthOverride !== undefined) {
    currentDepthValue = depthOverride;
  }
  
  const currentDepth = currentDepthValue;

  // Get confidence (signal_quality) from DISTANCE_SENSOR (0-100%)
  const confidence = (() => {
    const distSensorData = telemetry?.DISTANCE_SENSOR?.payload;
    if (distSensorData && distSensorData.signal_quality !== undefined && distSensorData.signal_quality !== null) {
      return distSensorData.signal_quality;
    }
    return null;
  })();

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
        const rangeData = telemetry?.RANGEFINDER?.payload;
        
        // Use real RANGEFINDER data if available, otherwise fall back to override or 0
        let depth = 0.0;
        if (rangeData && rangeData.distance !== undefined && rangeData.distance !== null) {
          depth = rangeData.distance;
        } else if (depthOverride !== undefined) {
          depth = depthOverride;
        }
        
        if (posData) {
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
    currentDepth,
    confidence,
    startRecording,
    stopRecording,
    downloadCSV,
    resetHasStarted,
  };
}
