"use client";

import { cn } from "@/components/ui/cn";

type PreferenceToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function PreferenceToggle({
  checked,
  disabled,
  onChange,
  label,
}: PreferenceToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-all duration-200 ease-out",
        checked
          ? "border-[#0077ed]/40 bg-[#0077ed]/30"
          : "border-white/[0.08] bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
