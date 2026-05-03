import { SenseiCaption } from "@/hooks/useVoiceJarvis";

interface SenseiHUDProps {
  listening: boolean;
  speaking: boolean;
  captions: SenseiCaption[];
  onMicClick: () => void;
}

export const JarvisHUD = ({
  listening,
  speaking,
  captions,
  onMicClick,
}: SenseiHUDProps) => {
  return (
    <>
      {/* Live caption overlay — bottom center */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
        style={{ zIndex: 200, minWidth: 340, maxWidth: 680 }}
      >
        {captions.map((c) => (
          <div
            key={c.id}
            className={`animate-fade-in px-5 py-2 font-mono text-[11px] tracking-[0.15em] xr-panel xr-hairline ${
              c.type === "sensei"
                ? "text-foreground"
                : "text-foreground/55 italic"
            }`}
          >
            <span className="text-foreground/30 mr-2 not-italic">
              {c.type === "sensei" ? "SENSEI ·" : "YOU ·"}
            </span>
            {c.text}
          </div>
        ))}
      </div>

      {/* Mic button — bottom right */}
      <button
        id="sensei-mic"
        onClick={onMicClick}
        aria-label={listening ? "Stop listening" : "Talk to Sensei"}
        title={listening ? "Listening…" : "Click or say 'Hey Sensei'"}
        className={`fixed bottom-6 right-20 z-[200] w-11 h-11 rounded-full xr-panel xr-hairline flex items-center justify-center transition-all duration-200 pointer-events-auto ${
          listening
            ? "border-success/80 shadow-[0_0_16px_hsl(var(--success)/0.55)]"
            : speaking
            ? "border-foreground/50 shadow-[0_0_10px_rgba(255,255,255,0.15)]"
            : "border-foreground/20 hover:border-foreground/60"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 transition-colors ${
            listening ? "text-success" : speaking ? "text-foreground/90" : "text-foreground/60"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect
            x="9" y="2" width="6" height="12" rx="3"
            className={listening ? "animate-pulse" : ""}
          />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="8" y1="21" x2="16" y2="21" />
        </svg>
      </button>

      {/* Wake-word hint + status badge */}
      <div
        className="fixed bottom-6 right-36 z-[200] font-mono text-[8px] tracking-[0.25em] pointer-events-none text-right"
      >
        {listening ? (
          <span className="text-success animate-pulse-soft block">[ LISTENING ]</span>
        ) : speaking ? (
          <span className="text-foreground/50 animate-pulse-soft block">[ SPEAKING ]</span>
        ) : (
          <span className="text-foreground/25 block">HEY SENSEI</span>
        )}
      </div>
    </>
  );
};
