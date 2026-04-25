import { useMemo } from "react";
import { FaceFrame } from "@/hooks/useFaceTracking";

// face-api 68-point landmark connection groups (for edge generation)
const GROUPS: number[][] = [
  // jaw
  Array.from({ length: 17 }, (_, i) => i),
  // right brow
  [17, 18, 19, 20, 21],
  // left brow
  [22, 23, 24, 25, 26],
  // nose bridge
  [27, 28, 29, 30],
  // nose bottom
  [31, 32, 33, 34, 35],
  // right eye
  [36, 37, 38, 39, 40, 41, 36],
  // left eye
  [42, 43, 44, 45, 46, 47, 42],
  // outer lips
  [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48],
  // inner lips
  [60, 61, 62, 63, 64, 65, 66, 67, 60],
];

// Cross-group triangulation edges — connect structurally meaningful pairs
// These are static index pairs (a,b) that form a triangulated mesh
const CROSS_EDGES: [number, number][] = [
  // brow to nose bridge
  [21, 27], [22, 27],
  // nose bridge to eye corners
  [27, 39], [27, 42],
  // cheek diagonals
  [0, 36], [16, 45],
  [1, 36], [15, 45],
  [2, 31], [14, 35],
  [3, 31], [13, 35],
  // jaw to mouth corners
  [4, 48], [12, 54],
  [5, 48], [11, 54],
  [6, 57], [10, 57],
  // nose to lips
  [33, 51], [31, 48], [35, 54],
  // eye to brow to inner
  [17, 36], [26, 45],
  [18, 37], [25, 44],
  [21, 39], [22, 42],
  // chin to mouth
  [8, 57], [7, 58], [9, 56],
  // forehead mesh (approximate above brows)
  [17, 19], [19, 21], [22, 24], [24, 26], [21, 22],
  [18, 27],[25, 27],
];

// Node categories → different visual treatment
const NODE_SIZES: Record<number, number> = {
  // Eye corners — bigger
  36: 2.5, 39: 2.5, 42: 2.5, 45: 2.5,
  // Mouth corners
  48: 2.5, 54: 2.5,
  // Nose tip
  30: 2.5, 33: 2.5,
  // Chin
  8: 2.5,
};

interface Props {
  frame: FaceFrame;
}

export const FaceMesh = ({ frame }: Props) => {
  const { landmarks } = frame;

  // Build all edges: group contours + cross-edges (deduplicated)
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const result: [number, number][] = [];
    const add = (a: number, b: number) => {
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push([a, b]);
      }
    };
    GROUPS.forEach((g) => {
      for (let i = 0; i < g.length - 1; i++) add(g[i], g[i + 1]);
    });
    CROSS_EDGES.forEach(([a, b]) => add(a, b));
    return result;
  }, []); // landmark indices never change

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 30 }}>
      {/* Mesh edges */}
      {edges.map(([a, b], i) => {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) return null;
        return (
          <line
            key={i}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke="hsl(var(--hud-line))"
            strokeWidth={0.6}
            opacity={0.45}
          />
        );
      })}

      {/* Landmark nodes */}
      {landmarks.map((p, i) => {
        const r = NODE_SIZES[i] ?? 1.5;
        const isKey = !!NODE_SIZES[i];
        return (
          <g key={i}>
            {/* Outer glow ring on key points */}
            {isKey && (
              <circle
                cx={p.x} cy={p.y}
                r={r + 2.5}
                fill="none"
                stroke="hsl(var(--hud-line))"
                strokeWidth={0.5}
                opacity={0.25}
              />
            )}
            <circle
              cx={p.x} cy={p.y}
              r={r}
              fill="hsl(var(--hud-line))"
              opacity={isKey ? 1 : 0.75}
            />
          </g>
        );
      })}

      {/* Highlight eye-centre crosshairs */}
      {landmarks[36] && landmarks[39] && (() => {
        const ex = (landmarks[36].x + landmarks[39].x) / 2;
        const ey = (landmarks[36].y + landmarks[39].y) / 2;
        return (
          <g opacity={0.6}>
            <line x1={ex - 5} y1={ey} x2={ex + 5} y2={ey} stroke="hsl(var(--hud-line))" strokeWidth={0.8} />
            <line x1={ex} y1={ey - 5} x2={ex} y2={ey + 5} stroke="hsl(var(--hud-line))" strokeWidth={0.8} />
          </g>
        );
      })()}
      {landmarks[42] && landmarks[45] && (() => {
        const ex = (landmarks[42].x + landmarks[45].x) / 2;
        const ey = (landmarks[42].y + landmarks[45].y) / 2;
        return (
          <g opacity={0.6}>
            <line x1={ex - 5} y1={ey} x2={ex + 5} y2={ey} stroke="hsl(var(--hud-line))" strokeWidth={0.8} />
            <line x1={ex} y1={ey - 5} x2={ex} y2={ey + 5} stroke="hsl(var(--hud-line))" strokeWidth={0.8} />
          </g>
        );
      })()}
    </svg>
  );
};
