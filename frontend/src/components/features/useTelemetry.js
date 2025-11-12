// components/features/useTelemetry.js
"use client";

import { useState, useEffect } from "react";

// Your WebSocket server URL
const WS_URL = "ws://localhost:9000/ws";
const RECONNECT_DELAY = 3000; // 3 seconds

export function useTelemetry() {
  // This state will store all incoming messages, keyed by their type
  const [telemetry, setTelemetry] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws;
    let timeoutId;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("Telemetry WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          setTelemetry((prev) => ({
            ...prev,
            [message.type]: message,
          }));
        } catch (err) {
          console.error("RAW WS:", String(event.data));
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("Telemetry WebSocket disconnected");
        setIsConnected(false);

        // --- THIS IS THE AUTO-RECONNECT LOGIC ---
        // Clear any existing reconnect timer
        clearTimeout(timeoutId);
        // Try to reconnect after a delay
        timeoutId = setTimeout(connect, RECONNECT_DELAY);
      };
    }

    connect(); // Initial connection attempt

    // Cleanup function
    return () => {
      clearTimeout(timeoutId); // Clear timer on unmount
      if (ws) {
        ws.onclose = null; // Prevent reconnect logic from running on unmount
        ws.close();
      }
    };
  }, []); // The empty array ensures this effect runs only once on mount

  return { telemetry, isConnected };
}