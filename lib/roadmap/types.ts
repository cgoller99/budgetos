export type MilestoneCategory = "savings" | "debt" | "investment" | "net_worth";

export type RoadmapMilestone = {
  id: string;
  category: MilestoneCategory;
  icon: string;
  title: string;
  subtitle: string;
  currentValue: number;
  targetValue: number;
  remaining: number;
  percentComplete: number;
  monthlyPace: number;
  paceLabel: string;
  targetDate: Date | null;
  estimatedCompletionDate: Date | null;
  isComplete: boolean;
};

export type RoadmapSummary = {
  milestones: RoadmapMilestone[];
  nextMilestone: RoadmapMilestone | null;
};

export type NextMilestoneSummary = {
  id: string;
  category: MilestoneCategory;
  name: string;
  icon: string;
  percentComplete: number;
  estimatedCompletionDate: string;
  remaining: number;
};

export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  savings: "Savings Goal",
  debt: "Debt Payoff",
  investment: "Investment",
  net_worth: "Net Worth",
};

export const MILESTONE_CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  savings: "#60a5fa",
  debt: "#fb7185",
  investment: "#a78bfa",
  net_worth: "#34d399",
};
