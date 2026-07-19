import type { DemoProfileId } from "@/lib/onboarding/types";

export type DemoProfile = {
  id: DemoProfileId;
  emoji: string;
  name: string;
  tagline: string;
  highlights: string[];
  accent: string;
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "christian",
    emoji: "👤",
    name: "Christian",
    tagline: "Young mechanic",
    highlights: [
      "Saving for a house",
      "Building investments",
      "Paid-off vehicles",
      "Moderate income",
      "Weekly budgeting",
    ],
    accent: "var(--accent)",
  },
  {
    id: "young_professional",
    emoji: "👩",
    name: "Young Professional",
    tagline: "Recently graduated",
    highlights: [
      "Building an emergency fund",
      "Paying student loans",
      "Growing retirement",
    ],
    accent: "#6366f1",
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    name: "Family",
    tagline: "Mortgage & kids",
    highlights: [
      "Multiple incomes",
      "Monthly budgeting",
      "College savings",
    ],
    accent: "#10b981",
  },
  {
    id: "college_student",
    emoji: "🎓",
    name: "College Student",
    tagline: "Part-time income",
    highlights: [
      "Minimal bills",
      "Learning budgeting",
      "Small emergency fund",
    ],
    accent: "#f59e0b",
  },
];

export function getDemoProfile(id: DemoProfileId): DemoProfile {
  return (
    DEMO_PROFILES.find((profile) => profile.id === id) ?? DEMO_PROFILES[0]
  );
}
