// components/features/useTelemetry.js
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getWsUrl, getMode } from "@/lib/connectionConfig";

const RECONNECT_DELAY = 3000; // 3 seconds between reconnect attempts
const CONNECT_TIMEOUT = 6000; // give up on a hanging handshake after 6s

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  // 3-state link health for the GUI indicators:
  //   "connecting"   → handshake in progress (amber / checking)
  //   "connected"    → socket open (green)
  //   "disconnected" → closed / failed / timed out (red)
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [connectionMode, setConnectionMode] = useState("hybrid");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const connectTimeoutTimer = useRef(null);

  // Stable connect function stored in a ref so the mode-change listener
  // can call the latest version without stale closures.
  const connectRef = useRef(null);

  useEffect(() => {
    const scheduleReconnect = () => {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), RECONNECT_DELAY);
    };

    const connect = () => {
      // Reset link state IMMEDIATELY so every indicator reflects the new
      // attempt instead of lingering on the previous connection's result.
      // (Without this, switching from a working endpoint to a dead one keeps
      // showing "connected" until the new socket's onclose finally fires.)
      setIsConnected(false);
      setConnectionStatus("connecting");
      clearTimeout(connectTimeoutTimer.current);

      // Tear down any existing socket without letting its handlers fire.
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }

      const mode = getMode();
      setConnectionMode(mode);
      const url = getWsUrl(mode);

      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        // e.g. mixed-content SecurityError when opening ws:// from an https page
        console.error("WS construct error:", err);
        setIsConnected(false);
        setConnectionStatus("disconnected");
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      // Watchdog: if the handshake doesn't complete in time, declare failure
      // and retry. Crucial for an unreachable host, where CONNECTING can hang.
      connectTimeoutTimer.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setIsConnected(false);
          setConnectionStatus("disconnected");
          try {
            ws.onclose = null;
            ws.close();
          } catch {
            /* ignore */
          }
          scheduleReconnect();
        }
      }, CONNECT_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(connectTimeoutTimer.current);
        setIsConnected(true);
        setConnectionStatus("connected");
      };

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
        clearTimeout(connectTimeoutTimer.current);
        setIsConnected(false);
        setConnectionStatus("disconnected");
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.error("WS error", err);
        // onerror is typically followed by onclose, but mark failed now so the
        // indicators don't sit on a stale state if onclose is delayed.
        setIsConnected(false);
        setConnectionStatus("disconnected");
      };
    };

    connectRef.current = connect;

    // Listen for mode changes from ConnectionModeSelector
    const onModeChanged = () => {
      clearTimeout(reconnectTimer.current);
      // Drop stale telemetry from the previous endpoint so panels don't show
      // old values while the new connection is being established/verified.
      setTelemetry({});
      connect();
    };
    window.addEventListener("connection-mode-changed", onModeChanged);

    connect();
    return () => {
      window.removeEventListener("connection-mode-changed", onModeChanged);
      clearTimeout(reconnectTimer.current);
      clearTimeout(connectTimeoutTimer.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
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

  return { telemetry, isConnected, connectionStatus, connectionMode, send };
}
