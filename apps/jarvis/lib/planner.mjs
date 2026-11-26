import { pickupDelay } from "./inbox.mjs";
import { chooseFocus } from "./pipeline.mjs";

export function chooseNext(state, now = new Date()) {
  const followUp = pickupDelay(new Date(now), 0);
  const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian");
  const due = (state.tasks ?? []).filter(task => task.dueAt && !["completed", "rejected", "failed"].includes(task.status) && Date.parse(task.dueAt) <= Date.parse(now));
  const issues = (state.issues ?? []).filter(issue => issue.status === "open");
  const approved = (state.tasks ?? []).filter(task => task.status === "approved" && task.risk !== "high");
  let action = "check-inbox";
  let summary = "No reply, deadline, or approved task is waiting. The next check reads the agency inbox. Nothing will be sent.";
  if (waiting.length) {
    action = "reply";
    summary = `${waiting[0].title} is first. ${waiting.length} decision${waiting.length === 1 ? "" : "s"} need Christian. Nothing will be sent.`;
  } else if (due.length) {
    action = "deadline";
    summary = `The next commitment is “${due[0].title}”. Nothing will be sent until it is approved.`;
  } else if (issues.length) {
    action = "fulfillment";
    summary = `Open fulfillment issue: ${issues[0].title}. Nothing will be purchased or sent.`;
  } else if (approved.length) {
    action = "approved";
    summary = `Next permitted work is “${approved[0].title}”. External sending, posting, and purchasing stay off.`;
  }
  return { action, summary, followUpAt: followUp.nextCheckBy, wait: followUp.summary, focus: chooseFocus(state, now) };
}
