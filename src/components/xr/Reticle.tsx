import { useEffect, useState } from "react";

export const Reticle = () => {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    const down = () => setActive(true);
    const up = () => setActive(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div className="xr-reticle" style={{ left: pos.x, top: pos.y }}>
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <circle
          cx="12"
          cy="12"
          r={active ? 4 : 8}
          fill="none"
          stroke="white"
          strokeWidth="1"
          style={{ transition: "r 120ms ease" }}
        />
        <circle cx="12" cy="12" r="1" fill="white" />
        <line x1="12" y1="0" x2="12" y2="3" stroke="white" strokeWidth="1" />
        <line x1="12" y1="21" x2="12" y2="24" stroke="white" strokeWidth="1" />
        <line x1="0" y1="12" x2="3" y2="12" stroke="white" strokeWidth="1" />
        <line x1="21" y1="12" x2="24" y2="12" stroke="white" strokeWidth="1" />
      </svg>
    </div>
  );
};
