const RECEIVING = "https://api.resend.com/emails/receiving";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inboxConnection(env = process.env) {
  const key = env.RESEND_API_KEY?.trim();
  const address = env.JARVIS_AGENCY_INBOX?.trim();
  if (!key) {
    return { connected: false, address: "", reason: "Agency inbox is not connected. Add RESEND_API_KEY on the budgetos project. Jarvis did not read or send mail." };
  }
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { connected: false, address: "", reason: "Set JARVIS_AGENCY_INBOX to the one agency address Jarvis may read. Jarvis will not read every received email." };
  }
  return { connected: true, address, reason: "" };
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

export async function pullAgencyInbox({ env = process.env, fetchImpl = fetch } = {}) {
  const status = inboxConnection(env);
  if (!status.connected) return { ...status, events: [] };
  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "User-Agent": "Jarvis/1.0", Accept: "application/json" };
  const listed = await fetchImpl(`${RECEIVING}?limit=10&to=${encodeURIComponent(status.address)}`, { method: "GET", headers });
  const response = listed.status === 422
    ? await fetchImpl(`${RECEIVING}?limit=10`, { method: "GET", headers })
    : listed;
  const body = await readBody(response);
  if (!response.ok) {
    const message = plain(body?.message || body?.error || response.statusText).slice(0, 180);
    return { connected: false, address: status.address, events: [], reason: `Agency inbox did not respond (${response.status}). ${message || "Enable Resend receiving for this address."}` };
  }
  const events = [];
  for (const item of Array.isArray(body?.data) ? body.data.slice(0, 10) : []) {
    const listedFor = recipients(item);
    if (!ID.test(String(item?.id ?? "")) || (listedFor.length && !listedFor.includes(status.address.toLowerCase()))) continue;
    const detailResponse = await fetchImpl(`${RECEIVING}/${item.id}`, { method: "GET", headers });
    const detail = detailResponse.ok ? await readBody(detailResponse) : {};
    const detailFor = recipients(detail);
    if (detailFor.length && !detailFor.includes(status.address.toLowerCase())) continue;
    const text = [item.subject, detail.text, plain(detail.html)].filter(Boolean).join("\n").trim();
    const from = senderName(detail.from || item.from);
    if (from.length < 3 || text.length < 3) continue;
    events.push({ messageId: item.id, from, text: text.slice(0, 4000) });
  }
  return { connected: true, address: status.address, events, reason: events.length ? "" : "No agency mail was waiting." };
}
