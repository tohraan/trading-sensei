import { JarvisCaption } from "@/hooks/useVoiceJarvis";

interface JarvisHUDProps {
  listening: boolean;
  speaking: boolean;
  captions: JarvisCaption[];
  onMicClick: () => void;
}

export const JarvisHUD = ({
  listening,
  speaking,
  captions,
  onMicClick,
}: JarvisHUDProps) => {
  return (
    <>
      {/* Live caption overlay */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
        style={{ zIndex: 200, minWidth: 320, maxWidth: 600 }}
      >
        {captions.map((c) => (
          <div
            key={c.id}
            className={`animate-fade-in px-4 py-1.5 font-mono text-[11px] tracking-[0.15em] xr-panel xr-hairline ${
              c.type === "jarvis"
                ? "text-foreground"
                : "text-foreground/60 italic"
            }`}
          >
            <span className="text-foreground/30 mr-2">
              {c.type === "jarvis" ? "JARVIS ·" : "YOU ·"}
            </span>
            {c.text}
          </div>
        ))}
      </div>

      {/* Mic button — bottom right */}
      <button
        id="jarvis-mic"
        onClick={onMicClick}
        aria-label={listening ? "Stop listening" : "Talk to Jarvis"}
        className={`fixed bottom-6 right-20 z-[200] w-11 h-11 rounded-full xr-panel xr-hairline flex items-center justify-center transition-all pointer-events-auto ${
          listening
            ? "border-success/80 shadow-[0_0_14px_hsl(var(--success)/0.5)]"
            : speaking
            ? "border-foreground/40 shadow-[0_0_8px_rgba(255,255,255,0.12)]"
            : "border-foreground/20 hover:border-foreground/60"
        }`}
      >
        {/* Mic icon */}
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 transition-colors ${
            listening ? "text-success" : "text-foreground/70"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {listening ? (
            /* Animated waveform when listening */
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" className="animate-pulse" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="8" y1="21" x2="16" y2="21" />
            </>
          ) : (
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="8" y1="21" x2="16" y2="21" />
            </>
          )}
        </svg>
      </button>

      {/* Status badge */}
      <div
        className={`fixed bottom-6 right-36 z-[200] font-mono text-[8px] tracking-[0.3em] transition-opacity pointer-events-none ${
          listening || speaking ? "opacity-100" : "opacity-0"
        }`}
      >
        {listening ? (
          <span className="text-success animate-pulse-soft">[ LISTENING ]</span>
        ) : (
          <span className="text-foreground/50 animate-pulse-soft">[ SPEAKING ]</span>
        )}
      </div>
    </>
  );
};
