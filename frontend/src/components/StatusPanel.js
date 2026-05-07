"use client";
import { motorBatteryParser } from "@/lib/parser";
import { Cabin_Sketch } from "next/font/google";
import React from "react";
import pwmMap from "@/t500";

const pwmToPct = (pwm) =>
  Math.max(-100, Math.min(100, ((Number(pwm) - 1500) / 400) * 100));

// Calculate battery time estimation (HH:MM:SS)
const calculateBatteryTime = (currentBattery) => {
  // Find current for servo1_raw and servo3_raw from pwmMap datasheet
  const getPwmCurrent = (pwm) => {
    if (pwm == null) return null;
    const pwmStr = String(pwm);
    if (pwmMap[pwmStr]) {
      return pwmMap[pwmStr].current;
    }

    // If exact PWM not found, find the entry with highest ampere
    let maxCurrent = 0;
    let closestPwm = null;
    for (const [key, value] of Object.entries(pwmMap)) {
      if (value.current > maxCurrent) {
        maxCurrent = value.current;
        closestPwm = key;
      }
    }
    return maxCurrent || 0;
  };

  const servo_avg = "1200";
  const current1 = getPwmCurrent(servo_avg) || 0;
  const current3 = getPwmCurrent(servo_avg) || 0;
  const totalCurrent = current1 + current3; // Amps

  if (totalCurrent <= 0 || !currentBattery) {
    return "N/A";
  }

  // Calculate hours remaining
  const hoursRemaining = currentBattery / totalCurrent;

  // Convert to HH:MM:SS
  const totalSeconds = hoursRemaining * 3600;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function StatusPanel({
  telemetry,
  isBackendConnected,
}) {
  // 1. Connection Health (based on HEARTBEAT + WebSocket)
  const hb = telemetry?.HEARTBEAT;
  const lastHeartbeat = hb?.server_ts ? new Date(hb.server_ts).getTime() : 0;
  const now = new Date().getTime();

  // Logical connection: Backend WS is connected AND Heartbeat is fresh (<3s)
  const isHeartbeatFresh = lastHeartbeat > 0 && (now - lastHeartbeat) < 3000;
  const isConnected = isBackendConnected && isHeartbeatFresh;

  // 2. Extract Data
  // Thrusters
  let leftPct = 0, rightPct = 0;
  const so = telemetry?.SERVO_OUTPUT_RAW?.payload;
  if (so?.servo1_raw != null && so?.servo3_raw != null) {
    leftPct = pwmToPct(so.servo1_raw);
    rightPct = pwmToPct(so.servo3_raw);
  }

  // Battery (SYS_STATUS)
  // voltage_battery is usually in mV
  const sys = telemetry?.SYS_STATUS?.payload;
  const battVolts = sys?.voltage_battery ? (sys.voltage_battery / 1000).toFixed(1) : "–";

  const maxBattery = 6.3; // Ah (amp-hours)
  const motorBattery = motorBatteryParser(telemetry?.SERIAL_DATA?.payload.raw).status || "0";

  // Calculate battery time estimation based on servo PWM
  const batteryTimeEst = calculateBatteryTime(maxBattery);
  
  // --- IGNORE ---
  const speedOverground = telemetry?.VFR_HUD?.payload?.groundspeed ?? 0;

  // MAV_MODE_FLAG_SAFETY_ARMED = 128
  const baseMode = hb?.payload?.base_mode;
  const rawIsArmed = baseMode != null ? (baseMode & 128) !== 0 : false;

  // Debounce Logic: 
  // We use a ref to track the last time we saw a CONFIRMED "ARMED" signal.
  // If we see "ARMED", we update the timestamp and set state to True.
  // If we see "DISARMED", we only switch to False if it's been >1000ms since the last "ARMED".
  // This filters out the "GCS Noise" (System 255) which sends Disarmed heartbeats interleaved with Drone heartbeats.

  const lastArmedTimeRef = React.useRef(0);
  const [displayedArmed, setDisplayedArmed] = React.useState(false);

  React.useEffect(() => {
    if (rawIsArmed) {
      lastArmedTimeRef.current = Date.now();
      setDisplayedArmed(true);
    } else {
      // It says Disarmed. Is this real or noise?
      const timeSinceArmed = Date.now() - lastArmedTimeRef.current;
      if (timeSinceArmed > 500) {
        setDisplayedArmed(false);
      }
    }
  }, [rawIsArmed, hb]); // Re-run when heartbeat updates

  // Also check periodically? No, effect is fine as telemetry updates freq.
  const isArmed = displayedArmed;

  // Format Strings
  const lStr = leftPct.toFixed(0) + "%";
  const rStr = rightPct.toFixed(0) + "%";

  return (
    <div className="bg-amv-grey/90 border border-white/10 rounded-2xl p-3 shadow-xl h-full flex flex-col gap-1 overflow-auto backdrop-blur-md">
      <div className="flex items-center justify-center gap-2 mb-1 shrink-0">
        <h3 className="text-sm font-bold text-amv-white uppercase tracking-wider">Status</h3>
        {/* Telemetry Indicator */}
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500/50"}`} title={isConnected ? "Telemetry Live" : "No Signal"}></div>
      </div>

      <div className={`space-y-1 text-xs font-medium text-amv-white/80 flex-1 overflow-auto transition-opacity duration-300 ${isConnected ? "opacity-100" : "opacity-40 grayscale pointer-events-none"}`}>
        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between items-center">
          <span>Thruster L:</span>
          <span className="font-mono font-bold text-amv-white">{lStr}</span>
        </div>
        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between items-center">
          <span>Thruster R:</span>
          <span className="font-mono font-bold text-amv-white">{rStr}</span>
        </div>

        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Thrust State:</span>
          {isArmed ? (
            <span className="text-emerald-400 font-bold animate-pulse">ARMED</span>
          ) : (
            <span className="text-amber-400 font-bold">DISARMED</span>
          )}
        </div>

        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Batt:</span>
          <span className="font-mono font-bold text-amv-white">{battVolts} V</span>
        </div>

        {/* <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Batt Estimate:</span>
          <span className="font-mono font-bold text-amv-white">{batteryTimeEst}</span>
        </div> */}

        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Motor Batt:</span>
          <span className="font-mono font-bold text-amv-white">{motorBattery}%</span>
        </div>

        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Speed (m/h):</span>
          <span className="font-mono font-bold text-amv-white">{speedOverground.toFixed(2)}</span>
        </div>

        {/* <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Time Estimation:</span>
          <span className="font-mono font-bold text-amv-white">{timeEstimation.toFixed(2)} s</span>
        </div> */}

        <div className="bg-amv-black/30 border border-white/5 p-1.5 rounded-xl flex justify-between">
          <span>Killswitch:</span>
          <span className="text-amv-white/50 italic">SAFE (Sim)</span>
        </div>
      </div>
    </div>
  );
}
