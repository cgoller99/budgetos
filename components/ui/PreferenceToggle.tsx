"use client";

import { cn } from "@/components/ui/cn";
import { triggerHaptic } from "@/lib/native/haptics";
import { useNativeIos } from "@/lib/native/useNativeIos";

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
  const nativeIos = useNativeIos();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        void triggerHaptic("selection");
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-all duration-200 ease-out",
        nativeIos && "h-8 w-[51px]",
        checked
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/30"
          : "border-white/[0.08] bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
          nativeIos && "size-[28px] top-[1.5px]",
          checked
            ? nativeIos
              ? "translate-x-[21px]"
              : "translate-x-5"
            : "translate-x-0.5",
        )}
      />
    </button>
  );
}
