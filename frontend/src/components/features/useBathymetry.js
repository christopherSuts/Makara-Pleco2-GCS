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

    const RAD2DEG = 180 / Math.PI;

    intervalRef.current = setInterval(() => {
      const t = telemetryRef.current;
      const posData = t?.GLOBAL_POSITION_INT?.payload;
      const attData = t?.ATTITUDE?.payload;
      const gpsRaw =
        t?.GPS_RAW_INT?.payload ?? t?.GPS2_RAW?.payload ?? null;
      const distSensor = t?.DISTANCE_SENSOR?.payload;
      const rangefinder = t?.RANGEFINDER?.payload;

      const depth =
        distSensor?.current_distance ?? rangefinder?.distance ?? null;

      // Depth confidence: normalised 0-100 from DISTANCE_SENSOR
      const depthConfidence = distSensor?.confidence ?? null;

      // GPS fix status
      const gpsFixType = gpsRaw?.fix_type ?? null;
      const satellitesVisible = gpsRaw?.satellites_visible ?? null;

      // Attitude in degrees
      const yaw =
        attData?.yaw != null ? attData.yaw * RAD2DEG : null;
      const pitch =
        attData?.pitch != null ? attData.pitch * RAD2DEG : null;
      const roll =
        attData?.roll != null ? attData.roll * RAD2DEG : null;

      // Timestamp: prefer Pixhawk GPS UTC when fix is locked (>= 3D)
      let timestamp;
      const gpsTimeUsec = gpsRaw?.time_usec;
      if (
        gpsTimeUsec &&
        gpsTimeUsec > 0 &&
        gpsFixType != null &&
        gpsFixType >= 3
      ) {
        timestamp = new Date(gpsTimeUsec / 1000).toISOString(); // usec → ms
      } else {
        timestamp = new Date().toISOString(); // Jetson / browser fallback
      }

      setBathymetryData((prev) => [
        ...prev,
        {
          timestamp,
          latitude: posData?.lat ?? null,
          longitude: posData?.lon ?? null,
          altitude: posData?.alt ?? null,
          depth: depth ?? 0,
          yaw: yaw != null ? +yaw.toFixed(2) : null,
          pitch: pitch != null ? +pitch.toFixed(2) : null,
          roll: roll != null ? +roll.toFixed(2) : null,
          gps_fix_type: gpsFixType,
          satellites: satellitesVisible,
          depth_confidence: depthConfidence,
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

    const header =
      "timestamp,latitude,longitude,altitude,depth,yaw,pitch,roll,gps_fix_type,satellites,depth_confidence\n";
    const rows = bathymetryData
      .map(
        (d) =>
          `${d.timestamp},${d.latitude},${d.longitude},${d.altitude},${d.depth},${d.yaw},${d.pitch},${d.roll},${d.gps_fix_type},${d.satellites},${d.depth_confidence}`
      )
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
