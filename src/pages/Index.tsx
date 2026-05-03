import { useCallback, useEffect, useRef, useState } from "react";
import { ARMode } from "@/components/xr/ARMode";
import { VRMode } from "@/components/xr/VRMode";
import { HUDFrame } from "@/components/xr/HUDFrame";
import { ModeToggle } from "@/components/xr/ModeToggle";
import { Reticle } from "@/components/xr/Reticle";
import { ScenarioRail } from "@/components/xr/ScenarioRail";
import { Scenario, SCENARIOS } from "@/components/xr/scenarios";
import { useVoiceSensei } from "@/hooks/useVoiceJarvis";
import { JarvisHUD } from "@/components/xr/JarvisHUD";
import { useFaceTracking } from "@/hooks/useFaceTracking";

const Index = () => {
  const [mode, setMode] = useState<"AR" | "VR">("AR");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [booted, setBooted] = useState(false);

  // Auto-switch mode when scenario picked
  useEffect(() => {
    if (scenario && scenario.preferredMode !== mode) {
      setMode(scenario.preferredMode);
    }
  }, [scenario]);

  useEffect(() => {
    document.title = "Trading Sensei · XR Co-Pilot";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Trading Sensei: an AI-powered XR co-pilot for traders. Reduce emotional errors with AR overlays and immersive VR analysis.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
    const t = setTimeout(() => setBooted(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // ── Always-on global biometric stress tracking ─────────────────────────────
  // Uses a hidden off-screen video element so we track stress in every mode
  const globalVideoRef = useRef<HTMLVideoElement>(null);
  const globalContainerRef = useRef<HTMLDivElement>(null);
  const [stressLevel, setStressLevel] = useState(50);
  const stressRawRef = useRef(50);

  const { frame: globalFrame } = useFaceTracking({
    videoRef: globalVideoRef,
    containerRef: globalContainerRef,
    enabled: booted,
  });

  useEffect(() => {
    if (!globalFrame) return;
    const e = globalFrame.expressions;
    const delta =
      e.happy * -8 + e.angry * 6 + e.fearful * 5 + e.sad * 3 +
      e.surprised * 1.5 + (e.neutral - 0.5) * 0.5;
    const prev = stressRawRef.current;
    const next = Math.max(0, Math.min(100, prev * 0.92 + (50 + delta * 4) * 0.08));
    stressRawRef.current = next;
    setStressLevel(next);
  }, [globalFrame]);

  // ── Sensei voice command handler ───────────────────────────────────────────
  const handleVoiceCommand = useCallback((cmd: string) => {
    switch (cmd) {
      case "learn":
        setScenario(SCENARIOS.find((s) => s.id === "learn") ?? null);
        break;
      case "trade":
        setScenario(SCENARIOS.find((s) => s.id === "trade") ?? null);
        break;
      case "plan":
        setScenario(SCENARIOS.find((s) => s.id === "plan") ?? null);
        break;
      case "emotional":
        setScenario(SCENARIOS.find((s) => s.id === "emotional") ?? null);
        break;
      case "vr":
        setMode("VR");
        break;
      case "ar":
        setMode("AR");
        break;
      default:
        break;
    }
  }, []);

  const { listening, speaking, captions, startListening, stopListening } =
    useVoiceSensei({
      onCommand: handleVoiceCommand,
      enabled: booted,
      stressLevel,
    });

  if (!booted) return <BootScreen />;

  return (
    <main className="relative min-h-screen w-full bg-background text-foreground cursor-none">
      <h1 className="sr-only">Trading Sensei XR — AI Trading Co-Pilot Demo</h1>

      {/* Hidden global camera for always-on biometric tracking */}
      <div ref={globalContainerRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: -99 }}>
        <video
          ref={globalVideoRef}
          playsInline
          muted
          className="absolute opacity-0"
          style={{ width: 1, height: 1 }}
        />
      </div>

      {mode === "AR" ? (
        <ARMode scenario={scenario} />
      ) : (
        <VRMode scenario={scenario} onScenarioChange={setScenario} />
      )}

      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "AR" && <ScenarioRail active={scenario} onSelect={setScenario} />}
      {mode === "AR" && <HUDFrame mode={mode} scene={scenario?.label} />}
      <Reticle />

      {/* Sensei Voice Assistant */}
      <JarvisHUD
        listening={listening}
        speaking={speaking}
        captions={captions}
        onMicClick={listening ? stopListening : startListening}
      />
    </main>
  );
};

const BootScreen = () => (
  <div className="fixed inset-0 bg-background text-foreground flex items-center justify-center cursor-none">
    <div className="text-center space-y-4 animate-fade-in">
      <div className="font-mono text-[10px] tracking-[0.5em] text-foreground/60">
        TRADING SENSEI
      </div>
      <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/40">
        BOOTING XR RUNTIME · v0.4.1
      </div>
      <div className="w-48 h-px bg-foreground/20 mx-auto overflow-hidden">
        <div className="h-full bg-foreground animate-scan" style={{ width: "40%" }} />
      </div>
    </div>
  </div>
);

export default Index;
