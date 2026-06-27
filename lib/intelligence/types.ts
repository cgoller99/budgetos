export type PlanPriority = "critical" | "attention" | "positive";

export type WeeklyPlanRecommendation = {
  id: string;
  message: string;
  priority: PlanPriority;
};

export type PlanCandidate = WeeklyPlanRecommendation & {
  score: number;
};
