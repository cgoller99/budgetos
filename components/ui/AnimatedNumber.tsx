"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

type AnimatedNumberProps = {
  value: number;
  format?: (value: number) => string;
  className?: string;
  duration?: number;
};

function defaultFormat(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function AnimatedNumber({
  value,
  format = defaultFormat,
  className,
  duration = 650,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;

    if (startValue === value) {
      return;
    }

    const startTime = performance.now();
    let frame = 0;

    function animate(currentTime: number) {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(startValue + (value - startValue) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
        setDisplayValue(value);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return (
    <span className={cn("tabular-nums", className)}>{format(displayValue)}</span>
  );
}
