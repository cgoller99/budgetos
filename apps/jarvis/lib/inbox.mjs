const RECEIVING = "https://api.resend.com/emails/receiving";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_RUN = 10;

export function inboxConnection(env = process.env) {
  const key = env.RESEND_API_KEY?.trim();
  const address = env.JARVIS_AGENCY_INBOX?.trim();
  const replyRoute = "Replies to offers sent from christiangoller99@gmail.com land in that Gmail inbox. Jarvis reads only JARVIS_AGENCY_INBOX through Resend. Forward those replies to that address.";
  if (!key) {
    return { connected: false, address: "", replyRoute, reason: "Agency inbox is not connected. Add RESEND_API_KEY on the budgetos project. Jarvis did not read or send mail." };
  }
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { connected: false, address: "", replyRoute, reason: "Set JARVIS_AGENCY_INBOX to the one agency address Jarvis may read. Jarvis will not read every received email." };
  }
  return { connected: true, address, replyRoute, reason: "" };
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

export async function pullAgencyInbox({ env = process.env, fetchImpl = fetch, seen = new Set() } = {}) {
  const status = inboxConnection(env);
  const delay = pickupDelay(new Date(), 0);
  if (!status.connected) return { ...status, events: [], skipIds: [], remaining: 0, delay };
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
      if (listedFor.length && !listedFor.includes(status.address.toLowerCase())) {
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
