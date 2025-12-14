"use client";

const pwmToPct = (pwm) =>
  Math.max(-100, Math.min(100, ((Number(pwm) - 1500) / 400) * 100));

export default function StatusPanel({ telemetry }) {
  // Extract Thruster Data (using Logic from previous YPR panel)
  let leftPct = 0, rightPct = 0;
  const so = telemetry?.SERVO_OUTPUT_RAW?.payload;
  if (so?.servo1_raw != null && so?.servo3_raw != null) {
      leftPct  = pwmToPct(so.servo1_raw);
      rightPct = pwmToPct(so.servo3_raw);
  } else {
      // Fallback or other source
      // const rc = telemetry?.RC_CHANNELS?.payload; ...
  }
  
  // Format to 0%
  const lStr = leftPct.toFixed(0) + "%";
  const rStr = rightPct.toFixed(0) + "%";

  return (
    <div className="bg-amv-grey/90 border border-white/10 rounded-2xl p-4 shadow-xl h-full flex flex-col gap-2 overflow-auto backdrop-blur-md">
      <h3 className="text-sm font-bold text-center text-amv-white mb-2 shrink-0 uppercase tracking-wider">Status</h3>
      
      <div className="space-y-2 text-xs font-medium text-amv-white/80 flex-1 overflow-auto">
        <div className="bg-amv-black/30 border border-white/5 p-2.5 rounded-xl flex justify-between items-center">
            <span>Thruster L:</span>
            <span className="font-mono font-bold text-amv-white">{lStr}</span>
        </div>
        <div className="bg-amv-black/30 border border-white/5 p-2.5 rounded-xl flex justify-between items-center">
            <span>Thruster R:</span>
            <span className="font-mono font-bold text-amv-white">{rStr}</span>
        </div>

        <div className="bg-amv-black/30 border border-white/5 p-2.5 rounded-xl flex justify-between">
          <span>Thrust State:</span>
          <span className="text-emerald-400 font-bold">ARMED</span>
        </div>
        
        <div className="bg-amv-black/30 border border-white/5 p-2.5 rounded-xl flex justify-between">
          <span>Batt:</span>
          <span>16.4 V</span>
        </div>
           
        <div className="bg-amv-black/30 border border-white/5 p-2.5 rounded-xl flex justify-between">
          <span>Killswitch:</span>
          <span className="text-emerald-400 font-bold">SAFE</span>
        </div>
      </div>
    </div>
  );
}
