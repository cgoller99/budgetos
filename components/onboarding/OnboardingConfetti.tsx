"use client";

import { useEffect, useState } from "react";

export function OnboardingConfetti() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsVisible(false), 2200);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className="goal-confetti-piece absolute left-1/2 top-1/3 block h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor:
              index % 4 === 0
                ? "var(--accent)"
                : index % 4 === 1
                  ? "var(--accent-light)"
                  : index % 4 === 2
                    ? "#34c759"
                    : "#ffd60a",
            animationDelay: `${index * 35}ms`,
            left: `${20 + (index % 12) * 5}%`,
            transform: `rotate(${index * 15}deg)`,
          }}
        />
      ))}
    </div>
  );
}
