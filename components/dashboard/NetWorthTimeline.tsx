"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  TIMELINE_SERIES,
  buildTimeline,
  formatMilestoneDate,
  generateMilestones,
  type TimelinePoint,
  type TimelineRange,
  type TimelineSeriesKey,
} from "@/lib/timeline";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 280;
const CHART_PADDING = { top: 24, right: 24, bottom: 36, left: 56 };

const RANGE_OPTIONS: { value: TimelineRange; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function getSeriesValue(point: TimelinePoint, key: TimelineSeriesKey): number {
  return point[key];
}

function buildSmoothPath(
  points: TimelinePoint[],
  key: TimelineSeriesKey,
  xAt: (index: number) => number,
  yAt: (value: number) => number,
): string {
  if (points.length === 0) {
    return "";
  }

  const coordinates = points.map((point, index) => ({
    x: xAt(index),
    y: yAt(getSeriesValue(point, key)),
  }));

  if (coordinates.length === 1) {
    return `M ${coordinates[0].x} ${coordinates[0].y}`;
  }

  let path = `M ${coordinates[0].x} ${coordinates[0].y}`;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const controlX = (previous.x + current.x) / 2;
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

function buildAreaPath(
  linePath: string,
  pointsLength: number,
  xAt: (index: number) => number,
  baselineY: number,
): string {
  if (pointsLength === 0) {
    return "";
  }

  const lastX = xAt(pointsLength - 1);
  const firstX = xAt(0);
  return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
}

type TimelineChartProps = {
  points: TimelinePoint[];
  range: TimelineRange;
  activeSeries: Set<TimelineSeriesKey>;
};

function TimelineChart({ points, range, activeSeries }: TimelineChartProps) {
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const { minValue, maxValue, yTicks } = useMemo(() => {
    const values = points.flatMap((point) =>
      TIMELINE_SERIES.filter((series) => activeSeries.has(series.key)).map(
        (series) => getSeriesValue(point, series.key),
      ),
    );

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const paddedMax = max + (max - min) * 0.08;
    const paddedMin = Math.min(min, 0);

    const ticks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3;
      return Math.round(paddedMin + (paddedMax - paddedMin) * ratio);
    });

    return { minValue: paddedMin, maxValue: paddedMax, yTicks: ticks };
  }, [activeSeries, points]);

  const xAt = (index: number) =>
    CHART_PADDING.left +
    (index / Math.max(points.length - 1, 1)) * plotWidth;
  const yAt = (value: number) =>
    CHART_PADDING.top +
    plotHeight -
    ((value - minValue) / Math.max(maxValue - minValue, 1)) * plotHeight;
  const baselineY = yAt(0);

  return (
    <div className="timeline-chart-enter relative w-full overflow-hidden rounded-[1.35rem] border border-[var(--surface-border)] bg-[var(--surface-subtle)]">
      <svg
        key={range}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Net worth timeline chart"
      >
        <defs>
          <linearGradient id="netWorthArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={CHART_PADDING.left}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 6"
            />
            <text
              x={CHART_PADDING.left - 10}
              y={yAt(tick) + 4}
              textAnchor="end"
              className="fill-white/35 text-[11px]"
            >
              {tick >= 1000 ? `$${Math.round(tick / 1000)}k` : `$${tick}`}
            </text>
          </g>
        ))}

        {TIMELINE_SERIES.filter((series) => activeSeries.has(series.key)).map(
          (series) => {
            const linePath = buildSmoothPath(points, series.key, xAt, yAt);
            const isNetWorth = series.key === "netWorth";

            return (
              <g key={series.key}>
                {isNetWorth && (
                  <path
                    d={buildAreaPath(linePath, points.length, xAt, baselineY)}
                    fill="url(#netWorthArea)"
                    className="timeline-area-animate"
                  />
                )}
                <path
                  d={linePath}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={isNetWorth ? 3 : 2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="timeline-line-animate"
                  style={{
                    filter: `drop-shadow(0 0 6px ${series.color}55)`,
                  }}
                />
              </g>
            );
          },
        )}

        {points.map((point, index) => (
          <text
            key={point.label}
            x={xAt(index)}
            y={CHART_HEIGHT - 10}
            textAnchor="middle"
            className="fill-white/35 text-[11px]"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function NetWorthTimeline() {
  const finance = useFinance();
  const [range, setRange] = useState<TimelineRange>("monthly");
  const [activeSeries, setActiveSeries] = useState<Set<TimelineSeriesKey>>(
    () => new Set(TIMELINE_SERIES.map((series) => series.key)),
  );

  const timeline = useMemo(
    () => buildTimeline(finance, range),
    [finance, range],
  );
  const milestones = useMemo(
    () => generateMilestones(finance, timeline),
    [finance, timeline],
  );

  function toggleSeries(key: TimelineSeriesKey) {
    setActiveSeries((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        if (next.size === 1) {
          return next;
        }

        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  const latest = timeline.at(-1);

  return (
    <Card padding="lg" className="relative overflow-hidden">

      <CardHeader
        title="Net worth"
        className="relative"
        action={
          <div className="flex rounded-2xl border border-white/[0.04] bg-white/[0.02] p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={cn(
                  "min-h-10 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
                  range === option.value
                    ? "bg-[var(--accent)] text-white"
                    : "text-white/45 hover:text-white/70",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <CardContent className="relative space-y-6">
        <div className="flex flex-wrap gap-2">
          {TIMELINE_SERIES.map((series) => {
            const isActive = activeSeries.has(series.key);

            return (
              <button
                key={series.key}
                type="button"
                onClick={() => toggleSeries(series.key)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-all duration-300",
                  isActive
                    ? "border-white/[0.07] bg-white/[0.04] text-white"
                    : "border-transparent bg-transparent text-white/35 hover:text-white/55",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full transition-opacity duration-300"
                  style={{
                    backgroundColor: series.color,
                    opacity: isActive ? 1 : 0.35,
                  }}
                />
                {series.label}
                {latest && isActive && (
                  <span className="tabular-nums text-white/45">
                    {formatCurrency(getSeriesValue(latest, series.key))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <TimelineChart
          points={timeline}
          range={range}
          activeSeries={activeSeries}
        />

        <section>
          <p className="text-sm text-white/38">Milestones</p>
          {milestones.length === 0 ? (
            <p className="mt-4 text-base text-white/38">
              Keep saving and investing — milestones appear as you progress.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {milestones.map((milestone, index) => (
                <li
                  key={milestone.id}
                  className="milestone-enter flex gap-4 rounded-2xl px-1 py-3"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-xl">
                    {milestone.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-base font-medium text-white">
                        {milestone.achievement}
                      </p>
                      <p className="text-sm text-white/32">
                        {formatMilestoneDate(milestone.date)}
                      </p>
                    </div>
                    <p className="mt-1 text-base leading-relaxed text-white/45">
                      {milestone.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
