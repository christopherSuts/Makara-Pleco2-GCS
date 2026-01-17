// components/features/useTelemetry.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

// Your WebSocket server URL
const WS_URL = "ws://localhost:9000/ws";
const RECONNECT_DELAY = 3000; // 3 seconds

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [isExperimentActive, setIsExperimentActive] = useState(false); // Experiment state
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const modeChangeStartRef = useRef(null);

  // --- Instrumentation Refs ---
  const packetLogRef = useRef([]);  // Stores { Arrival_Time, App_Seq, Total_Generated, HW_Loss }
  const latencyLogRef = useRef([]); // Stores { Timestamp, Latency_ms }
  const probeSentTimeRef = useRef(null);

  // Helper to download CSVs (exposed to window)
  const downloadLogs = useCallback(() => {
    const downloadCSV = (data, filename) => {
        if (!data || data.length === 0) {
            console.warn(`No data for ${filename}`);
            return;
        }
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(header => row[header]).join(","));
        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    console.log(`Downloading logs: ${packetLogRef.current.length} packets, ${latencyLogRef.current.length} latency samples.`);
    downloadCSV(packetLogRef.current, `packet_loss_report_${Date.now()}.csv`);
    downloadCSV(latencyLogRef.current, `gcs_latency_${Date.now()}.csv`);
  }, []);

  const startExperiment = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "START_EXPERIMENT" }));
    }
  }, []);

  const stopExperiment = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "STOP_EXPERIMENT" }));
    }
  }, []);

  useEffect(() => {
    window.downloadLogs = downloadLogs;
    window.startExperiment = startExperiment; // For console testing
    window.stopExperiment = stopExperiment;
    return () => { 
        delete window.downloadLogs;
        delete window.startExperiment;
        delete window.stopExperiment;
    };
  }, [downloadLogs, startExperiment, stopExperiment]);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onmessage = (e) => {
        const now = Date.now();
        try {
          const msg = JSON.parse(e.data);

          // 1. Packet Loss Data Collection (Only if Experiment Active)
          // Middlewares injects "meta" ...
          // MODIFICATION: Actually, we probably want to log continually or only during experiment?
          // User requested "Controlled Experiment". Let's restrict to isExperimentActive
          // But isExperimentActive is a state, not a ref. We need a ref for the callback closure or use setState callback.
          // For simplicity in this structure, we'll check the current value via a ref that tracks state.
          // Wait, 'isExperimentActive' is used in the Effect dependency? No, that would re-connect.
          // Simplest approach: Use a Ref for the active state to avoid re-triggering this effect.
        
          if (msg.meta && experimentActiveRef.current) {
            packetLogRef.current.push({
                Arrival_Time: now,
                App_Seq: msg.meta.app_seq,
                Source_Total_Generated: msg.meta.total_generated,
                Source_HW_Loss: msg.meta.hw_loss
            });
          }

          // 2. Latency Probe Measurement (Only if Experiment Active)
          if (msg.type === "AUTOPILOT_VERSION" && probeSentTimeRef.current && experimentActiveRef.current) {
              const latency = now - probeSentTimeRef.current;
              latencyLogRef.current.push({
                  Timestamp: now,
                  Latency_ms: latency
              });
              probeSentTimeRef.current = null; 
          }

          // EXPERIMENT EVENTS
          if (msg.type === "EXPERIMENT_STARTED") {
              console.log("Experiment Started!");
              toast.info("Experiment STARTED ");
              // Reset logs
              packetLogRef.current = [];
              latencyLogRef.current = [];
              setIsExperimentActive(true);
              experimentActiveRef.current = true;
          }
          if (msg.type === "EXPERIMENT_STOPPED") {
              console.log("Experiment Stopped!");
              toast.info("Experiment STOPPED. Downloading logs...");
              setIsExperimentActive(false);
              experimentActiveRef.current = false;
              downloadLogs();
          }

          // Existing Logic
          if (msg.type === "SET_HOME_ACK") {
            const result = msg?.payload?.result ?? "OK";
            console.log("SET_HOME ACK:", result);
            toast.success(`SET_HOME: ${result}`);
          }
        
          // Gajadi dipake, tp ini untuk ukur latency Mode Change
          if (msg.type === "SET_MODE_ACK") {
            const result = msg?.payload?.result ?? "UNKNOWN";
            const latencyMsg = modeChangeStartRef.current 
              ? ` (${Date.now() - modeChangeStartRef.current}ms)` 
              : "";
            
            if (result === "ACCEPTED") {
                toast.success(`Mode Change: ${result}${latencyMsg}`);
            } else {
                toast.error(`Mode Change: ${result}${latencyMsg}`);
            }
            modeChangeStartRef.current = null;
          }

          if (msg.type === "MISSION_UPLOAD_ACK") {
            toast.success(msg.payload?.message || "Mission upload OK");
          }
          if (msg.type === "MISSION_UPLOAD_PROGRESS") {
            console.log("Mission:", msg.payload?.step, msg.payload?.index, "/", msg.payload?.total);
          }
          if (msg.type === "MISSION_UPLOAD_ERROR") {
            toast.error(msg.payload?.message || "Mission upload failed");
          }

          // store latest message by type
          setTelemetry((prev) => ({ ...prev, [msg.type]: msg }));
        } catch (err) {
          console.error("WS parse/handler error:", err, "raw:", String(e.data));
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      };
      ws.onerror = (err) => console.error("WS error", err);
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [downloadLogs]); // Dependency on downloadLogs is fine as it uses useCallback

  // Ref to track active state inside the WS callback without closure issues
  const experimentActiveRef = useRef(false);

  // define OUTSIDE the effect; use the ref inside it
  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    } else {
      console.warn("WS not open; cannot send", obj);
    }
  }, []);

  const setMode = (modeName) => {
    modeChangeStartRef.current = Date.now();
    send({ type: "SET_MODE", payload: { mode: modeName } });
  };

  // --- Latency Probe Interval (Only active when experiment is running) ---
  useEffect(() => {
      if (!isConnected) return;

      const timer = setInterval(() => {
          // Only send probe if experiment is active
          if (!experimentActiveRef.current) return;

          probeSentTimeRef.current = Date.now();
          send({
              type: "COMMAND_LONG",
              payload: {
                  command: 512, // MAV_CMD_REQUEST_MESSAGE
                  param1: 148,  // AUTOPILOT_VERSION
              }
          });
      }, 1000); // 1.0 Hz

      return () => clearInterval(timer);
  }, [isConnected, send]);


  return { telemetry, isConnected, send, setMode, isExperimentActive, startExperiment, stopExperiment };
}
