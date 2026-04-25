import { Scenario, SCENARIOS } from "./scenarios";

interface Props {
  active: Scenario | null;
  onSelect: (s: Scenario | null) => void;
}

export const ScenarioRail = ({ active, onSelect }: Props) => (
  <div className="fixed left-6 top-1/2 -translate-y-1/2 z-40 space-y-2">
    <div className="font-mono text-[9px] tracking-[0.3em] text-foreground/50 uppercase mb-3 pl-1">
      Scenarios
    </div>
    {SCENARIOS.map((s) => {
      const isActive = active?.id === s.id;
      return (
        <button
          key={s.id}
          onClick={() => onSelect(isActive ? null : s)}
          className={`block w-56 text-left xr-panel xr-corner px-4 py-3 transition-all group ${
            isActive ? "border-foreground bg-foreground/10" : "hover:border-foreground/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] tracking-[0.3em] text-foreground/50">
              {s.preferredMode}
            </span>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse-soft" />}
          </div>
          <div className="text-sm font-medium">{s.label}</div>
          <div className="text-[11px] text-foreground/50 mt-0.5 leading-snug">
            {s.description}
          </div>
        </button>
      );
    })}
    {active && (
      <button
        onClick={() => onSelect(null)}
        className="w-56 text-left px-4 py-2 font-mono text-[10px] tracking-[0.3em] text-foreground/40 hover:text-foreground transition-colors"
      >
        × CLEAR SCENARIO
      </button>
    )}
  </div>
);
