export type GoalType =
  | "house"
  | "emergency_fund"
  | "vacation"
  | "wedding"
  | "car"
  | "retirement"
  | "custom";

export const GOAL_TYPE_OPTIONS: {
  value: GoalType;
  label: string;
  icon: string;
}[] = [
  { value: "house", label: "House", icon: "🏠" },
  { value: "emergency_fund", label: "Emergency Fund", icon: "🛡️" },
  { value: "vacation", label: "Vacation", icon: "✈️" },
  { value: "wedding", label: "Wedding", icon: "💍" },
  { value: "car", label: "Car", icon: "🚗" },
  { value: "retirement", label: "Retirement", icon: "🌅" },
  { value: "custom", label: "Custom", icon: "⭐" },
];

export function getGoalTypeMeta(type: GoalType) {
  return (
    GOAL_TYPE_OPTIONS.find((option) => option.value === type) ??
    GOAL_TYPE_OPTIONS[GOAL_TYPE_OPTIONS.length - 1]
  );
}

export function inferGoalType(name: string): GoalType {
  const normalized = name.toLowerCase();

  if (normalized.includes("house") || normalized.includes("home")) {
    return "house";
  }

  if (normalized.includes("emergency")) {
    return "emergency_fund";
  }

  if (normalized.includes("vacation") || normalized.includes("travel")) {
    return "vacation";
  }

  if (normalized.includes("wedding")) {
    return "wedding";
  }

  if (normalized.includes("car") || normalized.includes("auto")) {
    return "car";
  }

  if (normalized.includes("retire")) {
    return "retirement";
  }

  return "custom";
}
