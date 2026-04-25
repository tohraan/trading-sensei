import {
  useEffect, useRef, useState, useMemo,
  useCallback, forwardRef, ReactNode,
} from "react";
import { Scenario } from "./scenarios";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { useHandTracking, HandFrame } from "@/hooks/useHandTracking";
import { FaceMesh } from "./FaceMesh";
import { HandOverlay } from "./HandOverlay";
import { CandlestickChart, Timeframe } from "./CandlestickChart";

interface Props { scenario: Scenario | null }

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D"];
const GRAB_HOLD_MS = 2000;

type CardStatus = "idle" | "hovered" | "countdown" | "dragging" | "pinned";

// ─── Shared card state per card ───────────────────────────────────────────────
interface CardState {
  status: CardStatus;
  pos: { x: number; y: number } | null;
  scale: number;
  countdown: number;
}

// ─── GestureCard — wraps any card content with full gesture interaction ────────
interface GestureCardProps {
  id: string;
  defaultPos: { x: number; y: number };
  children: ReactNode;
  activeCardId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  state: CardState;
  onMouseDrag: (id: string, pos: { x: number; y: number }) => void;
  zBase?: number;
  minWidth?: number;
}

const GestureCard = forwardRef<HTMLDivElement, GestureCardProps>(
  ({ id, defaultPos, children, state, onMouseDrag, zBase = 31, minWidth = 280 }, ref) => {
    const { status, pos, scale, countdown } = state;
    const isSelected = status !== "idle";
    const isPinned = status === "pinned";
    const isDragging = status === "dragging";
    const isCountdown = status === "countdown";
    const isHovered = status === "hovered";

    const activePos = (isDragging || isPinned) && pos ? pos : defaultPos;

    // ── Mouse drag ──────────────────────────────────────────────────────────
    const mouseDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      const origin = (isDragging || isPinned) && pos ? pos : defaultPos;
      mouseDragRef.current = { startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y };

      const onMove = (ev: MouseEvent) => {
        if (!mouseDragRef.current) return;
        const { startX, startY, originX, originY } = mouseDragRef.current;
        onMouseDrag(id, { x: originX + ev.clientX - startX, y: originY + ev.clientY - startY });
      };
      const onUp = () => {
        mouseDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }, [id, isDragging, isPinned, pos, defaultPos, onMouseDrag]);

    const ringColor = isDragging
      ? "0 0 0 1.5px hsl(var(--success) / 0.9), 0 0 12px hsl(var(--success) / 0.2)"
      : isCountdown
      ? "0 0 0 1px rgba(255,255,255,0.55)"
      : isHovered
      ? "0 0 0 1px rgba(255,255,255,0.9)"
      : isPinned
      ? "0 0 0 1px rgba(255,255,255,0.5)"
      : "0 0 0 1px rgba(255,255,255,0.15)";

    return (
      <div
        ref={ref}
        data-card-id={id}
        className="fixed xr-panel xr-corner p-4 animate-fade-in"
        style={{
          left: activePos.x,
          top: activePos.y,
          minWidth,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          transition: isDragging
            ? "none"
            : "left 140ms ease, top 140ms ease, box-shadow 120ms ease, transform 80ms ease",
          zIndex: isDragging ? 60 : isPinned ? 50 : isSelected ? 40 : zBase,
          boxShadow: ringColor,
          willChange: isDragging ? "left, top" : undefined,
          cursor: "grab",
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Drag handle strip */}
        <div
          className="absolute top-0 left-0 right-0 h-5 flex items-center px-2"
          style={{ cursor: "grab" }}
        >
          <div className="flex gap-0.5 opacity-30">
            {[0,1,2,3,4,5].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-foreground" />)}
          </div>
        </div>

        {/* Status badge */}
        <div className="absolute top-1.5 right-2 flex items-center gap-1.5">
          {isCountdown && (
            <span className="font-mono text-[7px] tracking-[0.2em] text-foreground/60">
              {Math.ceil((1 - countdown) * (GRAB_HOLD_MS / 1000))}s
            </span>
          )}
          {isPinned && (
            <span className="font-mono text-[7px] tracking-[0.2em] text-success/80">◆ PINNED</span>
          )}
          {isDragging && (
            <span className="font-mono text-[7px] tracking-[0.2em] text-success">◆ GRABBED</span>
          )}
        </div>

        {children}
      </div>
    );
  }
);
GestureCard.displayName = "GestureCard";

// ─── CountdownRing ─────────────────────────────────────────────────────────────
const CountdownRing = ({ progress, x, y }: { progress: number; x: number; y: number }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 65 }}>
      <circle cx={x} cy={y} r={r} fill="none" stroke="white" strokeWidth={1} opacity={0.12} />
      <circle
        cx={x} cy={y} r={r} fill="none"
        stroke="hsl(var(--success))" strokeWidth={2}
        strokeDasharray={`${circ * progress} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${x} ${y})`}
        opacity={0.95}
      />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10"
        fontFamily="JetBrains Mono, monospace" fill="hsl(var(--success))">
        {Math.ceil((1 - progress) * (GRAB_HOLD_MS / 1000))}s
      </text>
    </svg>
  );
};

// ─── ZoomBadge ────────────────────────────────────────────────────────────────
const ZoomBadge = ({ percent, x, y }: { percent: number; x: number; y: number }) => (
  <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 66 }}>
    <rect x={x - 34} y={y - 13} width={68} height={20} rx={2}
      fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--success))" strokeWidth={0.6} />
    <text x={x} y={y + 2} textAnchor="middle" fontSize="9"
      fontFamily="JetBrains Mono, monospace" fill="hsl(var(--success))">
      {percent}% SCALE
    </text>
  </svg>
);

// ─── useGestureCards — manages N cards simultaneously ─────────────────────────
type CardId = string;

function useGestureCards(
  hands: HandFrame[],
  cardRefs: React.RefObject<Record<CardId, HTMLDivElement | null>>,
  defaultPositions: Record<CardId, { x: number; y: number }>,
) {
  const [states, setStates] = useState<Record<CardId, CardState>>({});
  const statesRef = useRef<Record<CardId, CardState>>({});
  const primaryHandRef = useRef<"Left" | "Right" | null>(null);
  const activeCardRef = useRef<CardId | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const scaleBaselineRef = useRef<number | null>(null);
  const countdownRafRef = useRef(0);
  const countdownStartRef = useRef<number | null>(null);

  // Sync states ref
  useEffect(() => { statesRef.current = states; }, [states]);

  const getCardState = useCallback((id: CardId): CardState =>
    statesRef.current[id] ?? { status: "idle", pos: null, scale: 1, countdown: 0 },
  []);

  const updateCard = useCallback((id: CardId, patch: Partial<CardState>) => {
    // Always sync ref immediately so next rAF frame reads fresh data
    const current = statesRef.current[id] ?? { status: "idle", pos: null, scale: 1, countdown: 0 };
    const next = { ...current, ...patch };
    statesRef.current = { ...statesRef.current, [id]: next };
    setStates((prev) => ({ ...prev, [id]: next }));
  }, []);

  // Hit test: which card is the palm over?
  const hitCard = useCallback((palmX: number, palmY: number): CardId | null => {
    const refs = cardRefs.current;
    if (!refs) return null;
    for (const [id, el] of Object.entries(refs)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (palmX >= r.left - 16 && palmX <= r.right + 16 &&
          palmY >= r.top - 16 && palmY <= r.bottom + 16) {
        return id;
      }
    }
    return null;
  }, [cardRefs]);

  // Countdown rAF runner
  const startCountdown = useCallback((cardId: CardId) => {
    cancelAnimationFrame(countdownRafRef.current);
    countdownStartRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - (countdownStartRef.current ?? now);
      const p = Math.min(1, elapsed / GRAB_HOLD_MS);
      updateCard(cardId, { countdown: p });
      if (p < 1) {
        countdownRafRef.current = requestAnimationFrame(tick);
      } else {
        // Threshold reached → dragging
        dragOffsetRef.current = null;
        updateCard(cardId, { status: "dragging", countdown: 1 });
        statesRef.current[cardId] = { ...(statesRef.current[cardId] ?? { status: "idle", pos: null, scale: 1, countdown: 0 }), status: "dragging", countdown: 1 };
      }
    };
    countdownRafRef.current = requestAnimationFrame(tick);
  }, [updateCard]);

  const stopCountdown = useCallback(() => {
    cancelAnimationFrame(countdownRafRef.current);
    countdownStartRef.current = null;
  }, []);

  // [active card id state for rendering]
  const [primaryHandedness, setPrimaryHandedness] = useState<"Left" | "Right" | null>(null);
  const [scalePercent, setScalePercent] = useState<number | null>(null);
  const [activeCardId, setActiveCardId] = useState<CardId | null>(null);

  // Main interaction loop
  useEffect(() => {
    if (!hands.length) {
      const active = activeCardRef.current;
      if (active) {
        const st = statesRef.current[active]?.status;
        if (st !== "pinned") {
          stopCountdown();
          updateCard(active, { status: "idle", countdown: 0 });
          activeCardRef.current = null;
          setActiveCardId(null);
          primaryHandRef.current = null;
          setPrimaryHandedness(null);
        }
      }
      scaleBaselineRef.current = null;
      setScalePercent(null);
      return;
    }

    // Identify primary and secondary hand
    let primary: HandFrame | undefined;
    let secondary: HandFrame | undefined;
    if (primaryHandRef.current) {
      primary = hands.find((h) => h.handedness === primaryHandRef.current);
      secondary = hands.find((h) => h.handedness !== primaryHandRef.current);
    }
    if (!primary) {
      primary = hands.find((h) => h.gesture === "open" || h.gesture === "fist") ?? hands[0];
      secondary = hands.find((h) => h !== primary);
    }
    if (!primary) return;

    const activeId = activeCardRef.current;
    const gesture = primary.gesture;
    const palmX = primary.palmCenter.x;
    const palmY = primary.palmCenter.y;

    if (!activeId) {
      // No card active — look for hover
      if (gesture === "open") {
        const hit = hitCard(palmX, palmY);
        if (hit) {
          // Clear any previously hovered card
          Object.keys(statesRef.current).forEach((id) => {
            if (id !== hit && statesRef.current[id]?.status === "hovered") {
              updateCard(id, { status: "idle" });
            }
          });
          activeCardRef.current = hit;
          setActiveCardId(hit);
          primaryHandRef.current = primary.handedness;
          setPrimaryHandedness(primary.handedness);
          updateCard(hit, { status: "hovered", countdown: 0 });
        }
      }
    } else {
      const cardState = statesRef.current[activeId] ?? { status: "idle", pos: null, scale: 1, countdown: 0 };
      const st = cardState.status;

      if (st === "hovered") {
        if (gesture === "fist") {
          updateCard(activeId, { status: "countdown" });
          startCountdown(activeId);
        } else if (gesture !== "open") {
          // Hand left without forming fist
          stopCountdown();
          const hit = hitCard(palmX, palmY);
          if (hit !== activeId) {
            updateCard(activeId, { status: "idle", countdown: 0 });
            activeCardRef.current = null;
            setActiveCardId(null);
            primaryHandRef.current = null;
            setPrimaryHandedness(null);
          }
        }
      } else if (st === "countdown") {
        if (gesture !== "fist") {
          stopCountdown();
          updateCard(activeId, { status: "idle", countdown: 0 });
          activeCardRef.current = null;
          setActiveCardId(null);
          primaryHandRef.current = null;
          setPrimaryHandedness(null);
        }
        // Completion → dragging is handled inside startCountdown's rAF
      } else if (st === "dragging") {
        if (gesture !== "fist") {
          // Release → pin
          updateCard(activeId, { status: "pinned" });
          dragOffsetRef.current = null;
          scaleBaselineRef.current = null;
        } else {
          // Move card — use fist palmCenter as the drag anchor point
          const cardState2 = statesRef.current[activeId]!;
          const defPos = defaultPositions[activeId] ?? { x: 80, y: 80 };
          if (!dragOffsetRef.current) {
            // First drag frame: record offset from fist to card top-left
            const curPos = cardState2.pos ?? defPos;
            dragOffsetRef.current = {
              dx: palmX - curPos.x,
              dy: palmY - curPos.y,
            };
          }
          updateCard(activeId, {
            pos: {
              x: palmX - dragOffsetRef.current.dx,
              y: palmY - dragOffsetRef.current.dy,
            },
          });
        }
      } else if (st === "pinned") {
        // Re-hover when open palm returns
        if (gesture === "open" && hitCard(palmX, palmY) === activeId) {
          updateCard(activeId, { status: "hovered" });
        }
      }

      // ── Secondary hand resize ─────────────────────────────────────────────
      if ((st === "dragging" || st === "pinned") && secondary?.pinching) {
        if (!scaleBaselineRef.current) {
          // Baseline: capture distance when pinch first detected
          scaleBaselineRef.current = secondary.pinchDistance;
        } else {
          const currentScale = statesRef.current[activeId]?.scale ?? 1;
          const ratio = Math.max(0.4, Math.min(3.5, secondary.pinchDistance / scaleBaselineRef.current));
          updateCard(activeId, { scale: ratio });
          setScalePercent(Math.round(ratio * 100));
        }
      } else if (!secondary?.pinching) {
        // Reset baseline when pinch released (allows re-pinch from new position)
        scaleBaselineRef.current = null;
        setScalePercent(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hands]);

  return {
    states,
    getCardState,
    primaryHandedness,
    scalePercent,
    activeCardId,
    primaryHand: hands.find((h) => h.handedness === primaryHandedness) ?? null,
    secondaryHand: hands.find((h) => h.handedness !== primaryHandedness) ?? null,
  };
}

// ─── ARMode ──────────────────────────────────────────────────────────────────
export const ARMode = ({ scenario }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Card refs registry
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setCardRef = (id: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[id] = el;
  };

  const { status, frame, modelReady } = useFaceTracking({
    videoRef, containerRef, enabled: true,
  });

  const { hands } = useHandTracking({
    videoRef, containerRef, enabled: true,
  });

  // ── Stress engine ──────────────────────────────────────────────────────────
  const stressRef = useRef(50);
  const [stress, setStress] = useState(50);
  const [stressTrend, setStressTrend] = useState<"up" | "down" | "flat">("flat");
  const sustainedHighRef = useRef<number | null>(null);
  const [breathingActive, setBreathingActive] = useState(false);

  useEffect(() => {
    if (!frame) return;
    const e = frame.expressions;
    const d = e.happy * -8 + e.angry * 6 + e.fearful * 5 + e.sad * 3 + e.surprised * 1.5 + (e.neutral - 0.5) * 0.5;
    const prev = stressRef.current;
    const next = Math.max(0, Math.min(100, prev * 0.92 + (50 + d * 4) * 0.08));
    stressRef.current = next;
    setStress(next);
    setStressTrend(next > prev + 0.4 ? "up" : next < prev - 0.4 ? "down" : "flat");
  }, [frame]);

  useEffect(() => {
    if (scenario?.id !== "emotional") { setBreathingActive(false); sustainedHighRef.current = null; return; }
    if (stress > 65) {
      if (!sustainedHighRef.current) sustainedHighRef.current = Date.now();
      else if (Date.now() - sustainedHighRef.current > 4000) setBreathingActive(true);
    } else { sustainedHighRef.current = null; if (stress < 45) setBreathingActive(false); }
  }, [stress, scenario]);

  // ── Chart zoom ─────────────────────────────────────────────────────────────
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const [tfIdx, setTfIdx] = useState(2);

  // ── Face anchor ─────────────────────────────────────────────────────────────
  const anchorOffset = useMemo(() => {
    if (!frame || !containerRef.current) return { dx: 0, dy: 0 };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    return {
      dx: (frame.box.x + frame.box.width / 2 - cw / 2) * 0.6,
      dy: (frame.box.y + frame.box.height / 2 - ch / 2) * 0.4,
    };
  }, [frame]);

  const defaultPositions = useMemo(() => ({
    trade:        { x: window.innerWidth - 520, y: 80 },
    learn:        { x: window.innerWidth - 460, y: 80 },
    plan:         { x: window.innerWidth - 440, y: 80 },
    emotional:    { x: window.innerWidth / 2 - 260, y: window.innerHeight - 300 },
    tut_dialogue: { x: window.innerWidth / 2 - 500, y: 150 },
    tut_chart:    { x: window.innerWidth / 2 + 50,  y: 150 },
    tut_opt_a:    { x: window.innerWidth / 2 + 50,  y: 480 },
    tut_opt_b:    { x: window.innerWidth / 2 + 280, y: 480 },
  }), []);

  // ── Gesture system across all cards ────────────────────────────────────────
  const { states, getCardState, primaryHandedness, scalePercent, primaryHand, secondaryHand } =
    useGestureCards(hands, cardRefs, defaultPositions);

  // Mouse drag handler — moves any card directly
  const handleMouseDrag = useCallback((id: string, pos: { x: number; y: number }) => {
    setStatesOverride(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? { status: "pinned" as CardStatus, pos: null, scale: 1, countdown: 0 }), status: "pinned" as CardStatus, pos },
    }));
  }, []);

  const [statesOverride, setStatesOverride] = useState<Record<string, Partial<CardState>>>({});

  const getEffectiveState = useCallback((id: string): CardState => {
    const base = getCardState(id);
    const override = statesOverride[id];
    if (!override) return base;
    // Mouse drag pos wins over gesture pos only when no active hand gesture
    if (base.status === "idle" || base.status === "hovered") {
      return { ...base, pos: override.pos ?? base.pos, status: override.status ?? base.status };
    }
    return base;
  }, [getCardState, statesOverride]);

  // ── Synthetic global cursor for hand pinching ──────────────────────────────
  const prevPinchRef = useRef(false);
  useEffect(() => {
    if (primaryHand) {
      const idx = primaryHand.landmarks[8];
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: idx.x, clientY: idx.y, bubbles: true }));

      const isPinching = primaryHand.isPinching;
      if (isPinching && !prevPinchRef.current) {
        window.dispatchEvent(new MouseEvent("mousedown", { clientX: idx.x, clientY: idx.y, bubbles: true }));
      } else if (!isPinching && prevPinchRef.current) {
        window.dispatchEvent(new MouseEvent("mouseup", { clientX: idx.x, clientY: idx.y, bubbles: true }));
        const el = document.elementFromPoint(idx.x, idx.y);
        if (el) {
          el.dispatchEvent(new MouseEvent("click", { clientX: idx.x, clientY: idx.y, bubbles: true, view: window }));
        }
      }
      prevPinchRef.current = isPinching;
    }
  }, [primaryHand]);

  // Countdown state for ring
  const countdownCard = Object.entries(states).find(([, s]) => s.status === "countdown");
  const countdownState = countdownCard ? countdownCard[1] : null;

  // Zoom badge position (secondary hand pinch midpoint)
  const zoomBadgePos = secondaryHand && scalePercent !== null ? {
    x: (secondaryHand.landmarks[4].x + secondaryHand.landmarks[8].x) / 2,
    y: (secondaryHand.landmarks[4].y + secondaryHand.landmarks[8].y) / 2 - 28,
  } : null;

  return (
    <div ref={containerRef} className="fixed inset-0 bg-background overflow-hidden">
      <video
        ref={videoRef} playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", filter: "brightness(0.8) contrast(1.05) saturate(0.85)" }}
      />
      <div className="absolute inset-0 bg-background/30 pointer-events-none" />

      {status === "denied" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="xr-panel xr-corner p-8 max-w-md text-center">
            <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-3">CAMERA · OFFLINE</div>
            <h3 className="text-xl mb-2">Enable camera to engage AR mode</h3>
            <p className="text-sm text-foreground/60">Allow camera access in your browser, then refresh.</p>
          </div>
        </div>
      )}

      {/* Face mesh */}
      {frame && status === "tracking" && <FaceMesh frame={frame} />}

      {/* Hand overlays */}
      {hands.length > 0 && <HandOverlay hands={hands} primaryHandedness={primaryHandedness} />}

      {/* Countdown ring at palm position */}
      {countdownState && primaryHand && (
        <CountdownRing
          progress={countdownState.countdown}
          x={primaryHand.palmCenter.x}
          y={primaryHand.palmCenter.y}
        />
      )}

      {/* Scale zoom badge at secondary pinch midpoint */}
      {zoomBadgePos && scalePercent !== null && (
        <ZoomBadge percent={scalePercent} x={zoomBadgePos.x} y={zoomBadgePos.y} />
      )}

      {/* ── Cards — each independently gesture-interactive ─────────────────── */}


      {/* Trade card */}
      {scenario?.id === "trade" && (
        <GestureCard
          id="trade"
          ref={(el) => { cardRefs.current["trade"] = el; }}
          defaultPos={defaultPositions.trade}
          activeCardId={null}
          onActivate={() => {}}
          onDeactivate={() => {}}
          onMouseDrag={handleMouseDrag}
          state={getEffectiveState("trade")}
          minWidth={500}
          zBase={31}
        >
          <TradeContent
            zoomX={zoomX} zoomY={zoomY}
            tf={TIMEFRAMES[tfIdx]}
            onTf={(t) => setTfIdx(TIMEFRAMES.indexOf(t))}
            scalePercent={getEffectiveState("trade").status !== "idle" ? scalePercent : null}
          />
        </GestureCard>
      )}

      {/* Learn Tutorial */}
      {scenario?.id === "learn" && (
        <LearnScenarioTutorial
          onMouseDrag={handleMouseDrag}
          getEffectiveState={getEffectiveState}
          cardRefs={cardRefs}
          defaultPositions={defaultPositions}
          scalePercent={scalePercent}
        />
      )}

      {/* Plan card */}
      {scenario?.id === "plan" && (
        <GestureCard
          id="plan"
          ref={(el) => { cardRefs.current["plan"] = el; }}
          defaultPos={defaultPositions.plan}
          activeCardId={null}
          onActivate={() => {}}
          onDeactivate={() => {}}
          onMouseDrag={handleMouseDrag}
          state={getEffectiveState("plan")}
          minWidth={420}
          zBase={31}
        >
          <PlanContent scalePercent={getEffectiveState("plan").status !== "idle" ? scalePercent : null} />
        </GestureCard>
      )}

      {/* Emotional card */}
      {scenario?.id === "emotional" && (
        <GestureCard
          id="emotional"
          ref={(el) => { cardRefs.current["emotional"] = el; }}
          defaultPos={defaultPositions.emotional}
          activeCardId={null}
          onActivate={() => {}}
          onDeactivate={() => {}}
          onMouseDrag={handleMouseDrag}
          state={getEffectiveState("emotional")}
          minWidth={520}
          zBase={31}
        >
          <EmotionalContent
            stress={stress}
            breathingActive={breathingActive}
            expressions={frame?.expressions}
            scalePercent={getEffectiveState("emotional").status !== "idle" ? scalePercent : null}
          />
        </GestureCard>
      )}

      {/* Status hints */}
      {status === "no-face" && modelReady && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.3em] text-foreground/50 animate-pulse-soft">
          [ SCANNING FOR SUBJECT ]
        </div>
      )}
      {!modelReady && status !== "denied" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.3em] text-foreground/50 animate-pulse-soft">
          [ LOADING NEURAL MODELS ]
        </div>
      )}
      {hands.length === 0 && status === "tracking" && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-foreground/40 animate-pulse-soft text-center">
          [ OPEN HAND OVER CARD → SELECT · FIST 2s → GRAB · SECOND HAND PINCH → SCALE ]
        </div>
      )}

      {/* Vignette */}
      <div className="xr-vignette" />
    </div>
  );
};

// ─── Learn Tutorial Content ──────────────────────────────────────────────────

const UPTREND_CANDLES: Candle[] = [
  { t: 0, o: 60000, h: 60500, l: 59800, c: 60300, v: 100 },
  { t: 1, o: 60300, h: 60800, l: 60200, c: 60700, v: 120 }, // HH
  { t: 2, o: 60700, h: 60750, l: 60400, c: 60500, v: 90 },  // HL
  { t: 3, o: 60500, h: 61200, l: 60450, c: 61100, v: 150 }, // HH
  { t: 4, o: 61100, h: 61150, l: 60800, c: 60900, v: 100 }, // HL
  { t: 5, o: 60900, h: 61600, l: 60850, c: 61500, v: 180 }, // HH
];

const BOS_CANDLES: Candle[] = [
  ...UPTREND_CANDLES,
  { t: 6, o: 61500, h: 61550, l: 60700, c: 60800, v: 200 }, // BREAKS HL
  { t: 7, o: 60800, h: 60900, l: 60200, c: 60300, v: 220 }, // CONFIRMATION
];

const LearnScenarioTutorial = ({ 
  onMouseDrag, 
  getEffectiveState, 
  cardRefs, 
  defaultPositions,
  scalePercent
}: { 
  onMouseDrag: (id: string, pos: { x: number; y: number }) => void,
  getEffectiveState: (id: string) => CardState,
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  defaultPositions: any,
  scalePercent: number | null
}) => {
  const [step, setStep] = useState(0);

  return (
    <>
      <GestureCard
        id="tut_dialogue"
        ref={(el) => { cardRefs.current["tut_dialogue"] = el; }}
        defaultPos={defaultPositions.tut_dialogue}
        activeCardId={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onMouseDrag={onMouseDrag}
        state={getEffectiveState("tut_dialogue")}
        minWidth={380}
        zBase={40}
      >
        <div className="p-2">
          <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 mb-3">SENSEI · TUTORIAL</div>
          
          {step === 0 && (
            <div className="animate-fade-in">
              <h3 className="text-lg mb-2">Market Structure 101</h3>
              <p className="text-sm text-foreground/70 mb-4">
                "Welcome trader. Markets don't move in straight lines. They breathe. Let's start with an uptrend."
              </p>
              <button 
                onClick={() => setStep(1)}
                className="w-full py-2 xr-hairline font-mono text-[10px] tracking-[0.2em] hover:bg-foreground hover:text-background transition-colors pointer-events-auto"
              >
                [ REVEAL UPTREND ]
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <h3 className="text-lg mb-2">Identifying HH & HL</h3>
              <p className="text-sm text-foreground/70 mb-4">
                "Notice the Higher Highs (HH) and Higher Lows (HL). As long as we keep making these, the trend is up."
              </p>
              <button 
                onClick={() => setStep(2)}
                className="w-full py-2 xr-hairline font-mono text-[10px] tracking-[0.2em] hover:bg-foreground hover:text-background transition-colors pointer-events-auto"
              >
                [ WATCH THE REVERSAL ]
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h3 className="text-lg mb-2">Interactive Choice</h3>
              <p className="text-sm text-foreground/70 mb-4">
                "Price just crashed through the previous Higher Low. What is this called?"
              </p>
              <div className="space-y-2">
                <button 
                  onClick={() => setStep(3)}
                  className="w-full py-2 xr-hairline border-success/40 text-success font-mono text-[10px] tracking-[0.2em] hover:bg-success/10 transition-colors pointer-events-auto"
                >
                  [ BREAK OF STRUCTURE ]
                </button>
                <button 
                  onClick={() => alert("Incorrect. A pullback stays above HH.")}
                  className="w-full py-2 xr-hairline font-mono text-[10px] tracking-[0.2em] hover:bg-foreground/5 transition-colors pointer-events-auto text-foreground/40"
                >
                  [ NORMAL PULLBACK ]
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h3 className="text-lg mb-2 text-success">Mastered!</h3>
              <p className="text-sm text-foreground/70 mb-4">
                "Correct. A Break of Structure (BoS) signals a shift in momentum. You're ready to trade the reversal."
              </p>
              <button 
                onClick={() => setStep(0)}
                className="w-full py-2 xr-hairline font-mono text-[10px] tracking-[0.2em] hover:bg-foreground hover:text-background transition-colors pointer-events-auto"
              >
                [ RESTART LESSON ]
              </button>
            </div>
          )}
        </div>
      </GestureCard>

      <GestureCard
        id="tut_chart"
        ref={(el) => { cardRefs.current["tut_chart"] = el; }}
        defaultPos={defaultPositions.tut_chart}
        activeCardId={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onMouseDrag={onMouseDrag}
        state={getEffectiveState("tut_chart")}
        minWidth={450}
        zBase={35}
      >
        <div className="relative">
          <div className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.2em] text-foreground/40 z-10">
            SIMULATED FEED · {step < 2 ? "UPTREND" : "REVERSAL"}
          </div>
          <CandlestickChart 
            timeframe="15m" 
            height={220} 
            staticCandles={step < 2 ? UPTREND_CANDLES : BOS_CANDLES}
            zoomX={1.5}
          />
          {step === 1 && (
            <div className="absolute inset-0 pointer-events-none font-mono text-[8px]">
              <div className="absolute top-[20%] left-[25%] text-success animate-pulse">HH</div>
              <div className="absolute top-[50%] left-[40%] text-success/60">HL</div>
              <div className="absolute top-[10%] left-[60%] text-success animate-pulse">HH</div>
            </div>
          )}
          {step >= 2 && (
            <div className="absolute bottom-[20%] left-[70%] text-destructive font-mono text-[8px] animate-bounce">
              BOS ▼
            </div>
          )}
        </div>
      </GestureCard>
    </>
  );
};


// ─── Card content components ──────────────────────────────────────────────────

const SubjectContent = ({
  stress, stressTrend, scalePercent,
}: { stress: number; stressTrend: string; scalePercent: number | null }) => {
  const label = stress > 65 ? "HIGH" : stress > 45 ? "ELEVATED" : "LOW";
  const cls = stress > 65 ? "text-destructive" : stress > 45 ? "text-foreground" : "text-success";
  return (
    <>
      <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 mb-1">SUBJECT · LOCKED</div>
      <div className="text-base font-medium mb-3">Trader_01</div>
      <div className="font-mono text-[11px] text-foreground/70 space-y-1.5">
        <div className="flex justify-between gap-6"><span className="text-foreground/50">FOCUS</span><span>{Math.round(100 - stress * 0.7)}%</span></div>
        <div className="flex justify-between gap-6">
          <span className="text-foreground/50">STRESS</span>
          <span className={cls}>{label} {stressTrend === "up" ? "↑" : stressTrend === "down" ? "↓" : "·"} {Math.round(stress)}</span>
        </div>
        <div className="flex justify-between gap-6"><span className="text-foreground/50">SESSION</span><span>02:14:08</span></div>
      </div>
      <div className="mt-3 h-px w-full bg-foreground/10">
        <div className="h-full transition-all duration-300" style={{
          width: `${stress}%`,
          background: stress > 65 ? "hsl(var(--destructive))" : stress > 45 ? "hsl(var(--foreground))" : "hsl(var(--success))",
        }} />
      </div>
      {scalePercent !== null && (
        <div className="mt-2 font-mono text-[8px] tracking-[0.2em] text-success border-t border-foreground/10 pt-1.5">SCALE · {scalePercent}%</div>
      )}
    </>
  );
};

const TradeContent = ({
  zoomX, zoomY, tf, onTf, scalePercent,
}: { zoomX: number; zoomY: number; tf: Timeframe; onTf: (t: Timeframe) => void; scalePercent: number | null }) => (
  <>
    <div className="flex items-center justify-between mb-3">
      <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60">CHART · DETECTED</div>
      <div className="flex gap-1.5 pointer-events-auto">
        {TIMEFRAMES.map((t) => (
          <button key={t} onClick={() => onTf(t)}
            className={`font-mono text-[10px] px-2 py-0.5 ${tf === t ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
    <CandlestickChart timeframe={tf} zoomX={zoomX} zoomY={zoomY} height={260} tpPrice={69200} slPrice={66800} />
    <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-[10px] text-foreground/60">
      <div>ZOOM-X · {zoomX.toFixed(2)}×</div>
      <div>ZOOM-Y · {zoomY.toFixed(2)}×</div>
      <div className="text-right">EMA 9 / 21</div>
    </div>
    <div className="mt-3 font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-1">SENSEI · RECOMMENDATION</div>
    <div className="text-sm leading-relaxed">EMA9 above EMA21 · momentum confirmed. R:R 2.87 · size 1.2% account.</div>
    {scalePercent !== null && <div className="mt-2 font-mono text-[8px] tracking-[0.2em] text-success border-t border-foreground/10 pt-1.5">SCALE · {scalePercent}%</div>}
  </>
);

const LearnContent = ({ scalePercent }: { scalePercent: number | null }) => (
  <>
    <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2">LESSON · INLINE</div>
    <h3 className="text-base mb-2">EMA Crossover Basics</h3>
    <p className="text-sm text-foreground/70 leading-relaxed">
      When the fast EMA (9) crosses above the slow EMA (21), momentum has shifted up. Sensei marks these crosses on your live chart.
    </p>
    {scalePercent !== null && <div className="mt-2 font-mono text-[8px] tracking-[0.2em] text-success border-t border-foreground/10 pt-1.5">SCALE · {scalePercent}%</div>}
  </>
);

const PlanContent = ({ scalePercent }: { scalePercent: number | null }) => (
  <>
    <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2">QUICK PLAN</div>
    <p className="text-sm text-foreground/70 leading-relaxed">
      Switch to VR for the full strategy planner — Sensei will simulate your EMA crossover edge against 5 years of data.
    </p>
    {scalePercent !== null && <div className="mt-2 font-mono text-[8px] tracking-[0.2em] text-success border-t border-foreground/10 pt-1.5">SCALE · {scalePercent}%</div>}
  </>
);

const EmotionalContent = ({
  stress, breathingActive, expressions, scalePercent,
}: {
  stress: number; breathingActive: boolean;
  expressions?: { happy: number; angry: number; sad: number; neutral: number; surprised: number; fearful: number; disgusted: number };
  scalePercent: number | null;
}) => (
  breathingActive ? <BreathingPanel /> : (
    <>
      <div className="font-mono text-[10px] tracking-[0.3em] mb-2" style={{ color: stress > 65 ? "hsl(var(--destructive))" : undefined }}>
        {stress > 65 ? "◆ STRESS · ELEVATED" : stress < 40 ? "◆ BASELINE · CALM" : "◆ MONITORING"}
      </div>
      <p className="text-sm text-foreground/80 mb-3">
        {stress > 65 ? "Smile to reset. High-risk trades blocked." : stress < 40 ? "You're in flow. Restrictions lifted." : "Calibrating baseline. Smile when ready."}
      </p>
      {expressions && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2">
          {([["HAPPY", expressions.happy], ["NEUTRAL", expressions.neutral], ["ANGRY", expressions.angry],
            ["SAD", expressions.sad], ["FEAR", expressions.fearful], ["SURP", expressions.surprised]] as [string, number][]).map(([k, v]) => (
            <div key={k} className="font-mono text-[9px]">
              <div className="flex justify-between text-foreground/50"><span>{k}</span><span>{Math.round(v * 100)}</span></div>
              <div className="h-0.5 bg-foreground/10"><div className="h-full bg-foreground" style={{ width: `${Math.round(v * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {scalePercent !== null && <div className="mt-2 font-mono text-[8px] tracking-[0.2em] text-success border-t border-foreground/10 pt-1.5">SCALE · {scalePercent}%</div>}
    </>
  )
);

const BreathingPanel = () => {
  const [phase, setPhase] = useState<"INHALE" | "HOLD" | "EXHALE">("INHALE");
  useEffect(() => {
    const seq: ["INHALE" | "HOLD" | "EXHALE", number][] = [["INHALE", 4000], ["HOLD", 4000], ["EXHALE", 6000]];
    let i = 0; setPhase(seq[0][0]);
    const id = setInterval(() => { i = (i + 1) % seq.length; setPhase(seq[i][0]); }, 4666);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center">
      <div className="font-mono text-[10px] tracking-[0.3em] text-destructive mb-3">◆ INTERVENTION · BREATHE</div>
      <div className="relative w-28 h-28 mx-auto mb-3">
        <div className="absolute inset-0 rounded-full border border-foreground/60 transition-transform duration-[3500ms] ease-in-out"
          style={{ transform: `scale(${phase === "EXHALE" ? 0.6 : 1})` }} />
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.3em]">{phase}</div>
      </div>
      <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60">INHALE 4 · HOLD 4 · EXHALE 6</div>
    </div>
  );
};
