import { cardBaseClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { SectionHeading } from "./shared";

function MockSidebar() {
  const items = ["Dashboard", "Accounts", "Bills", "Savings", "Reports"];

  return (
    <div className="hidden w-44 shrink-0 border-r border-white/[0.04] bg-[#07090d] p-4 sm:block">
      <div className="mb-6 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-white/[0.06]" />
        <div className="h-2.5 w-16 rounded-full bg-white/[0.12]" />
      </div>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={item}
            className={cn(
              "rounded-xl px-3 py-2 text-xs",
              index === 0
                ? "border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-white/80"
                : "text-white/35",
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4">
      <p className="text-[11px] text-white/35">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold tabular-nums tracking-tight",
          accent ? "text-[var(--accent-light)]" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DashboardMock() {
  return (
    <div
      className={cn(
        cardBaseClassName,
        "overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)]",
      )}
    >
      <div className="flex min-h-[22rem] bg-[#0a0f1a]">
        <MockSidebar />
        <div className="flex-1 p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/35">Overview</p>
              <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
            </div>
            <div className="h-8 w-24 rounded-xl bg-[var(--accent)]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MockMetric label="Net worth" value="$124,580" accent />
            <MockMetric label="Monthly income" value="$8,420" />
            <MockMetric label="Monthly bills" value="$3,180" />
            <MockMetric label="Savings rate" value="28%" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-white/45">Cash flow</p>
              <div className="mt-4 flex h-20 items-end gap-1.5">
                {[40, 65, 45, 80, 55, 70, 90, 60].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-sm bg-gradient-to-t from-[var(--accent)]/20 to-[var(--accent)]/70"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-white/45">Upcoming bills</p>
              <div className="mt-3 space-y-2.5">
                {[
                  { name: "Rent", amount: "$1,850", due: "Mar 1" },
                  { name: "Utilities", amount: "$142", due: "Mar 5" },
                  { name: "Insurance", amount: "$89", due: "Mar 12" },
                ].map((bill) => (
                  <div
                    key={bill.name}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
                  >
                    <span className="text-xs text-white/55">{bill.name}</span>
                    <span className="text-xs tabular-nums text-white/70">
                      {bill.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_CARDS = [
  {
    title: "Roadmap",
    description: "Timeline view of goals, debt payoff, and milestones.",
    preview: (
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)]/60" />
            <div className="h-2 flex-1 rounded-full bg-white/[0.08]" style={{ maxWidth: `${100 - step * 15}%` }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Debt tracker",
    description: "Balances, rates, and payoff progress in one view.",
    preview: (
      <div className="mt-4">
        <div className="flex items-end justify-between text-xs text-white/40">
          <span>Paid off</span>
          <span className="tabular-nums text-[var(--accent-light)]">62%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)]" />
        </div>
      </div>
    ),
  },
  {
    title: "Savings goals",
    description: "Track progress toward every goal that matters.",
    preview: (
      <div className="mt-4 grid grid-cols-3 gap-2">
        {["Emergency", "Vacation", "Home"].map((goal) => (
          <div
            key={goal}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-center"
          >
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--accent)]/40" />
            <p className="mt-2 truncate text-[10px] text-white/45">{goal}</p>
          </div>
        ))}
      </div>
    ),
  },
] as const;

export function ScreenshotsSection() {
  return (
    <section id="product" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Product"
        title="Designed for daily clarity"
        description="A calm interface that surfaces what matters — your balances, cash flow, and what's due next."
      />

      <div className="mx-auto mt-14 max-w-6xl">
        <DashboardMock />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PREVIEW_CARDS.map((card) => (
            <div
              key={card.title}
              className={cn(cardBaseClassName, "p-6")}
            >
              <h3 className="text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-1.5 text-sm text-white/38">{card.description}</p>
              {card.preview}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
