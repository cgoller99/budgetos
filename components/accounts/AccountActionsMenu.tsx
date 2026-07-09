"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";

type AccountActionsMenuProps = {
  onEdit: () => void;
  onDelete: () => void;
};

export function AccountActionsMenu({ onEdit, onDelete }: AccountActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Account actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
        className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-lg text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        ⋮
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-40 overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl shadow-black/40",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            fullWidth
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onEdit();
            }}
            className="justify-start rounded-none px-4 py-3 text-left text-sm text-white hover:bg-white/[0.04]"
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            className="justify-start rounded-none px-4 py-3 text-left text-sm text-rose-400/90 hover:bg-white/[0.04] hover:text-rose-300"
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
