export type ScenarioId = "trade" | "learn" | "plan" | "emotional";

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  preferredMode: "AR" | "VR";
}

export const SCENARIOS: Scenario[] = [
  {
    id: "trade",
    label: "Simulate a Trade",
    description: "Sensei detects a chart on your desk and overlays risk/reward analysis.",
    preferredMode: "AR",
  },
  {
    id: "learn",
    label: "Start Learning",
    description: "Floating lesson panels in VR. Sensei explains RSI divergence.",
    preferredMode: "VR",
  },
  {
    id: "plan",
    label: "Plan a Strategy",
    description: "Build a trade thesis with AI before market open.",
    preferredMode: "VR",
  },
  {
    id: "emotional",
    label: "Emotional Check-in",
    description: "Sensei detects stress and intervenes with a pause-and-breathe prompt.",
    preferredMode: "AR",
  },
];
