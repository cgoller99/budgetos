import { randomUUID } from "node:crypto";
import { pickupDelay } from "./inbox.mjs";
import { describeBusinesses } from "./operations.mjs";
import { chooseNext } from "./planner.mjs";

export const EXCLUSIONS = [
  { name: "Atlanta Auto Diesel", test: /atlanta auto diesel/i },
  { name: "Reynolds and Sons Automotive", test: /reynolds(?: and sons| & sons)/i },
];

const MESSAGE_ID = /^[A-Za-z0-9._:-]{6,80}$/;

export function ingestAgencyReply(state, event, now = new Date()) {
  const messageId = String(event?.messageId ?? "").trim();
  if (!MESSAGE_ID.test(messageId)) throw Object.assign(new Error("A stable message id is required."), { status: 400 });
  state.inbox ??= [];
  state.drafts ??= [];
  state.logs ??= [];
  state.previews ??= [];
  const prior = state.inbox.find(item => item.messageId === messageId);
  if (prior) {
    return {
      created: false,
      duplicate: true,
      item: prior,
      draft: state.drafts.find(draft => draft.id === prior.draftId) ?? null,
      preview: state.previews.find(preview => preview.messageId === messageId) ?? null,
    };
  }
  const from = String(event?.from ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 120);
  const text = String(event?.text ?? "").trim().slice(0, 4000);
  if (from.length < 3 || text.length < 3) throw Object.assign(new Error("The reply needs a sender and a message."), { status: 400 });
  const excluded = EXCLUSIONS.find(item => item.test.test(from) || item.test.test(text));
  const at = new Date(now).toISOString();
  const optedOut = /\b(unsubscribe|stop emailing|remove me|do not contact|opt out)\b/i.test(text);
  const replyToOffer = /^\s*re\s*:/i.test(text);
  const interested = /\b(interested|yes|let's|lets|quote|how much|available|website)\b/i.test(text);
  const item = { messageId, from, text, at, business: "website-agency", excluded: Boolean(excluded), interested: interested || replyToOffer, draftId: null };
  state.inbox.push(item);
  let draft = null;
  if (excluded) {
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Ignored a message from ${from}. ${excluded.name} is on the exclusion list. Nothing was sent.`, taskId: null });
  } else if (optedOut) {
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Recorded an opt-out from ${from}. Nothing was sent.`, taskId: null });
  } else if (interested || replyToOffer) {
    draft = {
      id: randomUUID(),
      business: "website-agency",
      messageId,
      kind: "outreach",
      title: `Reply to ${from}`.slice(0, 120),
      body: `They wrote:\n${text.slice(0, 800)}\n\nDraft: Thanks for writing. I can prepare a website preview after you confirm the pages you want. This was not sent.`,
      status: "needs-christian",
      externalAction: "not_performed",
      createdAt: at,
    };
    state.drafts.push(draft);
    item.draftId = draft.id;
    state.previews.push({ id: draft.id, draftId: draft.id, messageId, prospect: from, brief: text.slice(0, 800), createdAt: at });
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Saved one draft for ${from}. It is waiting on Christian. Nothing was sent.`, taskId: null });
  } else {
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Recorded a reply from ${from}. It did not ask for a quote, so no draft was created.`, taskId: null });
  }
  return { created: true, duplicate: false, item, draft, preview: state.previews.find(preview => preview.messageId === messageId) ?? null };
}

export function etDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}

export function recordOperatorRun(state, { trigger = "schedule", connected = false, created = 0, now = new Date() } = {}) {
  state.runs ??= [];
  const at = new Date(now).toISOString();
  const next = chooseNext(state, now);
  const decision = connected
    ? next.summary
    : `The agency inbox is not connected, so no mail was read. ${next.summary}`;
  const run = { id: randomUUID(), at, trigger: String(trigger).slice(0, 40), created, action: next.action, decision, followUpAt: next.followUpAt, wait: next.wait };
  state.runs.push(run);
  if (state.runs.length > 40) state.runs.splice(0, state.runs.length - 40);
  return run;
}

export function rememberSkip(state, messageId, now = new Date()) {
  state.inbox ??= [];
  if (!MESSAGE_ID.test(messageId) || state.inbox.some(item => item.messageId === messageId)) return;
  state.inbox.push({ messageId, from: "", text: "", at: new Date(now).toISOString(), business: "website-agency", excluded: false, interested: false, draftId: null, skipped: true });
  const skips = state.inbox.filter(item => item.skipped);
  if (skips.length <= 200) return;
  const drop = new Set(skips.slice(0, skips.length - 200).map(item => item.messageId));
  state.inbox = state.inbox.filter(item => !drop.has(item.messageId));
}

export function briefing(state, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, Christian`;
  const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian");
  const latest = (state.logs ?? []).at(-1);
  return {
    greeting,
    headline: latest?.message ?? "Nothing new has been recorded.",
    headlineAt: latest?.at ?? null,
    waiting: waiting.map(draft => {
      const preview = (state.previews ?? []).find(item => item.draftId === draft.id);
      return {
        id: draft.id,
        title: draft.title,
        at: draft.createdAt,
        business: draft.business,
        sent: false,
        previewId: preview?.id ?? null,
        sharePath: preview?.shareToken ? `/jarvis/share/${preview.shareToken}` : null,
      };
    }),
    operator: {
      lastRunAt: state.runs?.at(-1)?.at ?? null,
      decision: state.runs?.at(-1)?.decision ?? "The hosted check has not run on this server yet.",
      backlog: waiting.length,
      nextCheckBy: state.runs?.at(-1)?.followUpAt ?? pickupDelay(now).nextCheckBy,
      wait: state.runs?.at(-1)?.wait ?? pickupDelay(now).summary,
    },
  };
}

export function answerFromRecords(text, state, now = new Date()) {
  const asked = String(text ?? "").toLowerCase();
  if (/\bwho replied\b|\bwho needs me\b/.test(asked)) {
    const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian" && draft.business === "website-agency");
    if (!waiting.length) return "Nobody is waiting on you. No agency reply has been saved.";
    return waiting.map(draft => `${draft.title}. It is in Needs Christian and has not been sent.${(state.previews ?? []).some(preview => preview.draftId === draft.id) ? " A website preview is ready and has not been launched." : ""}`).join(" ");
  }
  if (/what happened/.test(asked)) {
    const today = etDay(now);
    const logs = (state.logs ?? []).filter(entry => etDay(entry.at) === today);
    if (!logs.length) return "Nothing has been recorded today.";
    return logs.slice(-5).map(entry => entry.message).join(" ");
  }
  if (/scanner|drivenest|margin|supplier/.test(asked)) {
    const product = (state.products ?? []).find(item => item.deliveredCents != null);
    if (!product) return "DriveNest supplier cost is not connected, so delivered cost and margin are unknown. I will not estimate them. The scanner launch is held on that missing cost.";
    const desk = describeBusinesses(state).drivenest;
    return desk.answer;
  }
  if (/video|signup|sign up|subscription/.test(asked) && /buxme|yesterday/.test(asked)) {
    if (!state.buxmeReading) return "Buxme publishing, signups, and subscriptions are not connected. I cannot say whether yesterday’s video went out or whether anyone signed up.";
    return describeBusinesses(state).buxme.answer;
  }
  return null;
}

export function businessDesk(state) {
  return describeBusinesses(state);
}
