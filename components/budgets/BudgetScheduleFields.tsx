"use client";

import type { ReactNode } from "react";
import { Input, Select } from "@/components/ui";
import {
  BUDGET_FREQUENCIES,
  BUDGET_FREQUENCY_LABELS,
  WEEKDAY_LABELS,
  budgetScheduleNote,
  type BudgetFrequency,
  type BudgetSchedule,
} from "@/lib/budgets/budgetPeriod";
import { parseDateString } from "@/lib/recurring/schedule";

type ScheduleValue = {
  frequency: BudgetFrequency;
  anchorDate: string | null;
  weekday: number | null;
  monthDays: BudgetSchedule["monthDays"] | number[] | null;
  intervalDays: number | null;
};

type SchedulePatch = Partial<
  Pick<BudgetSchedule, "frequency" | "anchorDate" | "weekday" | "monthDays" | "intervalDays">
>;

const IOS_FIELD =
  "mt-1 min-h-11 w-full rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]";

export function BudgetScheduleFields({
  tone,
  idPrefix,
  value,
  onChange,
}: {
  tone: "web" | "ios";
  idPrefix: string;
  value: ScheduleValue;
  onChange: (patch: SchedulePatch) => void;
}) {
  const labelClass =
    tone === "ios"
      ? "block text-[13px] text-[var(--text-muted)]"
      : "block text-xs text-[var(--text-muted)]";
  const monthDays = value.monthDays ?? [1, 15];
  const weekday = value.weekday ?? 1;
  const intervalDays = value.intervalDays ?? 14;

  function field(id: string, label: string, control: ReactNode) {
    return (
      <label className={labelClass} htmlFor={id}>
        {label}
        {control}
      </label>
    );
  }

  return (
    <div className={tone === "ios" ? "flex flex-col gap-3" : "grid gap-3"}>
      {field(
        `${idPrefix}-frequency`,
        "Frequency",
        tone === "ios" ? (
          <select
            id={`${idPrefix}-frequency`}
            aria-label="Budget frequency"
            className={IOS_FIELD}
            value={value.frequency}
            onChange={(event) =>
              onChange({ frequency: event.target.value as BudgetFrequency })
            }
          >
            {BUDGET_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {BUDGET_FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </select>
        ) : (
          <Select
            id={`${idPrefix}-frequency`}
            aria-label="Budget frequency"
            className="mt-1"
            value={value.frequency}
            onChange={(event) =>
              onChange({ frequency: event.target.value as BudgetFrequency })
            }
          >
            {BUDGET_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {BUDGET_FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </Select>
        ),
      )}

      {value.frequency === "weekly" ? (
        field(
          `${idPrefix}-weekday`,
          "Starting weekday",
          tone === "ios" ? (
            <select
              id={`${idPrefix}-weekday`}
              aria-label="Starting weekday"
              className={IOS_FIELD}
              value={weekday}
              onChange={(event) =>
                onChange({ weekday: Number.parseInt(event.target.value, 10) })
              }
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <Select
              id={`${idPrefix}-weekday`}
              aria-label="Starting weekday"
              className="mt-1"
              value={weekday}
              onChange={(event) =>
                onChange({ weekday: Number.parseInt(event.target.value, 10) })
              }
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </Select>
          ),
        )
      ) : null}

      {value.frequency === "weekly" ||
      value.frequency === "biweekly" ||
      value.frequency === "custom" ? (
        field(
          `${idPrefix}-start`,
          "Start date",
          tone === "ios" ? (
            <input
              id={`${idPrefix}-start`}
              type="date"
              aria-label="Budget start date"
              className={IOS_FIELD}
              value={value.anchorDate ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
                onChange({
                  anchorDate: next,
                  weekday:
                    value.frequency === "weekly" ? parseDateString(next).getDay() : undefined,
                });
              }}
            />
          ) : (
            <Input
              id={`${idPrefix}-start`}
              type="date"
              aria-label="Budget start date"
              className="mt-1"
              value={value.anchorDate ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
                onChange({
                  anchorDate: next,
                  weekday:
                    value.frequency === "weekly" ? parseDateString(next).getDay() : undefined,
                });
              }}
            />
          ),
        )
      ) : null}

      {value.frequency === "twice_monthly" ? (
        <div className={tone === "ios" ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-2"}>
          {field(
            `${idPrefix}-day-1`,
            "First day of the month",
            tone === "ios" ? (
              <input
                id={`${idPrefix}-day-1`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                aria-label="First day of the month"
                className={IOS_FIELD}
                value={monthDays[0] ?? 1}
                onChange={(event) => {
                  const day = Number.parseInt(event.target.value, 10);
                  const other = monthDays[1] ?? 15;
                  if (!Number.isInteger(day) || day < 1 || day > 31 || day === other) return;
                  onChange({ monthDays: [day, other] });
                }}
              />
            ) : (
              <Input
                id={`${idPrefix}-day-1`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                aria-label="First day of the month"
                className="mt-1"
                value={monthDays[0] ?? 1}
                onChange={(event) => {
                  const day = Number.parseInt(event.target.value, 10);
                  const other = monthDays[1] ?? 15;
                  if (!Number.isInteger(day) || day < 1 || day > 31 || day === other) return;
                  onChange({ monthDays: [day, other] });
                }}
              />
            ),
          )}
          {field(
            `${idPrefix}-day-2`,
            "Second day of the month",
            tone === "ios" ? (
              <input
                id={`${idPrefix}-day-2`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                aria-label="Second day of the month"
                className={IOS_FIELD}
                value={monthDays[1] ?? 15}
                onChange={(event) => {
                  const day = Number.parseInt(event.target.value, 10);
                  const other = monthDays[0] ?? 1;
                  if (!Number.isInteger(day) || day < 1 || day > 31 || day === other) return;
                  onChange({ monthDays: [other, day] });
                }}
              />
            ) : (
              <Input
                id={`${idPrefix}-day-2`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                aria-label="Second day of the month"
                className="mt-1"
                value={monthDays[1] ?? 15}
                onChange={(event) => {
                  const day = Number.parseInt(event.target.value, 10);
                  const other = monthDays[0] ?? 1;
                  if (!Number.isInteger(day) || day < 1 || day > 31 || day === other) return;
                  onChange({ monthDays: [other, day] });
                }}
              />
            ),
          )}
        </div>
      ) : null}

      {value.frequency === "custom" ? (
        field(
          `${idPrefix}-length`,
          "Length in days",
          tone === "ios" ? (
            <input
              id={`${idPrefix}-length`}
              type="number"
              inputMode="numeric"
              min={1}
              max={366}
              aria-label="Custom period length in days"
              className={IOS_FIELD}
              value={intervalDays}
              onChange={(event) => {
                const days = Number.parseInt(event.target.value, 10);
                if (!Number.isInteger(days) || days < 1 || days > 366) return;
                onChange({ intervalDays: days });
              }}
            />
          ) : (
            <Input
              id={`${idPrefix}-length`}
              type="number"
              inputMode="numeric"
              min={1}
              max={366}
              aria-label="Custom period length in days"
              className="mt-1"
              value={intervalDays}
              onChange={(event) => {
                const days = Number.parseInt(event.target.value, 10);
                if (!Number.isInteger(days) || days < 1 || days > 366) return;
                onChange({ intervalDays: days });
              }}
            />
          ),
        )
      ) : null}

      <p className={tone === "ios" ? "text-[12px] text-[var(--text-muted)]" : "text-xs text-[var(--text-muted)]"}>
        {budgetScheduleNote(value.frequency)}
      </p>
    </div>
  );
}
