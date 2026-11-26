import { randomUUID } from "node:crypto";

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
  const prior = state.inbox.find(item => item.messageId === messageId);
  if (prior) return { created: false, duplicate: true, item: prior, draft: state.drafts.find(draft => draft.id === prior.draftId) ?? null };
  const from = String(event?.from ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 120);
  const text = String(event?.text ?? "").trim().slice(0, 4000);
  if (from.length < 3 || text.length < 3) throw Object.assign(new Error("The reply needs a sender and a message."), { status: 400 });
  const excluded = EXCLUSIONS.find(item => item.test.test(from) || item.test.test(text));
  const at = new Date(now).toISOString();
  const interested = /\b(interested|yes|let's|lets|quote|how much|available|website)\b/i.test(text);
  const item = { messageId, from, text, at, business: "website-agency", excluded: Boolean(excluded), interested, draftId: null };
  state.inbox.push(item);
  let draft = null;
  if (excluded) {
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Ignored a message from ${from}. ${excluded.name} is on the exclusion list. Nothing was sent.`, taskId: null });
  } else if (interested) {
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
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Saved one draft for ${from}. It is waiting on Christian. Nothing was sent.`, taskId: null });
  } else {
    state.logs.push({ id: randomUUID(), at, level: "info", message: `Recorded a reply from ${from}. It did not ask for a quote, so no draft was created.`, taskId: null });
  }
  return { created: true, duplicate: false, item, draft };
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
    waiting: waiting.map(draft => ({ id: draft.id, title: draft.title, at: draft.createdAt, business: draft.business, sent: false })),
  };
}

export function answerFromRecords(text, state) {
  const asked = String(text ?? "").toLowerCase();
  if (/\bwho replied\b|\bwho needs me\b/.test(asked)) {
    const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian" && draft.business === "website-agency");
    if (!waiting.length) return "Nobody is waiting on you. No agency reply has been saved.";
    return waiting.map(draft => `${draft.title}. It is in Needs Christian and has not been sent.`).join(" ");
  }
  if (/what happened/.test(asked)) {
    const logs = (state.logs ?? []).slice(-5);
    if (!logs.length) return "Nothing has been recorded since this server started.";
    return logs.map(entry => entry.message).join(" ");
  }
  if (/scanner|drivenest|margin|supplier/.test(asked)) {
    return "DriveNest supplier cost is not connected, so delivered cost and margin are unknown. I will not estimate them. The scanner launch is held on that missing cost.";
  }
  if (/video|signup|sign up|subscription/.test(asked) && /buxme|yesterday/.test(asked)) {
    return "Buxme publishing, signups, and subscriptions are not connected. I cannot say whether yesterday’s video went out or whether anyone signed up.";
  }
  return null;
}

export function businessDesk(state) {
  const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian");
  return {
    buxme: {
      question: "Did yesterday’s video go out, and did anyone sign up?",
      connected: false,
      answer: "Publishing, signups, and subscriptions are not connected.",
      recovery: "Connect the video schedule and the signup source on the budgetos project. Until then Jarvis will not invent a count.",
      records: [],
    },
    agency: {
      question: "Did anybody reply, and who needs me?",
      connected: true,
      answer: waiting.length ? `${waiting.length} draft${waiting.length === 1 ? "" : "s"} waiting on you.` : "No reply is waiting.",
      recovery: "The daily cron reads the agency inbox. Sending still requires your approval.",
      records: waiting,
    },
    drivenest: {
      question: "What’s holding up the scanner launch?",
      connected: false,
      answer: "Supplier cost is unknown, so margin is unknown.",
      recovery: "Connect supplier cost, shipping, and inventory before Jarvis quotes a margin or publishes a listing.",
      blocker: "Supplier cost is not connected.",
      records: [],
    },
  };
}
