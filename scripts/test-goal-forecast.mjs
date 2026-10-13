#!/usr/bin/env node
/**
 * Goal forecast math, hypothetical slider plans, and saved-plan persistence.
 *
 * Usage: npm run test:goal-forecast
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isActivityDue } from "../lib/recurring/schedule.ts";
import { mapGoalRow } from "../lib/supabase/mappers.ts";
import {
  applyGoalEdit,
  buildGoalSavingsPlan,
  completionDateKey,
  contributionFromStoredGoal,
  forecastGoalSavings,
  goalSavingsPlanColumns,
  mergeGoalUpdate,
  sumGoalContributions,
} from "../lib/finance/goalForecast.ts";

const root = path.resolve(import.meta.dirname, "..");
const reference = new Date(2026, 9, 15, 12, 0, 0);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function forecast(partial) {
  return forecastGoalSavings({
    current: 400,
    target: 1000,
    createdAt: "2026-10-01",
    weeklySavings: 50,
    contributed: 100,
    referenceDate: reference,
    paySchedule: "biweekly",
    ...partial,
  });
}

const onTrack = forecast({ contributed: 100 });
assert.equal(onTrack.remaining, 600);
assert.equal(onTrack.weeksRemaining, 12);
assert.equal(onTrack.monthsRemaining, 3);
assert.equal(onTrack.timeLabel, "12 weeks · about 3 months");
assert.equal(completionDateKey(onTrack.estimatedCompletionDate), "2027-01-07");
assert.equal(onTrack.weeklySavings, 50);
assert.equal(onTrack.monthlySavings, 216.5);
assert.equal(onTrack.perPaycheckSavings, 100);
assert.equal(onTrack.pace, "on_track");
assert.equal(onTrack.paceLabel, "On track");

assert.equal(forecast({ contributed: 120 }).pace, "ahead");
assert.equal(forecast({ contributed: 110 }).pace, "ahead");
assert.equal(forecast({ contributed: 91 }).pace, "on_track");
assert.equal(forecast({ contributed: 90 }).pace, "behind");
assert.equal(forecast({ contributed: 80 }).pace, "behind");

const complete = forecast({ current: 1000, contributed: 0, weeklySavings: 0 });
assert.equal(complete.pace, "complete");
assert.equal(complete.remaining, 0);
assert.equal(complete.weeksRemaining, 0);
assert.equal(complete.timeLabel, "Done");
assert.equal(completionDateKey(complete.estimatedCompletionDate), "2026-10-15");

const unscheduled = forecast({ weeklySavings: 0, contributed: 0, paySchedule: null });
assert.equal(unscheduled.pace, "behind");
assert.equal(unscheduled.estimatedCompletionDate, null);
assert.equal(unscheduled.timeLabel, "TBD");
assert.equal(unscheduled.perPaycheckSavings, null);

const early = forecast({
  createdAt: "2026-10-12",
  contributed: 0,
  weeklySavings: 50,
});
assert.equal(early.pace, "on_track");

const earlyAhead = forecast({
  createdAt: "2026-10-15",
  contributed: 20,
  weeklySavings: 10,
});
assert.equal(earlyAhead.pace, "ahead");

assert.equal(forecast({ paySchedule: "weekly" }).perPaycheckSavings, 50);
assert.equal(forecast({ paySchedule: "monthly" }).perPaycheckSavings, 216.5);
assert.equal(
  forecast({ paySchedule: "custom", customIntervalDays: 14 }).perPaycheckSavings,
  100,
);
assert.equal(forecast({ paySchedule: "custom", customIntervalDays: null }).perPaycheckSavings, null);

const input = {
  current: 400,
  target: 1000,
  createdAt: "2026-10-01",
  weeklySavings: 50,
  contributed: 100,
  referenceDate: reference,
  paySchedule: "biweekly",
};
const preview = forecastGoalSavings({ ...input, weeklySavings: 100 });
assert.equal(input.weeklySavings, 50);
assert.equal(preview.weeksRemaining, 6);
assert.equal(preview.perPaycheckSavings, 200);
assert.equal(completionDateKey(preview.estimatedCompletionDate), "2026-11-26");

assert.equal(
  sumGoalContributions(
    [
      { goalId: "goal-1", amount: 40, date: "2026-10-02" },
      { goalId: "goal-1", amount: 10, date: "2026-09-01" },
      { goalId: "goal-1", amount: -5, date: "2026-10-03" },
      { goalId: "goal-2", amount: 80, date: "2026-10-04" },
    ],
    "goal-1",
    "2026-10-01",
  ),
  40,
);

const created = buildGoalSavingsPlan(undefined, 40, reference);
assert.equal(created.amount, 40);
assert.equal(created.frequency, "weekly");
assert.equal(created.schedule.status, "paused");
assert.equal(isActivityDue(created.schedule, reference), false);

const active = {
  amount: 20,
  frequency: "weekly",
  schedule: {
    startDate: "2026-01-01",
    frequency: "weekly",
    nextOccurrence: "2026-10-22",
    lastProcessedDate: "2026-10-15",
    status: "active",
  },
};
const updated = buildGoalSavingsPlan(active, 55.555, reference);
assert.equal(updated.amount, 55.56);
assert.equal(updated.schedule.status, "active");
assert.equal(updated.schedule.nextOccurrence, "2026-10-22");
assert.equal(updated.schedule.lastProcessedDate, "2026-10-15");
assert.equal(updated.frequency, "weekly");

const biweekly = buildGoalSavingsPlan(
  {
    amount: 100,
    frequency: "biweekly",
    schedule: {
      startDate: "2026-01-01",
      frequency: "biweekly",
      nextOccurrence: "2026-10-22",
      lastProcessedDate: "2026-10-08",
      status: "active",
    },
  },
  80,
  reference,
);
assert.equal(biweekly.amount, 160);
assert.equal(biweekly.frequency, "biweekly");
assert.equal(biweekly.schedule.status, "active");
assert.equal(biweekly.schedule.nextOccurrence, "2026-10-22");

const columns = goalSavingsPlanColumns(created);
assert.equal(columns.contribution_amount, 40);
assert.equal(columns.contribution_frequency, "weekly");
assert.equal(columns.recurring_status, "paused");
assert.ok(columns.start_date);
assert.ok(columns.next_occurrence);

const cleared = goalSavingsPlanColumns(buildGoalSavingsPlan(active, 0, reference));
assert.equal(cleared.contribution_amount, null);
assert.equal(cleared.contribution_frequency, null);
assert.equal(cleared.next_occurrence, null);

const baseUpdate = {
  name: "Trip",
  goal_type: "vacation",
  icon: "✈️",
  target_amount: 1000,
};
const plainEdit = mergeGoalUpdate(baseUpdate, undefined, columns);
assert.equal(Object.hasOwn(plainEdit, "contribution_amount"), false);
assert.equal(plainEdit.name, "Trip");
const savedEdit = mergeGoalUpdate(baseUpdate, 40, columns);
assert.equal(savedEdit.contribution_amount, 40);
assert.equal(savedEdit.recurring_status, "paused");

const stored = contributionFromStoredGoal(columns);
assert.equal(stored.amount, 40);
assert.equal(stored.schedule.status, "paused");
assert.equal(contributionFromStoredGoal(cleared), undefined);

const goal = {
  id: "goal-1",
  name: "Trip",
  type: "vacation",
  icon: "✈️",
  current: 400,
  target: 1000,
  createdAt: "2026-10-01T00:00:00.000Z",
  autoContribution: active,
};

const renamed = applyGoalEdit(goal, { name: " Vacation ", type: "custom", target: 1200 }, "🎯", reference);
assert.equal(renamed.name, "Vacation");
assert.equal(renamed.target, 1200);
assert.equal(renamed.autoContribution.schedule.nextOccurrence, "2026-10-22");
assert.equal(renamed.autoContribution.amount, 20);

const planned = applyGoalEdit(
  { ...goal, autoContribution: undefined },
  { name: "Trip", type: "vacation", target: 1000, weeklySavings: 40 },
  "✈️",
  reference,
);
assert.equal(planned.autoContribution.schedule.status, "paused");
assert.equal(planned.autoContribution.amount, 40);
assert.equal(isActivityDue(planned.autoContribution.schedule, reference), false);

const keptActive = applyGoalEdit(
  goal,
  { name: "Trip", type: "vacation", target: 1000, weeklySavings: 55 },
  "✈️",
  reference,
);
assert.equal(keptActive.autoContribution.schedule.status, "active");
assert.equal(keptActive.autoContribution.schedule.nextOccurrence, "2026-10-22");
assert.equal(keptActive.autoContribution.amount, 55);

const removed = applyGoalEdit(
  goal,
  { name: "Trip", type: "vacation", target: 1000, weeklySavings: 0 },
  "✈️",
  reference,
);
assert.equal(removed.autoContribution, undefined);

const mapped = mapGoalRow({
  id: "goal-1",
  user_id: "user-a",
  name: "Trip",
  goal_type: "vacation",
  icon: "✈️",
  current_amount: 400,
  target_amount: 1000,
  household_id: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-15T00:00:00.000Z",
  ...columns,
});
assert.equal(mapped.autoContribution.amount, 40);
assert.equal(mapped.autoContribution.frequency, "weekly");
assert.equal(mapped.autoContribution.schedule.status, "paused");

const dropped = mapGoalRow({
  ...mapped,
  id: "goal-1",
  user_id: "user-a",
  name: "Trip",
  goal_type: "vacation",
  icon: "✈️",
  current_amount: 400,
  target_amount: 1000,
  household_id: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-15T00:00:00.000Z",
  contribution_amount: 0,
  contribution_frequency: "weekly",
  start_date: columns.start_date,
  next_occurrence: columns.next_occurrence,
  last_processed_date: null,
  recurring_status: "paused",
});
assert.equal(dropped.autoContribution, undefined);

const panel = read("components/goals/GoalForecastPanel.tsx");
assert.match(panel, /What if I save more\?/);
assert.match(panel, /Save plan/);
assert.match(panel, /This preview stays here until you save the plan/);
assert.match(panel, /Saving does not move money/);
assert.match(panel, /onChange=\{\(event\) => setDraft\(Number\(event\.target\.value\)\)\}/);
assert.doesNotMatch(
  panel.slice(panel.indexOf("type=\"range\""), panel.indexOf("Save plan")),
  /onSave|editGoal/,
);

const editModal = read("components/goals/EditGoalModal.tsx");
assert.doesNotMatch(editModal, /weeklySavings/);

const service = read("lib/supabase/services/financeService.ts");
const updateStart = service.indexOf("async updateGoal");
const updateEnd = service.indexOf("async addMoneyToGoal");
const updateGoal = service.slice(updateStart, updateEnd);
assert.match(updateGoal, /typeof input\.weeklySavings === "number"/);
assert.match(updateGoal, /mergeGoalUpdate/);
assert.match(updateGoal, /contributionFromStoredGoal/);
assert.doesNotMatch(updateGoal, /contribution_amount:/);

const context = read("context/FinanceContext.tsx");
assert.match(context, /applyGoalEdit\(goal, input, meta\.icon\)/);

console.log("Goal forecast, pace, and hypothetical plan checks passed.");
