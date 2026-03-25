"use client";

import { useState, useEffect, useCallback } from "react";

export function useSimulation(enabled = false) {
  const [simulatedTelemetry, setSimulatedTelemetry] = useState({});
  const [isSimulating, setIsSimulating] = useState(enabled);
  const [depthValue, setDepthValue] = useState(0);

  const startSimulation = useCallback(() => {
    setIsSimulating(true);
  }, []);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
  }, []);

  useEffect(() => {
    if (!isSimulating) return;

    let lat = -6.2088;
    let lon = 106.8456;
    let alt = 5.0;
    let depth = 0.0;
    let roll = 0;
    let pitch = 0;
    let yaw = 0;
    let voltage = 12.5;
    let servo1 = 1500;
    let servo3 = 1500;
    let armed = false;
    let counter = 0;

    const interval = setInterval(() => {
      counter++;

      lat += (Math.random() - 0.5) * 0.0001;
      lon += (Math.random() - 0.5) * 0.0001;
      alt += (Math.random() - 0.5) * 0.5;
      depth = Math.max(0, depth + (Math.random() - 0.5) * 0.5);
      setDepthValue(depth);

      roll = (Math.random() - 0.5) * 10;
      pitch = (Math.random() - 0.5) * 5;
      yaw = (yaw + (Math.random() - 0.5) * 5) % 360;

      voltage = Math.max(10.5, Math.min(13.0, voltage - 0.001 + (Math.random() - 0.5) * 0.01));

      if (counter % 30 === 0) {
        armed = !armed;
      }

      if (counter % 10 === 0) {
        servo1 = 1500 + Math.floor((Math.random() - 0.5) * 400);
        servo3 = 1500 + Math.floor((Math.random() - 0.5) * 400);
      }

      setSimulatedTelemetry({
        GLOBAL_POSITION_INT: {
          type: "GLOBAL_POSITION_INT",
          server_ts: new Date().toISOString(),
          payload: {
            lat: Math.round(lat * 1e7),
            lon: Math.round(lon * 1e7),
            alt: Math.round(alt * 1000),
          },
        },
        ATTITUDE: {
          type: "ATTITUDE",
          server_ts: new Date().toISOString(),
          payload: {
            roll: roll * (Math.PI / 180),
            pitch: pitch * (Math.PI / 180),
            yaw: yaw * (Math.PI / 180),
          },
        },
        SYS_STATUS: {
          type: "SYS_STATUS",
          server_ts: new Date().toISOString(),
          payload: {
            voltage_battery: Math.round(voltage * 1000),
            battery_remaining: Math.floor((voltage - 10.5) / 2.5 * 100),
          },
        },
        SERVO_OUTPUT_RAW: {
          type: "SERVO_OUTPUT_RAW",
          server_ts: new Date().toISOString(),
          payload: {
            servo1_raw: servo1,
            servo3_raw: servo3,
          },
        },
        HEARTBEAT: {
          type: "HEARTBEAT",
          server_ts: new Date().toISOString(),
          payload: {
            base_mode: armed ? 192 : 64,
            system_status: 4,
          },
        },
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulating]);

  return {
    simulatedTelemetry,
    isSimulating,
    startSimulation,
    stopSimulation,
    depthValue,
  };
}
