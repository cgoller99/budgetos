const RECEIVING = "https://api.resend.com/emails/receiving";
const COMPOSIO = "https://backend.composio.dev/api/v3.1/tools/execute/";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_RUN = 10;
const SENDER = "christiangoller99@gmail.com";
const CONTROLLED = "buxmeapp@gmail.com";
const LABEL = "Jarvis-Agency";

export function agencySearchQuery() {
  return `(from:${CONTROLLED} to:${SENDER}) OR label:${LABEL}`;
}

function addresses(value) {
  return [...String(value ?? "").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(match => match[0].toLowerCase());
}

export function isAgencyReply(message, inboxAddress = "") {
  const from = addresses(message?.from)[0] ?? "";
  const to = [...addresses(message?.to), ...addresses(message?.deliveredTo), ...(Array.isArray(message?.to) ? message.to.flatMap(addresses) : [])];
  const labels = JSON.stringify(message?.labels ?? message?.labelIds ?? "").toLowerCase();
  if (!from || from === SENDER) return false;
  const labeled = labels.includes("jarvis-agency") || labels.includes("jarvis/agency");
  const controlled = from === CONTROLLED && (to.includes(SENDER) || to.length === 0);
  const forwarded = Boolean(inboxAddress) && to.includes(String(inboxAddress).toLowerCase());
  return labeled || controlled || forwarded;
}

export function inboxConnection(env = process.env) {
  const composio = env.COMPOSIO_API_KEY?.trim();
  const key = env.RESEND_API_KEY?.trim();
  const address = env.JARVIS_AGENCY_INBOX?.trim();
  const replyRoute = composio
    ? `Composio reads Gmail for ${SENDER} with one query: replies from ${CONTROLLED}, and threads labeled ${LABEL}. Other mail stays in Gmail.`
    : `Replies to offers sent from ${SENDER} land in that Gmail inbox. Jarvis reads only JARVIS_AGENCY_INBOX through Resend. Forward only the ${LABEL} label, including replies to offers already sent.`;
  if (composio) return { connected: true, provider: "composio", address: SENDER, replyRoute, reason: "" };
  if (!key) {
    return { connected: false, provider: "", address: "", replyRoute, reason: "Agency inbox is not connected. Add COMPOSIO_API_KEY for the existing Gmail connection, or RESEND_API_KEY on the budgetos project. Jarvis did not read or send mail." };
  }
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { connected: false, provider: "", address: "", replyRoute, reason: "Set JARVIS_AGENCY_INBOX to the one agency address Jarvis may read. Jarvis will not read every received email." };
  }
  return { connected: true, provider: "resend", address, replyRoute, reason: "" };
}

export function pickupDelay(now = new Date(), ahead = 0) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowEnd = day + 8 * 60 * 60 * 1000 - 1000;
  const latestToday = now.getTime() < day + 7 * 60 * 60 * 1000 ? windowEnd : windowEnd + 24 * 60 * 60 * 1000;
  const extraDays = Math.floor(Math.max(0, Number(ahead) || 0) / PER_RUN);
  const latest = new Date(latestToday + extraDays * 24 * 60 * 60 * 1000);
  const maxWaitMinutes = Math.max(1, Math.ceil((latest.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(maxWaitMinutes / 60);
  const minutes = maxWaitMinutes % 60;
  return {
    schedule: "15 7 * * *",
    perRun: PER_RUN,
    ahead: Math.max(0, Number(ahead) || 0),
    extraDays,
    nextCheckBy: latest.toISOString(),
    maxWaitMinutes,
    summary: `A reply can wait up to ${hours}h ${minutes}m. The check runs once during the 7:00 UTC hour and handles ${PER_RUN} unread messages. Later unread mail waits for the following check.`,
  };
}

function senderName(from) {
  const value = String(from ?? "").replace(/[\r\n]/g, " ").trim();
  const named = value.match(/^"?([^"<]{2,80})"?\s*</);
  return (named ? named[1] : value.replace(/<[^>]*>/g, "")).trim().slice(0, 120);
}

function plain(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function recipients(item) {
  return [...(item?.to ?? []), ...(item?.received_for ?? [])].map(entry => String(entry).toLowerCase());
}

async function readBody(response) {
  try { return await response.json(); }
  catch { return {}; }
}

async function listPage({ fetchImpl, headers, address, after }) {
  const params = new URLSearchParams({ limit: String(PER_RUN) });
  if (address) params.set("to", address);
  if (after) params.set("after", after);
  let response = await fetchImpl(`${RECEIVING}?${params}`, { method: "GET", headers });
  if (response.status === 422 && params.has("to")) {
    params.delete("to");
    response = await fetchImpl(`${RECEIVING}?${params}`, { method: "GET", headers });
  }
  return { response, body: await readBody(response) };
}

function messageRows(body) {
  const data = body?.data?.response_data ?? body?.data ?? body ?? {};
  const rows = data?.messages ?? data?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function composioTool(env, fetchImpl, slug, args) {
  const response = await fetchImpl(`${COMPOSIO}${slug}`, {
    method: "POST",
    headers: { "x-api-key": env.COMPOSIO_API_KEY.trim(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ user_id: env.COMPOSIO_USER_ID?.trim() || SENDER, arguments: { user_id: "me", ...args } }),
  });
  return { response, body: await readBody(response) };
}

async function pullComposio({ env, fetchImpl, seen, status, delay }) {
  const listed = await composioTool(env, fetchImpl, "GMAIL_FETCH_EMAILS", {
    query: agencySearchQuery(), max_results: PER_RUN, verbose: true, include_payload: true, include_spam_trash: false,
  });
  if (!listed.response.ok || listed.body?.successful === false) {
    const message = plain(listed.body?.error || listed.body?.message || listed.response.statusText).slice(0, 180);
    return { connected: false, provider: "composio", address: status.address, replyRoute: status.replyRoute, events: [], skipIds: [], remaining: 0, delay, reason: `Gmail did not respond (${listed.response.status}). ${message || "The Composio Gmail connection needs attention."}` };
  }
  const events = [];
  const skipIds = [];
  for (const item of messageRows(listed.body)) {
    const id = String(item?.messageId || item?.id || "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 80);
    if (id.length < 6 || seen.has(id) || events.some(event => event.messageId === id)) continue;
    const from = item.sender || item.from || "";
    const message = { from, to: item.recipient || item.to || "", labels: item.labelIds || item.labels || [], subject: item.subject || "" };
    if (!isAgencyReply(message)) {
      skipIds.push(id);
      continue;
    }
    let text = [item.subject, item.messageText, item.preview?.body, item.snippet].filter(Boolean).join("\n").trim();
    if (text.length < 3) {
      const detail = await composioTool(env, fetchImpl, "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", { message_id: id });
      const row = messageRows(detail.body)[0] ?? detail.body?.data ?? {};
      text = [item.subject, row.messageText, row.preview?.body, row.snippet, row.text].filter(Boolean).join("\n").trim();
    }
    const sender = senderName(from);
    if (sender.length < 3 || text.length < 3) {
      skipIds.push(id);
      continue;
    }
    events.push({ messageId: id, from: sender, text: text.slice(0, 4000), repliedAt: item.messageTimestamp || item.date || "" });
  }
  return { ...status, events, skipIds, remaining: 0, delay, reason: events.length ? "" : "No agency reply was waiting." };
}

export async function pullAgencyInbox({ env = process.env, fetchImpl = fetch, seen = new Set() } = {}) {
  const status = inboxConnection(env);
  const delay = pickupDelay(new Date(), 0);
  if (!status.connected) return { ...status, events: [], skipIds: [], remaining: 0, delay };
  if (status.provider === "composio") return pullComposio({ env, fetchImpl, seen, status, delay });
  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "User-Agent": "Jarvis/1.0", Accept: "application/json" };
  const events = [];
  const skipIds = [];
  let after = "";
  let remaining = 0;
  let reason = "";
  for (let page = 0; page < 5 && events.length < PER_RUN; page += 1) {
    const listed = await listPage({ fetchImpl, headers, address: status.address, after });
    if (!listed.response.ok) {
      const message = plain(listed.body?.message || listed.body?.error || listed.response.statusText).slice(0, 180);
      return { connected: false, address: status.address, replyRoute: status.replyRoute, events: [], skipIds, remaining: 0, delay, reason: `Agency inbox did not respond (${listed.response.status}). ${message || "Enable Resend receiving for this address."}` };
    }
    const rows = Array.isArray(listed.body?.data) ? listed.body.data : [];
    if (!rows.length) break;
    for (const item of rows) {
      const id = String(item?.id ?? "");
      if (!ID.test(id) || seen.has(id) || skipIds.includes(id) || events.some(event => event.messageId === id)) continue;
      const listedFor = recipients(item);
      if ((listedFor.length && !listedFor.includes(status.address.toLowerCase())) || !isAgencyReply({ from: item.from, to: listedFor.length ? listedFor : [status.address] }, status.address)) {
        skipIds.push(id);
        continue;
      }
      if (events.length >= PER_RUN) {
        remaining += 1;
        continue;
      }
      const detailResponse = await fetchImpl(`${RECEIVING}/${id}`, { method: "GET", headers });
      const detail = detailResponse.ok ? await readBody(detailResponse) : {};
      const detailFor = recipients(detail);
      if (detailFor.length && !detailFor.includes(status.address.toLowerCase())) {
        skipIds.push(id);
        continue;
      }
      const text = [item.subject, detail.text, plain(detail.html)].filter(Boolean).join("\n").trim();
      const from = senderName(detail.from || item.from);
      if (from.length < 3 || text.length < 3) {
        skipIds.push(id);
        continue;
      }
      events.push({ messageId: id, from, text: text.slice(0, 4000) });
    }
    after = String(rows.at(-1)?.id ?? "");
    if (listed.body?.has_more === true && events.length >= PER_RUN) remaining = Math.max(remaining, PER_RUN);
    if (listed.body?.has_more !== true || !ID.test(after)) break;
  }
  if (!events.length) reason = "No unread agency mail was waiting.";
  return { ...status, events, skipIds, remaining, delay: pickupDelay(new Date(), remaining), reason };
}
