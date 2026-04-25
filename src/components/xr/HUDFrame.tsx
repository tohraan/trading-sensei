import { useEffect, useState } from "react";

interface Props {
  mode: "AR" | "VR";
  scene?: string;
}

export const HUDFrame = ({ mode, scene }: Props) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tz = time.toISOString().substring(11, 19);

  return (
    <>
      {/* Top status bar */}
      <div className="fixed top-0 left-0 right-0 z-40 px-6 pt-4 pointer-events-none">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-foreground/70 uppercase">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
              SENSEI · ONLINE
            </span>
            <span>BAT 87%</span>
            <span>LAT 12ms</span>
          </div>
          <div className="flex items-center gap-4">
            {scene && <span className="text-foreground">{scene}</span>}
            <span>{tz} UTC</span>
            <span className="px-2 py-0.5 border border-foreground/40">{mode}</span>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-6 pb-4 pointer-events-none">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-foreground/50 uppercase">
          <span>FOV 110° · 6DOF TRACKING</span>
          <span>EYE-TRK · ACTIVE</span>
          <span>v0.4.1 · TRADING SENSEI</span>
        </div>
      </div>

      {/* Corner brackets */}
      {[
        "top-12 left-4",
        "top-12 right-4",
        "bottom-12 left-4",
        "bottom-12 right-4",
      ].map((p, i) => (
        <div key={i} className={`fixed ${p} z-40 pointer-events-none`}>
          <svg width="22" height="22" viewBox="0 0 22 22" className="opacity-60">
            <path
              d={
                i === 0
                  ? "M0 8 V0 H8"
                  : i === 1
                  ? "M14 0 H22 V8"
                  : i === 2
                  ? "M0 14 V22 H8"
                  : "M14 22 H22 V14"
              }
              stroke="white"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </div>
      ))}
    </>
  );
};
