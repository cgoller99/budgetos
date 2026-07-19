"use client";

import { useEffect, useState } from "react";

const MILESTONE_STORAGE_KEY = "buxme-goal-milestones";

function readCelebrated(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(MILESTONE_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markCelebrated(key: string) {
  const celebrated = readCelebrated();
  celebrated.add(key);
  window.localStorage.setItem(
    MILESTONE_STORAGE_KEY,
    JSON.stringify([...celebrated]),
  );
}

type GoalMilestoneConfettiProps = {
  goalId: string;
  percentComplete: number;
};

export function GoalMilestoneConfetti({
  goalId,
  percentComplete,
}: GoalMilestoneConfettiProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const milestone = [25, 50, 75, 100].find(
      (value) => percentComplete >= value,
    );

    if (!milestone) {
      return;
    }

    const key = `${goalId}-${milestone}`;
    const celebrated = readCelebrated();

    if (celebrated.has(key)) {
      return;
    }

    markCelebrated(key);
    setIsVisible(true);

    const timeout = window.setTimeout(() => setIsVisible(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [goalId, percentComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={index}
          className="goal-confetti-piece absolute left-1/2 top-1/2 block h-2 w-2 rounded-full"
          style={{
            backgroundColor:
              index % 3 === 0 ? "var(--accent)" : index % 3 === 1 ? "var(--accent-light)" : "#34c759",
            animationDelay: `${index * 40}ms`,
            transform: `rotate(${index * 20}deg) translateY(-${20 + (index % 5) * 8}px)`,
          }}
        />
      ))}
    </div>
  );
}
