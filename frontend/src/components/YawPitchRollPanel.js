// YawPitchRollPanel.js
"use client";
import React from "react";

const RAD2DEG = 180 / Math.PI;
const BOX_W = "5rem"; // <- unified width of black rectangles

const pwmToPct = (pwm) =>
  Math.max(-100, Math.min(100, ((Number(pwm) - 1500) / 400) * 100));

function gpsFixLabel(fixType) {
  switch (Number(fixType)) {
    case 0: return "NO GPS";
    case 1: return "NO FIX";
    case 2: return "2D";
    case 3: return "3D";
    case 4: return "DGPS";
    case 5: return "RTK Float";
    case 6: return "RTK Fixed";
    default: return String(fixType ?? "–");
  }
}

// Single-line badge with fixed width and tabular numbers
function Badge({ label, value, suffix = "" }) {
  return (
    <div
      className="mt-1 bg-amv-black text-amv-white text-xs px-2 py-0.5 rounded"
      style={{ width: BOX_W }}
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-right">
          {value == null ? "–" : `${value}${suffix}`}
        </span>
      </div>
    </div>
  );
}

// Two-line badge (Left/Right) with the same fixed width
function BadgeTwoLine({ lLabel, lValue, rLabel, rValue }) {
  return (
    <div
      className="mt-1 bg-amv-black text-amv-white text-[11px] px-2 py-0.5 rounded leading-4"
      style={{ width: BOX_W }}
    >
      <div className="flex items-center justify-between">
        <span>{lLabel}</span>
        <span className="tabular-nums text-right">
          {lValue == null ? "–" : `${lValue}%`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>{rLabel}</span>
        <span className="tabular-nums text-right">
          {rValue == null ? "–" : `${rValue}%`}
        </span>
      </div>
    </div>
  );
}

export default function YawPitchRollPanel({ telemetry }) {
  const gps = telemetry?.GLOBAL_POSITION_INT?.payload || null;
  const gpsRaw = telemetry?.GPS_RAW_INT?.payload
              || telemetry?.GPS2_RAW?.payload
              || null;

  const satCount = Number.isFinite(gpsRaw?.satellites_visible)
    ? gpsRaw.satellites_visible : null;
  const fixText = gpsFixLabel(gpsRaw?.fix_type);

  const att = telemetry?.ATTITUDE?.payload || null;
  const rollDeg  = Number.isFinite(att?.roll)  ? (att.roll  * RAD2DEG).toFixed(1) : null;
  const pitchDeg = Number.isFinite(att?.pitch) ? (att.pitch * RAD2DEG).toFixed(1) : null;
  const yawDeg   = Number.isFinite(att?.yaw)   ? (att.yaw   * RAD2DEG).toFixed(1) : null;

  let leftPct = null, rightPct = null;
  const so = telemetry?.SERVO_OUTPUT_RAW?.payload;
  if (so?.servo1_raw != null && so?.servo3_raw != null) {
    leftPct  = pwmToPct(so.servo1_raw);
    rightPct = pwmToPct(so.servo3_raw);
  } else {
    const rc = telemetry?.RC_CHANNELS?.payload;
    if (rc?.chan1_raw != null && rc?.chan3_raw != null) {
      leftPct  = pwmToPct(rc.chan1_raw);
      rightPct = pwmToPct(rc.chan3_raw);
    } else {
      const rcs = telemetry?.RC_CHANNELS_SCALED?.payload;
      if (Number.isFinite(rcs?.chan1_scaled)) leftPct  = Math.max(-100, Math.min(100, rcs.chan1_scaled / 100));
      if (Number.isFinite(rcs?.chan3_scaled)) rightPct = Math.max(-100, Math.min(100, rcs.chan3_scaled / 100));
    }
  }

  return (
    <div>
      {/* GPS status — fixed width chips to avoid layout shift */}
      <div className="absolute top-2 right-2 bg-amv-white text-amv-black border border-amv-maroon/40 rounded px-2 py-1 text-xs backdrop-blur">
        <span className="mr-2">Sat:</span>
        <span className="inline-block tabular-nums text-right w-8">{satCount ?? "–"}</span>
        <span className="mx-2"> | </span>
        <span className="mr-1">Fix:</span>
        <span className="inline-block text-right w-9">{fixText}</span>
      </div>

      <div className="absolute top-16 right-2 grid grid-cols-2 gap-2">
        {/* Roll */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 bg-amv-plum rounded-full" />
          </div>
          <Badge label="Roll:" value={rollDeg} suffix="°" />
        </div>

        {/* Yaw */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-amv-black border border-amv-maroon/40 rounded-full flex items-center justify-center">
            <div className="w-7 h-7">
              <img src="/imuIndicator/yaw.png" alt="Yaw" />
            </div>
          </div>
          <Badge label="Yaw:" value={yawDeg} suffix="°" />
        </div>

        {/* Pitch */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
            <div className="w-8 h-4 bg-amv-plum rounded" />
          </div>
          <Badge label="Pitch:" value={pitchDeg} suffix="°" />
        </div>

        {/* Left/Right Thruster */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-amv-black rounded-full" />
          </div>
          <BadgeTwoLine lLabel="Left:" lValue={leftPct} rLabel="Right:" rValue={rightPct} />
        </div>
      </div>
    </div>
  );
}
