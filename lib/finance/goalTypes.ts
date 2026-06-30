export type GoalType =
  | "emergency_fund"
  | "house"
  | "vacation"
  | "car"
  | "engagement_ring"
  | "wedding"
  | "investments"
  | "debt_payoff"
  | "custom"
  | "retirement";

export type GoalTypeMeta = {
  value: GoalType;
  label: string;
  icon: string;
  accent: string;
};

export const GOAL_TYPE_OPTIONS: GoalTypeMeta[] = [
  { value: "emergency_fund", label: "Emergency Fund", icon: "🛡️", accent: "#34c759" },
  { value: "house", label: "House", icon: "🏠", accent: "#0077ed" },
  { value: "vacation", label: "Vacation", icon: "✈️", accent: "#5ac8fa" },
  { value: "car", label: "Car", icon: "🚗", accent: "#ff9500" },
  { value: "engagement_ring", label: "Engagement Ring", icon: "💍", accent: "#ff6482" },
  { value: "wedding", label: "Wedding", icon: "💒", accent: "#bf5af2" },
  { value: "investments", label: "Investments", icon: "📈", accent: "#64d2ff" },
  { value: "debt_payoff", label: "Debt Payoff", icon: "💳", accent: "#ff453a" },
  { value: "custom", label: "Custom", icon: "⭐", accent: "#0077ed" },
];

const LEGACY_TYPE_ALIASES: Record<string, GoalType> = {
  retirement: "investments",
};

export function normalizeGoalType(type: string): GoalType {
  if (LEGACY_TYPE_ALIASES[type]) {
    return LEGACY_TYPE_ALIASES[type];
  }

  return (
    GOAL_TYPE_OPTIONS.find((option) => option.value === type)?.value ?? "custom"
  );
}

export function getGoalTypeMeta(type: GoalType | string): GoalTypeMeta {
  const normalized = normalizeGoalType(type);

  return (
    GOAL_TYPE_OPTIONS.find((option) => option.value === normalized) ??
    GOAL_TYPE_OPTIONS[GOAL_TYPE_OPTIONS.length - 1]!
  );
}

export function inferGoalType(name: string): GoalType {
  const normalized = name.toLowerCase();

  if (normalized.includes("emergency")) return "emergency_fund";
  if (normalized.includes("house") || normalized.includes("home")) return "house";
  if (normalized.includes("vacation") || normalized.includes("travel")) return "vacation";
  if (normalized.includes("car") || normalized.includes("auto")) return "car";
  if (normalized.includes("ring") || normalized.includes("engagement")) return "engagement_ring";
  if (normalized.includes("wedding")) return "wedding";
  if (normalized.includes("invest") || normalized.includes("retire")) return "investments";
  if (normalized.includes("debt") || normalized.includes("payoff")) return "debt_payoff";

  return "custom";
}
