// components/features/useTelemetry.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { getWsUrl, getMode } from "@/lib/connectionConfig";

const RECONNECT_DELAY = 3000; // 3 seconds

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState("hybrid");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // Stable connect function stored in a ref so the mode-change listener
  // can call the latest version without stale closures.
  const connectRef = useRef(null);

  useEffect(() => {
    const connect = () => {
      // Close any existing socket first
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      const mode = getMode();
      setConnectionMode(mode);
      const url = getWsUrl(mode);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === "SET_HOME_ACK") {
            const result = msg?.payload?.result ?? "OK";
            console.log("SET_HOME ACK:", result);
            toast.success(`SET_HOME: ${result}`);
          }
          if (msg.type === "MISSION_UPLOAD_ACK") {
            // { ok: true, message: "...", count: N }
            toast.success(msg.payload?.message || "Mission upload OK");
          }
          if (msg.type === "MISSION_UPLOAD_PROGRESS") {
            // { step: "...", index: n, total: N }
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

    connectRef.current = connect;

    // Listen for mode changes from ConnectionModeSelector
    const onModeChanged = () => {
      clearTimeout(reconnectTimer.current);
      connect();
    };
    window.addEventListener("connection-mode-changed", onModeChanged);

    connect();
    return () => {
      window.removeEventListener("connection-mode-changed", onModeChanged);
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // define OUTSIDE the effect; use the ref inside it
  const send = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    } else {
      console.warn("WS not open; cannot send", obj);
    }
  };

  return { telemetry, isConnected, connectionMode, send };
}