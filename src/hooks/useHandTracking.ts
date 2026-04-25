import { useEffect, useRef, useState } from "react";
import { Hands, Results, HAND_CONNECTIONS } from "@mediapipe/hands";

export interface HandPoint { x: number; y: number }

export type HandGesture = "open" | "fist" | "pinch" | "other";

export interface HandFrame {
  landmarks: HandPoint[];
  pinchDistance: number;
  pinching: boolean;
  centroid: HandPoint;
  palmCenter: HandPoint;       // centre of palm (wrist + 4 MCP joints)
  handedness: "Left" | "Right";
  gesture: HandGesture;
  extendedFingers: number;    // 0-5
}

interface Opts {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
}

export { HAND_CONNECTIONS };

// ─── Gesture classifier ───────────────────────────────────────────────────────
function dist(a: HandPoint, b: HandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyGesture(pts: HandPoint[]): {
  gesture: HandGesture;
  extendedFingers: number;
  palmCenter: HandPoint;
} {
  const wrist = pts[0];

  // Palm centre: average of wrist + 4 finger MCP joints
  const palmCenter: HandPoint = {
    x: (wrist.x + pts[5].x + pts[9].x + pts[13].x + pts[17].x) / 5,
    y: (wrist.y + pts[5].y + pts[9].y + pts[13].y + pts[17].y) / 5,
  };

  // Finger extended = tip farther from wrist than the PIP joint
  // [tip, dip, pip, mcp]
  const fingerIdx = [
    [8, 7, 6, 5],    // index
    [12, 11, 10, 9], // middle
    [16, 15, 14, 13],// ring
    [20, 19, 18, 17],// pinky
  ];

  let extended = 0;
  for (const [tip, , pip] of fingerIdx) {
    if (dist(pts[tip], wrist) > dist(pts[pip], wrist) * 1.1) extended++;
  }
  // Thumb: extended if thumb-tip farther from index-MCP than thumb-IP
  if (dist(pts[4], pts[5]) > dist(pts[3], pts[5]) * 0.9) extended++;

  // Pinch check (thumb tip ↔ index tip)
  const pinchDist = dist(pts[4], pts[8]);

  let gesture: HandGesture;
  if (pinchDist < 50) {
    gesture = "pinch";
  } else if (extended <= 1) {
    gesture = "fist";
  } else if (extended >= 3) {
    gesture = "open";
  } else {
    gesture = "other";
  }

  return { gesture, extendedFingers: extended, palmCenter };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useHandTracking = ({ videoRef, containerRef, enabled }: Opts) => {
  const [hands, setHands] = useState<HandFrame[]>([]);
  const handsRef = useRef<Hands | null>(null);
  const rafRef = useRef(0);
  // Per-hand pinch hysteresis
  const pinchStateRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled) { setHands([]); return; }
    let cancelled = false;

    const tracker = new Hands({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
    });
    tracker.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    tracker.onResults((res: Results) => {
      const c = containerRef.current;
      const v = videoRef.current;
      if (!c || !v) return;

      const multiLm = res.multiHandLandmarks ?? [];
      const multiHanded = res.multiHandedness ?? [];

      if (!multiLm.length) { setHands([]); return; }

      const cw = c.clientWidth;
      const ch = c.clientHeight;
      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;
      const scale = Math.max(cw / vw, ch / vh);
      const dispW = vw * scale;
      const dispH = vh * scale;
      const offX = (cw - dispW) / 2;
      const offY = (ch - dispH) / 2;

      const frames: HandFrame[] = multiLm.map((lm, idx) => {
        const handLabel = (multiHanded[idx]?.label ?? "Right") as "Left" | "Right";

        const pts: HandPoint[] = lm.map((p) => ({
          x: offX + (1 - p.x) * vw * scale, // mirrored
          y: offY + p.y * vh * scale,
        }));

        const thumb = pts[4];
        const index = pts[8];
        const pinchDist = dist(thumb, index);

        // Hysteresis per hand
        const key = handLabel;
        if (pinchDist < 50) pinchStateRef.current[key] = true;
        else if (pinchDist > 80) pinchStateRef.current[key] = false;

        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

        const { gesture, extendedFingers, palmCenter } = classifyGesture(pts);

        return {
          landmarks: pts,
          pinchDistance: pinchDist,
          pinching: pinchStateRef.current[key] ?? false,
          centroid: { x: cx, y: cy },
          palmCenter,
          handedness: handLabel,
          gesture,
          extendedFingers,
        };
      });

      setHands(frames);
    });

    handsRef.current = tracker;

    const loop = async () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (v && v.readyState === 4 && handsRef.current) {
        try { await handsRef.current.send({ image: v }); } catch (_) {}
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      tracker.close().catch(() => {});
      handsRef.current = null;
      pinchStateRef.current = {};
      setHands([]);
    };
  }, [enabled, videoRef, containerRef]);

  const hand = hands[0] ?? null;
  return { hand, hands };
};
