import { HandFrame, HAND_CONNECTIONS } from "@/hooks/useHandTracking";

interface Props {
  hands: HandFrame[];
  /** ID of the hand currently grabbing a card, if any */
  primaryHandedness?: "Left" | "Right" | null;
}

const GESTURE_LABEL: Record<string, string> = {
  open: "OPEN",
  fist: "FIST",
  pinch: "PINCH",
  other: "—",
};

const GESTURE_COLOR: Record<string, string> = {
  open: "hsl(var(--hud-line))",
  fist: "hsl(var(--success))",
  pinch: "hsl(var(--success))",
  other: "hsl(var(--foreground) / 0.4)",
};

export const HandOverlay = ({ hands, primaryHandedness }: Props) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 32 }}>
    {hands.map((hand) => {
      const { landmarks, gesture, palmCenter, pinching, pinchDistance, handedness } = hand;
      const thumb = landmarks[4];
      const index = landmarks[8];
      const midX = (thumb.x + index.x) / 2;
      const midY = (thumb.y + index.y) / 2;

      const isPrimary = handedness === primaryHandedness;
      const color = GESTURE_COLOR[gesture] ?? "hsl(var(--hud-line))";
      const boneOpacity = gesture === "fist" ? 0.8 : 0.55;

      return (
        <g key={handedness}>
          {/* Bones */}
          {(HAND_CONNECTIONS as [number, number][]).map(([a, b], i) => (
            <line
              key={i}
              x1={landmarks[a].x} y1={landmarks[a].y}
              x2={landmarks[b].x} y2={landmarks[b].y}
              stroke={color}
              strokeWidth={gesture === "fist" ? 1.4 : 1}
              opacity={boneOpacity}
            />
          ))}

          {/* Joints */}
          {landmarks.map((p, i) => {
            const isKey = i === 4 || i === 8;
            const isKnuckle = [5, 9, 13, 17, 0].includes(i);
            return (
              <circle
                key={i}
                cx={p.x} cy={p.y}
                r={isKey ? 5 : isKnuckle ? 3 : 2}
                fill={isKey ? color : "hsl(var(--hud-line))"}
                opacity={isKey ? 1 : 0.65}
              />
            );
          })}

          {/* Palm-centre indicator (hover target) */}
          <circle
            cx={palmCenter.x} cy={palmCenter.y}
            r={gesture === "open" ? 14 : gesture === "fist" ? 10 : 8}
            fill={gesture === "open" ? "hsl(var(--hud-line) / 0.08)" : "none"}
            stroke={color}
            strokeWidth={gesture === "open" ? 1 : 0.6}
            opacity={gesture === "fist" ? 1 : 0.55}
            strokeDasharray={gesture === "open" ? "" : "3 2"}
          />

          {/* Pinch line (only for pinch gesture) */}
          {gesture === "pinch" && (
            <>
              <line
                x1={thumb.x} y1={thumb.y}
                x2={index.x} y2={index.y}
                stroke="hsl(var(--success))"
                strokeWidth={1.5}
                opacity={0.9}
              />
              <circle cx={midX} cy={midY} r={16} fill="none" stroke="hsl(var(--success))" strokeWidth={1} opacity={0.8} />
            </>
          )}

          {/* Gesture badge */}
          <g>
            <text
              x={palmCenter.x + 18}
              y={palmCenter.y - 6}
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              fill={color}
              opacity={0.9}
            >
              {handedness.toUpperCase()} · {GESTURE_LABEL[gesture]}
            </text>
            {gesture === "pinch" && (
              <text
                x={palmCenter.x + 18}
                y={palmCenter.y + 6}
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                fill="hsl(var(--success))"
                opacity={0.7}
              >
                {Math.round(pinchDistance)}px
              </text>
            )}
            {isPrimary && (gesture === "fist" || gesture === "open") && (
              <text
                x={palmCenter.x + 18}
                y={palmCenter.y + 6}
                fontSize="7"
                fontFamily="JetBrains Mono, monospace"
                fill="hsl(var(--success))"
                opacity={0.6}
              >
                ◆ PRIMARY
              </text>
            )}
          </g>
        </g>
      );
    })}
  </svg>
);
