// components/features/useTelemetry.js
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";

// Your WebSocket server URL
const WS_URL = "ws://localhost:9000/ws";
const RECONNECT_DELAY = 3000; // 3 seconds

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
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

          // store latest message by type
          setTelemetry((prev) => ({ ...prev, [msg.type]: msg }));
        } catch (err) {
          console.error("WS parse/handler error:", err, "raw:", String(e.data));
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, 3000);
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

  return { telemetry, isConnected, send };
}