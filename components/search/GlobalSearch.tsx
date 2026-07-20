"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { inputBaseClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getSearchResultTypeLabel,
  searchFinanceData,
  type SearchResult,
} from "@/lib/search/globalSearch";

const TYPE_ICONS: Record<SearchResult["type"], string> = {
  account: "🏦",
  bill: "📄",
  transaction: "💳",
  goal: "🎯",
  income: "💰",
};

type GlobalSearchProps = {
  className?: string;
};

export function GlobalSearch({ className }: GlobalSearchProps) {
  const finance = useFinance();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchFinanceData(finance, query),
    [finance, query],
  );

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isShortcut) {
        event.preventDefault();
        setIsOpen((current) => {
          if (current) {
            setQuery("");
            setSelectedIndex(0);
            return false;
          }

          setQuery("");
          setSelectedIndex(0);
          return true;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      document.body.style.overflow = "";
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (results.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % results.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          current === 0 ? results.length - 1 : current - 1,
        );
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          router.push(selected.href);
          close();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen, results, router, selectedIndex]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={cn(
          "inline-flex min-h-11 items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-2 text-sm text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/70",
          className,
        )}
        aria-label="Search"
      >
        <span aria-hidden>🔍</span>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/30 sm:inline">
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] sm:p-6">
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-2xl"
          >
            <div className="border-b border-white/[0.04] p-4">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search accounts, bills, transactions, goals, income…"
                className={cn(inputBaseClassName, "text-sm")}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
              {query.trim() === "" ? (
                <p className="px-4 py-8 text-center text-sm text-white/35">
                  Type to search your finances
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-white/35">
                  No results for &ldquo;{query.trim()}&rdquo;
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((result, index) => (
                    <SearchResultRow
                      key={`${result.type}-${result.id}`}
                      result={result}
                      isSelected={index === selectedIndex}
                      onSelect={close}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-3 text-[11px] text-white/30">
              <span>↑↓ navigate</span>
              <span>↵ open · esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type SearchResultRowProps = {
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
};

function SearchResultRow({
  result,
  isSelected,
  onSelect,
}: SearchResultRowProps) {
  return (
    <li>
      <Link
        href={result.href}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
          isSelected
            ? "bg-[var(--accent)]/15 text-white"
            : "text-white/70 hover:bg-white/[0.04] hover:text-white",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lg">
          {TYPE_ICONS[result.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{result.title}</p>
            <span className="shrink-0 rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/35">
              {getSearchResultTypeLabel(result.type)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-white/40">{result.subtitle}</p>
        </div>
        {result.amount !== undefined && (
          <span className="shrink-0 text-sm tabular-nums text-white/55">
            {formatCurrency(result.amount)}
          </span>
        )}
      </Link>
    </li>
  );
}
