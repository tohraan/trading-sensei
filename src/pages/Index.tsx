import { useCallback, useEffect, useState } from "react";
import { ARMode } from "@/components/xr/ARMode";
import { VRMode } from "@/components/xr/VRMode";
import { HUDFrame } from "@/components/xr/HUDFrame";
import { ModeToggle } from "@/components/xr/ModeToggle";
import { Reticle } from "@/components/xr/Reticle";
import { ScenarioRail } from "@/components/xr/ScenarioRail";
import { Scenario, SCENARIOS } from "@/components/xr/scenarios";
import { useVoiceJarvis } from "@/hooks/useVoiceJarvis";
import { JarvisHUD } from "@/components/xr/JarvisHUD";

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

  // ── Jarvis voice command handler ──────────────────────────────────────────
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
    useVoiceJarvis({ onCommand: handleVoiceCommand, enabled: booted });

  if (!booted) return <BootScreen />;

  return (
    <main className="relative min-h-screen w-full bg-background text-foreground cursor-none">
      <h1 className="sr-only">Trading Sensei XR — AI Trading Co-Pilot Demo</h1>

      {mode === "AR" ? (
        <ARMode scenario={scenario} />
      ) : (
        <VRMode scenario={scenario} onScenarioChange={setScenario} />
      )}

      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "AR" && <ScenarioRail active={scenario} onSelect={setScenario} />}
      {mode === "AR" && <HUDFrame mode={mode} scene={scenario?.label} />}
      <Reticle />

      {/* Jarvis Voice Assistant */}
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
