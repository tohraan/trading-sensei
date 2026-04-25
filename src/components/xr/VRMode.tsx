import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Scenario, SCENARIOS } from "./scenarios";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { useHandTracking } from "@/hooks/useHandTracking";
import { CandlestickChart, Timeframe } from "./CandlestickChart";
import { FaceMesh } from "./FaceMesh";
import { HandOverlay } from "./HandOverlay";

interface Props {
  scenario: Scenario | null;
  onScenarioChange?: (s: Scenario | null) => void;
}

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D"];
type QuadrantId = "chart" | "news" | "ledger" | "cam";
const QUICK_PINCH_MS = 350; // max ms for a pinch to count as a "click"
const GRAB_HOLD_MS = 2000;

// ─── CountdownRing ────────────────────────────────────────────────────────────
const CountdownRing = ({ progress, x, y }: { progress: number; x: number; y: number }) => {
  const r = 24;
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

// ─── VRMode ──────────────────────────────────────────────────────────────────
export const VRMode = ({ scenario, onScenarioChange }: Props) => {
  // ── Sidebar ──────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(scenario);
  
  // Sync prop changes -> local
  useEffect(() => { setActiveScenario(scenario); }, [scenario]);
  // Sync local -> parent
  const updateScenario = useCallback((s: Scenario | null) => {
    setActiveScenario(s);
    if (onScenarioChange) onScenarioChange(s);
  }, [onScenarioChange]);

  // ── Camera / tracking ───────────────────────────────────────────────
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    let s: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false })
      .then((stream) => {
        s = stream;
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          hiddenVideoRef.current.play().catch(() => {});
        }
        setCamReady(true);
      })
      .catch(() => {});
    return () => { s?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const { frame } = useFaceTracking({
    videoRef: hiddenVideoRef,
    containerRef,
    enabled: camReady,
  });

  const { hands } = useHandTracking({
    videoRef: hiddenVideoRef,
    containerRef,
    enabled: camReady,
  });

  // ── Quadrant refs & hover/select state ───────────────────────────────────
  const quadRefs = useRef<Record<QuadrantId, HTMLDivElement | null>>({
    chart: null, news: null, ledger: null, cam: null,
  });
  const [hoveredQuad, setHoveredQuad] = useState<QuadrantId | null>(null);
  const [selectedQuad, setSelectedQuad] = useState<QuadrantId | null>(null);
  const selectedQuadRef = useRef<QuadrantId | null>(null);

  // ── Chart state ──────────────────────────────────────────────────────────
  const [tfIdx, setTfIdx] = useState(2); // default 15m
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);

  // Gesture refs
  const primaryHandRef = useRef<"Left" | "Right" | null>(null);
  const pinchStartTimeRef = useRef<number | null>(null);
  const pinchActiveRef = useRef(false);
  const zoomBaselineRef = useRef<number | null>(null);

  // Timer refs
  const timerRafRef = useRef(0);
  const timerStartRef = useRef<number | null>(null);
  const [timerProgress, setTimerProgress] = useState<number | null>(null);
  const timerTargetRef = useRef<{ action: "select" | "deselect", quad: QuadrantId } | null>(null);

  const startTimer = useCallback((action: "select" | "deselect", quad: QuadrantId) => {
    cancelAnimationFrame(timerRafRef.current);
    timerTargetRef.current = { action, quad };
    timerStartRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - (timerStartRef.current ?? now);
      const p = Math.min(1, elapsed / GRAB_HOLD_MS);
      setTimerProgress(p);
      if (p < 1) {
        timerRafRef.current = requestAnimationFrame(tick);
      } else {
        // Complete
        if (timerTargetRef.current?.action === "select") {
          selectedQuadRef.current = timerTargetRef.current.quad;
          setSelectedQuad(timerTargetRef.current.quad);
        } else if (timerTargetRef.current?.action === "deselect") {
          selectedQuadRef.current = null;
          setSelectedQuad(null);
          primaryHandRef.current = null;
        }
        setTimerProgress(null);
        timerTargetRef.current = null;
      }
    };
    timerRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTimer = useCallback(() => {
    cancelAnimationFrame(timerRafRef.current);
    timerStartRef.current = null;
    timerTargetRef.current = null;
    setTimerProgress(null);
  }, []);

  // Hit test: returns which quadrant a point is inside
  const hitQuad = useCallback((x: number, y: number): QuadrantId | null => {
    for (const [id, el] of Object.entries(quadRefs.current) as [QuadrantId, HTMLDivElement | null][]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  // Main gesture loop
  useEffect(() => {
    if (!hands.length) {
      setHoveredQuad(null);
      zoomBaselineRef.current = null;
      pinchStartTimeRef.current = null;
      pinchActiveRef.current = false;
      stopTimer();
      return;
    }

    // Primary hand identification
    let primary = primaryHandRef.current
      ? hands.find((h) => h.handedness === primaryHandRef.current)
      : undefined;
    let secondary = primaryHandRef.current
      ? hands.find((h) => h.handedness !== primaryHandRef.current)
      : undefined;
    if (!primary) {
      primary = hands.find((h) => h.gesture === "open" || h.gesture === "fist") ?? hands[0];
      secondary = hands.find((h) => h !== primary);
    }
    if (!primary) return;

    const palmX = primary.palmCenter.x;
    const palmY = primary.palmCenter.y;
    const gesture = primary.gesture;
    const sel = selectedQuadRef.current;

    // ── Timer logic updates ──────────────────────────────────────────────
    if (timerTargetRef.current) {
      const over = hitQuad(palmX, palmY);
      // If we stop making a fist, or we move away from target, abort
      if (gesture !== "fist" || (timerTargetRef.current.action === "select" && over !== timerTargetRef.current.quad)) {
        stopTimer();
      }
    } else {
      if (sel) {
        // A quadrant is selected. Hand tracking for *selection* stops.
        setHoveredQuad(null);
        // Deselect triggers when fist formed anywhere (or over the panel)
        if (gesture === "fist" && !timerTargetRef.current) {
          primaryHandRef.current = primary.handedness;
          startTimer("deselect", sel);
        }
      } else {
        // Nothing selected -> normal hover logic
        const over = hitQuad(palmX, palmY);
        setHoveredQuad(over);

        if (gesture === "fist" && over && !timerTargetRef.current) {
          primaryHandRef.current = primary.handedness;
          startTimer("select", over);
        }
      }
    }

    // ── Chart-specific gestures (only when chart is selected) ─────────────
    if (sel === "chart" && !timerTargetRef.current) {
      // Quick pinch → next timeframe (only primary hand pinch)
      const isPinching = primary.pinching;
      if (isPinching && !pinchActiveRef.current) {
        pinchActiveRef.current = true;
        pinchStartTimeRef.current = Date.now();
      } else if (!isPinching && pinchActiveRef.current) {
        // Pinch released
        const elapsed = Date.now() - (pinchStartTimeRef.current ?? 0);
        if (elapsed < QUICK_PINCH_MS) {
          // Quick click → next timeframe
          setTfIdx((prev) => (prev + 1) % TIMEFRAMES.length);
        }
        pinchActiveRef.current = false;
        pinchStartTimeRef.current = null;
      }

      // Fist (primary) + secondary hand pinch/spread → zoom
      if (gesture === "fist" && secondary) {
        const secDist = secondary.pinchDistance;
        if (secondary.pinching || secDist < 150) {
          // Secondary hand is gesturing — use distance as rolling zoom
          if (!zoomBaselineRef.current) {
            zoomBaselineRef.current = secDist;
          } else {
            const delta = secDist - zoomBaselineRef.current;
            zoomBaselineRef.current = secDist; // rolling update for smooth feel
            const SENSITIVITY = 0.008;
            if (Math.abs(delta) > 1) {
              // Note: the component takes zoomX and zoomY together
              // We'll scale both zoom properties symmetrically for simplified interaction
              setZoomX((prev) => Math.max(0.5, Math.min(4, prev + delta * SENSITIVITY)));
              setZoomY((prev) => Math.max(0.5, Math.min(4, prev + delta * SENSITIVITY)));
            }
          }
        } else {
          zoomBaselineRef.current = null;
        }
      } else {
        zoomBaselineRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hands, hitQuad, startTimer, stopTimer]);

  // ── Gesture hint text ─────────────────────────────────────────────────────
  const gestureHint = useMemo(() => {
    if (!hands.length) return "[ RAISE HAND TO INTERACT ]";
    if (timerProgress !== null) return `[ HOLD FIST TO ${timerTargetRef.current?.action.toUpperCase()} ]`;
    const primary = hands.find((h) => h.gesture === "open" || h.gesture === "fist") ?? hands[0];
    if (!primary) return "";
    if (primary.gesture === "open") return hoveredQuad ? `[ HOLD FIST 2s TO SELECT ${hoveredQuad.toUpperCase()} ]` : "[ OPEN HAND · HOVER A PANEL ]";
    if (primary.gesture === "fist" && selectedQuad === "chart") return "[ CHART SELECTED · QUICK PINCH = TF · 2ND HAND SEC PULL = ZOOM ]";
    if (primary.gesture === "fist") return `[ ${selectedQuad?.toUpperCase() ?? ""} SELECTED · HOLD FIST 2s TO DESELECT ]`;
    return "";
  }, [hands, hoveredQuad, selectedQuad, timerProgress]);

  // Deselect on open hand away from panels
  const handleDeselect = () => {
    selectedQuadRef.current = null;
    setSelectedQuad(null);
    primaryHandRef.current = null;
    stopTimer();
  };

  const isTradeActive = !activeScenario || activeScenario.id === "trade";

  return (
    <div ref={containerRef} className="fixed inset-0 vr-space overflow-hidden flex">
      {/* Hidden full-screen video for tracking projection mapping */}
      <video
        ref={hiddenVideoRef}
        playsInline muted
        className="absolute opacity-0 pointer-events-none"
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", zIndex: -1 }}
      />
      
      {/* Countdown Ring overlay */}
      {timerProgress !== null && primaryHandRef.current && (
        <CountdownRing 
           progress={timerProgress} 
           x={hands.find(h => h.handedness === primaryHandRef.current)?.palmCenter.x ?? 0}
           y={hands.find(h => h.handedness === primaryHandRef.current)?.palmCenter.y ?? 0}
        />
      )}

      {/* Ambient grid lines */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/10 pointer-events-none" />
      <div className="absolute inset-x-0 top-[40%] h-px bg-foreground/[0.04] pointer-events-none" />
      <div className="absolute inset-x-0 top-[60%] h-px bg-foreground/[0.04] pointer-events-none" />
      <Particles />

      {/* ── Collapsible Left Sidebar ────────────────────────────────────── */}
      <div
        className="relative flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden border-r border-foreground/10"
        style={{ width: sidebarOpen ? 220 : 40, background: "hsl(0 0% 4% / 0.85)", backdropFilter: "blur(12px)", zIndex: 10 }}
      >
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex items-center justify-between px-3 py-4 border-b border-foreground/10 hover:bg-foreground/5 transition-colors"
        >
          {sidebarOpen && (
            <span className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 uppercase">Scenarios</span>
          )}
          <span className="text-foreground/60 text-sm ml-auto">{sidebarOpen ? "◀" : "▶"}</span>
        </button>

        <div className="flex-1 overflow-y-auto py-2">
          {SCENARIOS.map((s) => {
            const isActive = activeScenario?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => updateScenario(isActive ? null : s)}
                className={`w-full text-left transition-all ${
                  isActive ? "bg-foreground/10 border-l-2 border-foreground" : "border-l-2 border-transparent hover:bg-foreground/5"
                }`}
                style={{ padding: sidebarOpen ? "10px 14px" : "10px 10px" }}
                title={!sidebarOpen ? s.label : undefined}
              >
                {sidebarOpen ? (
                  <>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-[8px] tracking-[0.25em] text-foreground/40">{s.preferredMode}</span>
                      {isActive && <span className="w-1 h-1 rounded-full bg-foreground animate-pulse-soft" />}
                    </div>
                    <div className="text-[12px] font-medium leading-tight">{s.label}</div>
                    <div className="text-[10px] text-foreground/40 mt-0.5 leading-snug">{s.description}</div>
                  </>
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-foreground/20 mx-auto flex items-center justify-center">
                    <span className="text-[8px] font-mono">{s.label[0]}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {selectedQuad && sidebarOpen && (
          <button
            onClick={handleDeselect}
            className="px-3 py-2 font-mono text-[8px] tracking-[0.2em] text-foreground/30 hover:text-foreground border-t border-foreground/10 transition-colors"
          >
            × CLEAR SELECTION
          </button>
        )}
      </div>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-foreground/10" style={{ background: "hsl(0 0% 4% / 0.6)" }}>
          <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60">
            TRADING SENSEI · VR · {activeScenario ? activeScenario.label.toUpperCase() : "OVERVIEW"}
          </div>
          <div className="flex items-center gap-4">
            {(!activeScenario || !["trade"].includes(activeScenario.id ?? "")) && (
              <div className="flex gap-2">
                {[
                  { id: "learn", label: "LEARN" },
                  { id: "plan", label: "PLAN" },
                  { id: "trade", label: "TRADE" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => updateScenario(SCENARIOS.find((s) => s.id === tab.id) ?? null)}
                    className={`font-mono text-[9px] px-3 py-1 tracking-[0.2em] xr-panel transition-all ${
                      activeScenario?.id === tab.id ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <div className="font-mono text-[9px] tracking-[0.2em] text-foreground/30">v0.4.1</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {(isTradeActive) && (
            <TradeSimulator
              quadRefs={quadRefs}
              hoveredQuad={hoveredQuad}
              selectedQuad={selectedQuad}
              tfIdx={tfIdx}
              setTfIdx={setTfIdx}
              zoomX={zoomX}
              zoomY={zoomY}
              setZoomX={setZoomX}
              setZoomY={setZoomY}
              hiddenVideoRef={hiddenVideoRef}
              camReady={camReady}
              frame={frame}
              hands={hands}
            />
          )}
          {activeScenario?.id === "learn" && <LearnPanel onNavigate={(id) => updateScenario(SCENARIOS.find(s => s.id === id) ?? null)} />}
          {activeScenario?.id === "plan" && <PlanPanel />}
        </div>

        {/* Gesture hint bar */}
        {gestureHint && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.3em] text-foreground/40 animate-pulse-soft pointer-events-none">
            {gestureHint}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TradeSimulator — 4-quadrant layout ──────────────────────────────────────
interface TradeSimulatorProps {
  quadRefs: React.MutableRefObject<Record<QuadrantId, HTMLDivElement | null>>;
  hoveredQuad: QuadrantId | null;
  selectedQuad: QuadrantId | null;
  tfIdx: number;
  setTfIdx: (n: number) => void;
  zoomX: number;
  zoomY: number;
  setZoomX: (n: number) => void;
  setZoomY: (n: number) => void;
  hiddenVideoRef: React.RefObject<HTMLVideoElement>;
  camReady: boolean;
  frame: any;
  hands: any[];
}

const TradeSimulator = ({
  quadRefs, hoveredQuad, selectedQuad,
  tfIdx, setTfIdx, zoomX, zoomY, setZoomX, setZoomY,
  hiddenVideoRef, camReady, frame, hands,
}: TradeSimulatorProps) => {
  const tf = TIMEFRAMES[tfIdx];

  const quadStyle = (id: QuadrantId) => {
    const isHov = hoveredQuad === id;
    const isSel = selectedQuad === id;
    return {
      boxShadow: isSel
        ? "0 0 0 1.5px hsl(var(--success) / 0.9), inset 0 0 20px hsl(var(--success) / 0.08)"
        : isHov
        ? "0 0 0 1px rgba(255,255,255,0.7)"
        : "0 0 0 1px rgba(255,255,255,0.08)",
      transition: "box-shadow 120ms ease",
    };
  };

  // Webcam projection calculation (match the full screen video but clipped)
  const quadW = quadRefs.current.cam?.clientWidth ?? 0;
  const quadH = quadRefs.current.cam?.clientHeight ?? 0;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
  // Use cover math to seamlessly map full viewport to this div
  const scale = quadW && quadH ? Math.max(quadW / winW, quadH / winH) : 1;

  // We unify zoom controls visually into a single slider representation
  const unifiedZoom = (zoomX + zoomY) / 2;
  const setUnifiedZoom = (val: number) => {
     setZoomX(val);
     setZoomY(val);
  };

  return (
    <div className="absolute inset-0 p-3 grid grid-cols-2 grid-rows-2 gap-3">
      {/* ── TOP-LEFT: Chart ─────────────────────────────────────────────── */}
      <div
        ref={(el) => { quadRefs.current.chart = el; }}
        className="xr-panel xr-corner p-4 flex flex-col overflow-hidden relative"
        style={quadStyle("chart")}
      >
        {selectedQuad === "chart" && (
          <div className="absolute top-2 right-2 font-mono text-[7px] tracking-[0.2em] text-success z-10">◆ SELECTED</div>
        )}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/60">BTC / USD · LIVE</div>
            <div className="font-mono text-[8px] text-foreground/30 mt-0.5">EMA 9/21 · TP 69,200 · SL 66,800</div>
          </div>
          <div className="flex gap-1">
            {TIMEFRAMES.map((t, i) => (
              <button
                key={t}
                onClick={() => setTfIdx(i)}
                className={`font-mono text-[9px] px-1.5 py-0.5 transition-all ${
                  tf === t ? "bg-foreground text-background" : "text-foreground/40 hover:text-foreground xr-hairline"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <CandlestickChart
            timeframe={tf}
            zoomX={zoomX}
            zoomY={zoomY}
            height={220}
            tpPrice={69200}
            slPrice={66800}
            showEMA={[9, 21]}
          />
        </div>
        <div className="flex gap-4 mt-2 flex-shrink-0">
          <div className="flex-1 max-w-[200px]">
            <div className="flex justify-between font-mono text-[7px] text-foreground/30 mb-1">
              <span>ZOOM SPREAD</span><span>{unifiedZoom.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.5} max={4} step={0.05} value={unifiedZoom}
              onChange={(e) => setUnifiedZoom(Number(e.target.value))}
              className="w-full accent-foreground h-0.5 opacity-50" />
          </div>
        </div>
      </div>

      {/* ── TOP-RIGHT: News ─────────────────────────────────────────────── */}
      <div
        ref={(el) => { quadRefs.current.news = el; }}
        className="xr-panel xr-corner p-4 flex flex-col overflow-hidden relative"
        style={quadStyle("news")}
      >
        {selectedQuad === "news" && (
          <div className="absolute top-2 right-2 font-mono text-[7px] tracking-[0.2em] text-success">◆ SELECTED</div>
        )}
        <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/60 mb-3 flex-shrink-0">
          ECONOMIC & GEOPOLITICAL FEED
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {NEWS_ITEMS.map((item, i) => (
            <div key={i} className="border-l-2 pl-3 py-1"
              style={{ borderColor: item.sentiment === "bullish" ? "hsl(var(--success))" : item.sentiment === "bearish" ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.2)" }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-[8px] tracking-[0.2em] text-foreground/40">{item.source} · {item.time}</span>
                <span className={`font-mono text-[7px] px-1 ${
                  item.sentiment === "bullish" ? "text-success" : item.sentiment === "bearish" ? "text-destructive" : "text-foreground/40"
                }`}>
                  {item.sentiment.toUpperCase()}
                </span>
              </div>
              <div className="text-[11px] leading-snug">{item.headline}</div>
              <div className="text-[10px] text-foreground/40 mt-1 leading-snug">{item.summary}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM-LEFT: Ledger ─────────────────────────────────────────── */}
      <div
        ref={(el) => { quadRefs.current.ledger = el; }}
        className="xr-panel xr-corner p-4 flex flex-col overflow-hidden relative"
        style={quadStyle("ledger")}
      >
        {selectedQuad === "ledger" && (
          <div className="absolute top-2 right-2 font-mono text-[7px] tracking-[0.2em] text-success">◆ SELECTED</div>
        )}
        <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/60 mb-3 flex-shrink-0">
          DEMO ACCOUNT LEDGER
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
          {[
            ["BALANCE", "$25,284", "text-foreground"],
            ["P/L TODAY", "+$1,284", "text-success"],
            ["DRAWDOWN", "−2.1%", "text-foreground/60"],
          ].map(([k, v, c]) => (
            <div key={k} className="xr-hairline p-2">
              <div className="font-mono text-[7px] tracking-[0.2em] text-foreground/40 mb-1">{k}</div>
              <div className={`font-mono text-sm ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="font-mono text-[8px] tracking-[0.2em] text-foreground/40 mb-1.5 flex-shrink-0">OPEN POSITIONS</div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {POSITIONS.map((p, i) => (
            <div key={i} className="flex items-center justify-between xr-hairline px-3 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[8px] px-1 ${p.side === "LONG" ? "text-success" : "text-destructive"}`}>{p.side}</span>
                <span className="font-mono">{p.pair}</span>
              </div>
              <div className="flex gap-4 font-mono text-[10px]">
                <span className="text-foreground/40">{p.size}</span>
                <span className="text-foreground/40">{p.entry}</span>
                <span className={p.pnl.startsWith("+") ? "text-success" : "text-destructive"}>{p.pnl}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 flex-shrink-0">
          <button className="flex-1 py-2 font-mono text-[9px] tracking-[0.2em] bg-success/20 border border-success/40 text-success hover:bg-success/30 transition-colors">
            BUY / LONG
          </button>
          <button className="flex-1 py-2 font-mono text-[9px] tracking-[0.2em] bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 transition-colors">
            SELL / SHORT
          </button>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: Webcam ─────────────────────────────────────────── */}
      <div
        ref={(el) => { quadRefs.current.cam = el; }}
        className="xr-panel xr-corner overflow-hidden relative"
        style={quadStyle("cam")}
      >
        {selectedQuad === "cam" && (
          <div className="absolute top-2 right-2 font-mono text-[7px] tracking-[0.2em] text-success z-20">◆ SELECTED</div>
        )}
        <div className="absolute top-2 left-3 font-mono text-[9px] tracking-[0.3em] text-foreground/60 z-20">
          TRADER FEED
        </div>
        {camReady ? (
          <div 
             className="absolute pointer-events-none"
             style={{
               width: winW, height: winH,
               transform: `scale(${scale})`, transformOrigin: "top left",
               top: (quadH - winH * scale) / 2, left: (quadW - winW * scale) / 2,
               filter: selectedQuad === "cam" ? 'brightness(1.0) contrast(1.1)' : 'brightness(0.7) contrast(1.05) grayscale(20%)',
             }}>
             {/* Feed the exact hidden video representation with same styling */}
             <video ref={(el) => {
                 if (el && hiddenVideoRef.current && el.srcObject !== hiddenVideoRef.current.srcObject) {
                   el.srcObject = hiddenVideoRef.current.srcObject;
                   el.play().catch(() => {});
                 }
               }} 
               playsInline muted 
               className="w-full h-full object-cover" 
               style={{ transform: "scaleX(-1)" }} />
             {/* Overlays properly scaled into this container context */}
             {frame && <FaceMesh frame={frame} />}
             <HandOverlay hands={hands} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/30 animate-pulse-soft">
              [ CAMERA INITIALISING ]
            </div>
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "linear-gradient(to bottom, hsl(0 0% 0% / 0.4) 0%, transparent 20%, transparent 80%, hsl(0 0% 0% / 0.4) 100%)" }} />
      </div>
    </div>
  );
};

// ─── Learn Panel (Bento Grid Layout) ──────────────────────────────────────────
const LearnPanel = ({ onNavigate }: { onNavigate: (id: string) => void }) => (
  <div className="absolute inset-0 p-6 flex flex-col">
    <div className="w-full h-full animate-fade-in flex flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-3xl font-light tracking-wide mb-1">Start Learning</h2>
        <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/50">CHOOSE YOUR TRAINING PATH</div>
      </div>
      
      <div className="grid grid-cols-4 grid-rows-3 gap-4 flex-1 min-h-0">
        
        {/* Bento Item 1: The Guidebook (Hero) */}
        <div className="col-span-2 row-span-2 xr-panel xr-corner group relative overflow-hidden flex flex-col justify-end p-6 hover:border-foreground/40 transition-colors cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
          <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none" 
               style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          
          <div className="relative z-20">
            <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse-soft" />
              THE GUIDEBOOK
            </div>
            <h3 className="text-2xl mb-2">Master the Fundamentals</h3>
            <p className="text-sm text-foreground/70 mb-4 max-w-[85%]">
              From reading price action and candlestick anatomy to understanding macroeconomics and liquidity sweeps. Your complete A-Z trading manual.
            </p>
            <div className="flex gap-2">
              <span className="px-2 py-1 font-mono text-[9px] xr-hairline bg-foreground/5">12 MODULES</span>
              <span className="px-2 py-1 font-mono text-[9px] xr-hairline bg-foreground/5">BEGINNER TO ADVANCED</span>
            </div>
          </div>
        </div>

        {/* Bento Item 2: Strategy Simulator */}
        <div 
          onClick={() => onNavigate("plan")}
          className="col-span-2 row-span-1 xr-panel xr-corner p-5 group hover:border-foreground/40 transition-colors cursor-pointer flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path d="M12 7v5l3 3"></path></svg>
          </div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2">PRACTICE ARENA</div>
          <h3 className="text-lg mb-1.5">Strategy Simulator</h3>
          <p className="text-xs text-foreground/60 max-w-[80%] line-clamp-2 mb-auto">
            Trade historical data in a risk-free Sandbox environment to build pattern recognition.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded bg-foreground/20 border border-background flex items-center justify-center font-mono text-[8px]">{i}H</div>)}
            </div>
            <span className="font-mono text-[9px] tracking-[0.2em] text-foreground/40 group-hover:text-foreground/80 transition-colors">ENTER ARENA →</span>
          </div>
        </div>

        {/* Bento Item 3: Proven Strategies */}
        <div 
          onClick={() => onNavigate("plan")}
          className="col-span-1 row-span-2 xr-panel xr-corner p-5 flex flex-col group hover:border-foreground/40 transition-colors cursor-pointer">
          <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-3 shrink-0">BLUEPRINTS</div>
          <h3 className="text-lg mb-3 shrink-0">Proven Strategies</h3>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2">
            {[
              { n: "EMA Crossover", t: "Trend Following" },
              { n: "RSI Divergence", t: "Mean Reversion" },
              { n: "Liquidity Sweep", t: "Smart Money" },
              { n: "Break & Retest", t: "Price Action" }
            ].map((s, i) => (
              <div key={i} className="xr-hairline p-2 hover:bg-foreground/5 transition-colors">
                <div className="text-sm">{s.n}</div>
                <div className="font-mono text-[8px] text-foreground/40 mt-1">{s.t}</div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-foreground/10 font-mono text-[9px] tracking-[0.2em] text-foreground/40 text-center mt-2 group-hover:text-foreground/80 transition-colors shrink-0">
            TEST IN LAB →
          </div>
        </div>

        {/* Bento Item 4: Market Dynamics */}
        <div 
          onClick={() => onNavigate("trade")}
          className="col-span-1 row-span-1 xr-panel xr-corner p-5 group hover:border-foreground/40 transition-colors cursor-pointer relative overflow-hidden bg-foreground/5">
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <CandlestickChart timeframe="15m" zoomX={1.5} zoomY={1} height={180} />
          </div>
          <div className="absolute inset-0 bg-background/60 group-hover:bg-background/40 transition-colors" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2">LIVE ANALYSIS</div>
            <h3 className="text-[15px] leading-tight mb-auto mt-2">Market<br/>Dynamics</h3>
            <div className="font-mono text-[9px] tracking-[0.2em] flex items-center gap-1.5 mt-2 text-foreground/80">
              <span className="w-2 h-2 border border-foreground rounded-full flex items-center justify-center"><span className="w-0.5 h-0.5 bg-foreground rounded-full" /></span>
              ENTER LIVE MARKET →
            </div>
          </div>
        </div>

        {/* Bento Item 5: Sensei Analytics */}
        <div className="col-span-2 row-span-1 xr-panel xr-corner p-5 flex items-center justify-between group hover:border-foreground/40 transition-colors cursor-pointer bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background">
          <div className="max-w-[60%]">
            <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-2 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
              SENSEI ANALYTICS
            </div>
            <h3 className="text-lg mb-1.5">Review Your Past Trades</h3>
            <p className="text-xs text-foreground/60 hidden sm:block">AI breakdown of your historical performance, emotional tilt, and mechanical errors.</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-light mb-1 text-success">68%</div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-foreground/50">WIN RATE (DEMO)</div>
          </div>
        </div>
        
      </div>
    </div>
  </div>
);

// ─── Plan Panel (Dashboard Layout) ──────────────────────────────────────────────
const PlanPanel = () => {
  const [fast, setFast] = useState(9);
  const [slow, setSlow] = useState(21);
  const [tf, setTf] = useState<Timeframe>("1H");
  const [risk, setRisk] = useState(1);
  const [simulating, setSimulating] = useState(false);

  const winRate = useMemo(() => {
    const ratio = slow / fast;
    return Math.min(74, Math.round(48 + Math.min(15, ratio * 3) + TIMEFRAMES.indexOf(tf) * 1.2));
  }, [fast, slow, tf]);
  const avgR = useMemo(() => (1.4 + (slow - fast) * 0.04 + TIMEFRAMES.indexOf(tf) * 0.08).toFixed(2), [fast, slow, tf]);
  const edge = useMemo(() => (((winRate / 100) * Number(avgR)) - (1 - winRate / 100)).toFixed(2), [winRate, avgR]);
  
  const totalTrades = Math.floor(1240 * (1 / (TIMEFRAMES.indexOf(tf) + 1)));
  const drawdown = (Math.abs(winRate - 100) * 0.4).toFixed(1);

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => setSimulating(false), 800);
  };

  return (
    <div className="absolute inset-0 flex flex-col p-6 animate-fade-in space-y-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-2 border-b border-foreground/10 shrink-0">
        <div>
          <h2 className="text-2xl font-light tracking-wide mb-1 flex items-center gap-3">
            Strategy Lab
            {simulating && <span className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded-sm animate-pulse">COMPUTING</span>}
          </h2>
          <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/50">BACKTEST & SIMULATE TRADING MODELS</div>
        </div>
        <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.2em]">
          <div className="text-right">
            <div className="text-foreground/40 mb-1">TOTAL TRADES</div>
            <div className="text-sm">{totalTrades.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-foreground/40 mb-1">MAX DRAWDOWN</div>
            <div className="text-sm text-destructive">{drawdown}%</div>
          </div>
          <button 
            onClick={handleSimulate}
            className={`px-6 py-3 transition-colors ${simulating ? 'bg-success/20 text-success' : 'bg-foreground text-background hover:bg-foreground/80'}`}>
            {simulating ? "RUNNING..." : "RUN SIMULATION"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Sidebar: Controls */}
        <div className="w-72 shrink-0 xr-panel xr-corner p-5 flex flex-col overflow-y-auto">
          <div className="font-mono text-[10px] tracking-[0.3em] text-foreground/60 mb-5">PARAMETERS</div>
          
          <div className="space-y-6 flex-1">
            <div>
              <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 mb-3">ACTIVE MODEL</div>
              <select className="w-full bg-background border border-foreground/20 text-xs p-2 font-mono outline-none focus:border-foreground/50">
                <option>EMA Crossover</option>
                <option>RSI Divergence</option>
                <option>MACD Trend Follow</option>
                <option>Custom Script...</option>
              </select>
            </div>

            <div className="h-px bg-foreground/10" />

            <SliderField label="FAST EMA" value={fast} min={3} max={20} onChange={setFast} suffix="" />
            <SliderField label="SLOW EMA" value={slow} min={fast + 2} max={100} onChange={setSlow} suffix="" />
            
            <div>
              <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 mb-3">TIMEFRAME</div>
              <div className="grid grid-cols-3 gap-1">
                {TIMEFRAMES.map((t) => (
                  <button key={t} onClick={() => setTf(t)}
                    className={`font-mono text-[9px] py-1.5 transition-colors ${tf === t ? "bg-foreground text-background" : "xr-hairline text-foreground/60 hover:text-foreground"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <SliderField label="RISK / TRADE" value={risk} min={0.25} max={3} step={0.25} onChange={setRisk} suffix="%" />
          </div>

          <button className="mt-6 w-full py-3 border border-success/40 text-success font-mono text-[10px] tracking-[0.2em] hover:bg-success/10 transition-colors">
            DEPLOY TO LIVE TRADING
          </button>
        </div>

        {/* Right Main Area: Chart & Data */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Top: Chart View */}
          <div className="flex-1 xr-panel xr-corner p-1 relative flex flex-col min-h-0">
             <div className="absolute top-4 left-4 z-10 flex items-center gap-3 font-mono text-[9px] tracking-[0.2em]">
                <div className="px-2 py-1 bg-background/80 backdrop-blur-sm border border-foreground/20">BACKTEST DATA (5Y)</div>
                <div className="text-success bg-success/10 border border-success/20 px-2 py-1">EMA({fast}) × EMA({slow})</div>
             </div>
             <div className={`flex-1 transition-opacity duration-300 ${simulating ? 'opacity-30' : 'opacity-100'} p-2`}>
                <CandlestickChart timeframe={tf} zoomX={1} zoomY={1} showEMA={[fast, slow]} height={280} />
             </div>
          </div>

          {/* Bottom: Metrics & Logs */}
          <div className="h-[220px] shrink-0 grid grid-cols-3 gap-4">
            
            {/* KPI Cards */}
            <div className="col-span-1 grid grid-cols-2 grid-rows-2 gap-2">
              {[
                ["WIN RATE", `${winRate}%`, winRate > 55 ? "text-success" : ""],
                ["AVG R", avgR, ""],
                ["EDGE", `+${edge}`, Number(edge) > 0 ? "text-success" : "text-destructive"],
                ["EXPECTANCY", `$${(Number(edge) * 125).toFixed(2)}`, "text-success"],
              ].map(([k, v, c]) => (
                <div key={k} className="xr-panel flex flex-col justify-center p-4">
                  <div className="font-mono text-[8px] tracking-[0.2em] text-foreground/50 mb-1">{k}</div>
                  <div className={`text-xl font-mono ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            {/* Trade Logs */}
            <div className="col-span-2 xr-panel xr-corner flex flex-col overflow-hidden p-4">
              <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/60 mb-3 shrink-0">RECENT SIMULATED TRADES</div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="text-foreground/40 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <tr>
                      <th className="font-normal pb-2">DATE</th>
                      <th className="font-normal pb-2">PAIR</th>
                      <th className="font-normal pb-2">SIDE</th>
                      <th className="font-normal pb-2">ENTRY</th>
                      <th className="font-normal pb-2">EXIT</th>
                      <th className="font-normal pb-2 text-right">PNL</th>
                    </tr>
                  </thead>
                  <tbody className={`transition-opacity duration-300 ${simulating ? 'opacity-0' : 'opacity-100'}`}>
                    {[
                      { d: "2024-03-12 14:00", p: "BTC/USD", s: "LONG",  en: "71,450",  ex: "72,800",  pnl: "+1.89%" },
                      { d: "2024-03-09 09:15", p: "BTC/USD", s: "SHORT", en: "69,200",  ex: "69,500",  pnl: "-0.43%" },
                      { d: "2024-03-05 18:30", p: "BTC/USD", s: "LONG",  en: "66,100",  ex: "68,400",  pnl: "+3.47%" },
                      { d: "2024-03-01 11:00", p: "BTC/USD", s: "LONG",  en: "61,200",  ex: "63,900",  pnl: "+4.41%" },
                      { d: "2024-02-28 16:45", p: "BTC/USD", s: "SHORT", en: "59,100",  ex: "60,200",  pnl: "-1.86%" },
                      { d: "2024-02-24 10:20", p: "BTC/USD", s: "LONG",  en: "51,500",  ex: "54,200",  pnl: "+5.24%" }
                    ].map((row, i) => (
                      <tr key={i} className="border-t border-foreground/5 hover:bg-foreground/5 transition-colors">
                        <td className="py-2 text-foreground/50">{row.d}</td>
                        <td className="py-2">{row.p}</td>
                        <td className={`py-2 ${row.s === 'LONG' ? 'text-success' : 'text-destructive'}`}>{row.s}</td>
                        <td className="py-2 text-foreground/70">{row.en}</td>
                        <td className="py-2 text-foreground/70">{row.ex}</td>
                        <td className={`py-2 text-right ${row.pnl.startsWith('+') ? 'text-success' : 'text-destructive'}`}>{row.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const SliderField = ({ label, value, min, max, step = 1, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix: string;
}) => (
  <div>
    <div className="flex justify-between mb-2">
      <span className="font-mono text-[8px] tracking-[0.3em] text-foreground/50">{label}</span>
      <span className="font-mono text-[11px]">{value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-foreground" />
  </div>
);

const Particles = () => (
  <div className="absolute inset-0 pointer-events-none">
    {Array.from({ length: 30 }).map((_, i) => (
      <div key={i} className="absolute w-px h-px bg-foreground/30 rounded-full animate-pulse-soft"
        style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${i * 0.12}s` }} />
    ))}
  </div>
);

// ─── Static data ─────────────────────────────────────────────────────────────
const NEWS_ITEMS = [
  { source: "REUTERS", time: "14:32", sentiment: "bullish" as const,
    headline: "Fed holds rates steady, signals patience on cuts",
    summary: "FOMC minutes show broad consensus on maintaining current policy. Risk assets rallied." },
  { source: "BLOOMBERG", time: "13:18", sentiment: "bearish" as const,
    headline: "China PMI misses estimates for second consecutive month",
    summary: "Manufacturing activity contracted to 49.1, below the 50 expansion threshold." },
  { source: "FT", time: "12:05", sentiment: "bullish" as const,
    headline: "Bitcoin ETF inflows hit $800M daily record",
    summary: "Spot BTC ETFs record largest single-day net inflow since January approval." },
  { source: "WSJ", time: "11:44", sentiment: "neutral" as const,
    headline: "G7 finance ministers meet on AI regulation framework",
    summary: "Discussions ongoing; no binding agreements expected before Q4 summit." },
  { source: "CNA", time: "10:30", sentiment: "bearish" as const,
    headline: "Middle East tensions escalate following overnight strikes",
    summary: "Oil futures up 1.8%. Safe-haven flows into USD and gold observed." },
  { source: "COINDESK", time: "09:15", sentiment: "bullish" as const,
    headline: "Halving cycle historically precedes 12-month bull run",
    summary: "On-chain data shows declining exchange supply. Long-term holder accumulation at highs." },
];

const POSITIONS = [
  { side: "LONG", pair: "BTC/USD", size: "0.12", entry: "$67,420", pnl: "+$204" },
  { side: "LONG", pair: "ETH/USD", size: "1.50",  entry: "$3,210",  pnl: "+$87" },
  { side: "SHORT", pair: "GOLD",   size: "0.20",  entry: "$2,318",  pnl: "−$32" },
];
