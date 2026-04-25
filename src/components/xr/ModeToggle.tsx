interface Props {
  mode: "AR" | "VR";
  onChange: (m: "AR" | "VR") => void;
}

export const ModeToggle = ({ mode, onChange }: Props) => (
  <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50">
    <div className="xr-panel rounded-full flex items-center p-1 font-mono text-[11px] tracking-[0.25em]">
      {(["AR", "VR"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-5 py-1.5 rounded-full transition-all ${
            mode === m
              ? "bg-foreground text-background"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  </div>
);
