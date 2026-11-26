import { randomUUID } from "node:crypto";
import { EXCLUSIONS, etDay } from "./operator.mjs";
const UA = "Jarvis/1.0 (https://buxme.co)";
const CITY = /^[\p{L}\p{N}\s,.'-]{2,80}$/u;
const PLACE_KINDS = new Set(["city", "town", "village", "suburb", "municipality", "borough", "hamlet"]);
const SOCIAL = /(?:^|\.)((?:facebook|fb|instagram|tiktok|yelp)\.com|linktr\.ee|linkin\.bio)$/i;
const STALE = /(?:^|\.)(home\.comcast\.net|geocities\.com|angelfire\.com|tripod\.com|members\.aol\.com|homestead\.com)$/i;
const DIRECTORY = /(?:^|\.)((?:facebook|fb|instagram|tiktok|yelp|yellowpages|healthgrades|mapquest|google|bing|duckduckgo)\.com|bbb\.org|wikipedia\.org|linktr\.ee|linkin\.bio)$/i;
const OVERPASS = ["https://overpass.openstreetmap.fr/api/interpreter", "https://overpass-api.de/api/interpreter"];
const SEARCH = "https://html.duckduckgo.com/html/";
const HEADERS = { "User-Agent": UA, Accept: "application/json" };
export const INDUSTRIES = ["dental|dental|amenity|dentist", "legal|legal|office|lawyer", "home|home services|craft|plumber", "restaurant|restaurant|amenity|restaurant", "fitness|fitness|leisure|fitness_centre", "retail|retail|shop|clothes", "professional|professional|office|accountant", "automotive|automotive|shop|car_repair"].map(row => {
  const [id, label, key, value] = row.split("|");
  return { id, label, key, value };
});
export function industryFor(now) {
  const day = etDay(now);
  const index = Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${day.slice(0, 4)}-01-01T00:00:00Z`)) / 86400000);
  return INDUSTRIES[((index % INDUSTRIES.length) + INDUSTRIES.length) % INDUSTRIES.length];
}
export function pipeline(state) {
  const counts = { discovered: 0, contacted: 0, replies: 0, quotes: 0, deposits: 0, completed: 0, revenueCents: 0 };
  for (const lead of state.leads ?? []) {
    if (lead.business !== "website-agency") continue;
    const contacted = lead.contacted === true;
    if (lead.stage === "sold") counts.completed += 1;
    else if (lead.stage === "deposit" && Number.isInteger(lead.depositCents)) counts.deposits += 1;
    else if (lead.stage === "quoted") counts.quotes += 1;
    else if (lead.stage === "replied" || lead.stage === "responded") counts.replies += 1;
    else if (contacted || lead.stage === "contacted") counts.contacted += 1;
    else if (lead.source === "openstreetmap" && lead.stage === "discovered") counts.discovered += 1;
    if (contacted && (lead.stage === "deposit" || lead.stage === "sold") && Number.isInteger(lead.depositCents) && lead.depositCents > 0) counts.revenueCents += lead.depositCents;
  }
  const priced = (state.drafts ?? []).filter(draft => draft.business === "website-agency" && /^Offer for /.test(draft.title ?? "") && /\$\s?\d/.test(draft.body ?? "")).length;
  if (!counts.quotes) counts.quotes = priced;
  return counts;
}
export function chooseWork(state) {
  const waiting = (state.drafts ?? []).find(draft => draft.status === "needs-christian");
  if (waiting) return { business: waiting.business, reason: `${waiting.title} is the next step. It needs your approval before anything is sent.` };
  const offer = (state.drafts ?? []).find(draft => draft.kind === "offer" && draft.status === "draft");
  if (offer) return { business: "website-agency", reason: `${offer.title} needs a price you approve. Nothing has been sent, and this is not revenue.` };
  const open = (state.leads ?? []).find(lead => lead.source === "openstreetmap" && lead.stage === "discovered" && lead.contacted !== true && !(state.drafts ?? []).some(draft => draft.leadId === lead.id));
  if (open) return { business: "website-agency", reason: `Prepare an offer for ${open.name}. They have not been contacted, so this is not revenue.` };
  if (!String(state.settings?.discoveryArea ?? "").trim()) return { business: "website-agency", reason: "Save a city and Jarvis will look up real businesses. None have been invented." };
  return { business: "website-agency", reason: "The next check searches OpenStreetMap in the saved city. Buxme and DriveNest stay blocked until their sources are connected." };
}
export function pageEvidence(html, now) {
  const text = String(html ?? "").slice(0, 500000);
  if (/under construction|coming soon|domain (?:is )?for sale|this domain is parked/i.test(text)) return "The page says it is unfinished or for sale.";
  const years = [...text.matchAll(/(?:©|\(c\)|copyright)\s*(20\d{2})/gi)].map(match => Number(match[1]));
  const newest = years.length ? Math.max(...years) : 0;
  if (newest && newest <= Number(etDay(now).slice(0, 4)) - 6) return `The page copyright is ${newest}.`;
  return "";
}
function blockedLines(extra = []) {
  return [...extra, "Buxme publishing, signups, and subscriptions are not connected. No campaign was ranked or created.", "No verified supplier page with a delivered cost and shipping cost is on file. No DriveNest product was recommended."];
}
function pushReport(state, now, accomplished, extra = []) {
  state.reports ??= [];
  const offer = (state.drafts ?? []).find(item => item.kind === "offer" && item.status === "draft");
  const report = {
    id: randomUUID(), at: new Date(now).toISOString(), accomplished, blocked: blockedLines(extra), sent: false,
    needsApproval: (state.drafts ?? []).filter(draft => draft.status === "needs-christian" || (draft.kind === "offer" && draft.status === "draft")).map(draft => draft.title),
    pipeline: pipeline(state), choice: chooseWork(state).reason, offer: offer ? { title: offer.title, body: offer.body } : null,
    prospects: (state.leads ?? []).filter(lead => lead.source === "openstreetmap" && (lead.stage === "discovered" || lead.stage === "checked") && lead.contacted !== true).slice(-8).map(lead => ({ name: lead.name, industry: lead.industry, evidence: lead.evidence, sourceUrl: lead.sourceUrl })),
  };
  state.reports.push(report);
  if (state.reports.length > 14) state.reports.splice(0, state.reports.length - 14);
  return report;
}
export function noteBlockedDay(state, now) {
  state.reports ??= [];
  const prior = [...state.reports].reverse().find(report => etDay(report.at) === etDay(now));
  if (prior) return prior;
  return pushReport(state, now, ["No city is saved, so no business was looked up. No prospects were invented."], ["No city is saved. No prospects were invented."]);
}
function listedWebsite(tags) {
  const raw = String(tags?.website || tags?.["contact:website"] || tags?.url || "").trim();
  return !raw || /^(none|n\/a|na|-|no)$/i.test(raw) ? "" : raw.slice(0, 300);
}
function hostOf(value) {
  try { return new URL(String(value).startsWith("http") ? value : `https://${value}`).hostname; } catch { return ""; }
}
export function publicHttpUrl(value) {
  try {
    const url = new URL(String(value).startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const [a, b] = host.split(".").map(Number);
    const privateIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) && ([0, 10, 127].includes(a) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
    if (url.username || url.password || !/^https?:$/.test(url.protocol) || !host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":") || privateIp) return "";
    return url.toString();
  } catch { return ""; }
}
function identityOf(tags = {}) {
  const phone = String(tags.phone || tags["contact:phone"] || "").replace(/\D/g, "");
  const number = String(tags["addr:housenumber"] || "").trim();
  const road = String(tags["addr:street"] || "").trim();
  if ((!number || !road) && phone.length < 10) return null;
  return { phone: phone.length >= 10 ? phone.slice(-10) : "", number, road, city: String(tags["addr:city"] || "").trim() };
}
function pageMatch(html, name, id) {
  const text = String(html || "").toLowerCase();
  const words = name.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  if (!words.length || words.some(word => !text.includes(word))) return "";
  if (id.phone && text.replace(/\D/g, "").includes(id.phone)) return "phone";
  const road = id.road.toLowerCase().split(/\s+/)[0];
  return id.number && text.includes(id.number) && road && text.includes(road) ? "address" : "";
}
async function pageText(url, fetchImpl) {
  const safe = publicHttpUrl(url);
  if (!safe) return "";
  try {
    const response = await fetchImpl(safe, { method: "GET", redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    const moved = typeof response?.url === "string" ? response.url : "";
    const type = response?.headers?.get?.("content-type") ?? "";
    if (!response?.ok || typeof response?.text !== "function" || (moved && !publicHttpUrl(moved)) || (type && !/html|text\/plain/i.test(type)) || DIRECTORY.test(hostOf(moved))) return "";
    return String(await response.text()).slice(0, 500000);
  } catch { return ""; }
}
function resultLinks(html) {
  const found = [];
  for (const match of String(html || "").matchAll(/uddg=([^&"]+)/g)) {
    let url = "";
    try { url = publicHttpUrl(decodeURIComponent(match[1])); } catch { url = ""; }
    if (url && !DIRECTORY.test(hostOf(url)) && !found.includes(url)) found.push(url);
    if (found.length === 2) break;
  }
  return found;
}
function candidate(element, industry) {
  const tags = element?.tags ?? {};
  const name = String(tags.name ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 80);
  const identity = identityOf(tags);
  if (name.length < 2 || (element?.type !== "node" && element?.type !== "way") || !Number.isInteger(element?.id) || tags[industry.key] !== industry.value || !identity) return null;
  const sourceId = `${element.type}/${element.id}`;
  return { name, sourceId, sourceUrl: `https://www.openstreetmap.org/${sourceId}`, industry: industry.label, listed: listedWebsite(tags), identity };
}
async function judge(item, fetchImpl, now) {
  const where = item.identity.number ? `${item.identity.number} ${item.identity.road}` : `phone ${item.identity.phone}`;
  const verdict = (html, site, matched) => {
    const old = pageEvidence(html, now) || (STALE.test(hostOf(site)) ? `The listed host is outdated (${hostOf(site)}).` : "");
    return { opportunity: Boolean(old), site: old ? "" : site, evidence: old ? `${old} The page matches the name and ${matched}.` : `Website ${site} matches the name and ${matched}. No offer was drafted.` };
  };
  const listed = publicHttpUrl(item.listed);
  const listedHost = hostOf(listed).toLowerCase();
  if (listed && !DIRECTORY.test(listedHost)) {
    const html = await pageText(listed, fetchImpl);
    const matched = pageMatch(html, item.name, item.identity);
    if (matched) return verdict(html, listed, matched);
  }
  let body = null;
  try {
    const query = [item.name, item.identity.number, item.identity.road, item.identity.city].filter(Boolean).join(" ");
    const search = await fetchImpl(`${SEARCH}?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    body = search?.ok && typeof search.text === "function" ? await search.text() : null;
  } catch { return null; }
  if (!body || !/result__a|web-result|uddg=/i.test(body)) return null;
  let unread = false;
  for (const link of resultLinks(body)) {
    const html = await pageText(link, fetchImpl);
    const matched = html && pageMatch(html, item.name, item.identity);
    if (matched) return verdict(html, link, matched);
    if (!html) unread = true;
  }
  if (unread) return null;
  const social = listedHost && SOCIAL.test(listedHost) ? ` OpenStreetMap lists only ${listedHost}.` : "";
  return { opportunity: true, site: "", evidence: `No website matched ${item.name} at ${where}.${social}` };
}
async function qualifyAll(elements, industry, fetchImpl, now, prefer = []) {
  const wanted = new Set(prefer);
  const rank = item => (wanted.has(item.sourceId) ? 0 : 2) + (publicHttpUrl(item.listed) && !DIRECTORY.test(hostOf(item.listed)) ? 1 : 0);
  const ranked = elements.map(element => candidate(element, industry)).filter(Boolean).sort((a, b) => rank(a) - rank(b));
  const prospects = [], checked = [];
  let attempts = 0;
  for (const item of ranked) {
    if (attempts >= 5 || prospects.length >= 5) break;
    attempts += 1;
    const verdict = await judge(item, fetchImpl, now);
    if (!verdict) continue;
    (verdict.opportunity ? prospects : checked).push({ name: item.name, sourceId: item.sourceId, sourceUrl: item.sourceUrl, industry: item.industry, evidence: verdict.evidence, site: verdict.site || "" });
  }
  return { prospects, checked };
}
async function geocode(area, fetchImpl) {
  const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=jsonv2&limit=5`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!response?.ok) throw new Error("lookup failed");
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const place = rows.find(row => PLACE_KINDS.has(row.type) || PLACE_KINDS.has(row.addresstype)) ?? rows[0];
  const [south, north, west, east] = (place.boundingbox ?? []).map(Number);
  if (![south, north, west, east].every(Number.isFinite) || !(south < north && west < east)) return null;
  return { bbox: { south, west, north, east }, tooLarge: north - south > 0.8 || east - west > 0.8 };
}
async function overpass(bbox, industry, fetchImpl) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const data = `[out:json][timeout:15];(node["${industry.key}"="${industry.value}"]["name"](${box});way["${industry.key}"="${industry.value}"]["name"](${box}););out center 40;`;
  for (const host of OVERPASS) {
    try {
      const response = await fetchImpl(host, { method: "POST", headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(data)}`, signal: AbortSignal.timeout(15000) });
      if (!response?.ok || typeof response.json !== "function") continue;
      const body = await response.json();
      if (Array.isArray(body?.elements)) return body.elements;
    } catch { /* try the next public search server */ }
  }
  throw new Error("lookup failed");
}
export async function searchBusinesses({ area, now, fetchImpl, prefer = [] }) {
  const clean = String(area ?? "").trim();
  const empty = { prospects: [], checked: [], scanned: 0, industry: "", error: "" };
  if (!CITY.test(clean)) return { ...empty, error: "Enter a city name. No prospects were invented." };
  let place;
  try { place = await geocode(clean, fetchImpl); }
  catch { return { ...empty, error: "The business search did not respond. No prospects were invented." }; }
  if (!place) return { ...empty, error: "That area was not found on OpenStreetMap. No prospects were invented." };
  if (place.tooLarge) return { ...empty, error: "That area is too large. Name a city. No prospects were invented." };
  const start = industryFor(now);
  let prospects = [];
  let checked = [];
  let scanned = 0;
  let industryName = "";
  for (let offset = 0; offset < 2 && prospects.length === 0; offset += 1) {
    const industry = INDUSTRIES[(INDUSTRIES.indexOf(start) + offset) % INDUSTRIES.length];
    let elements;
    try { elements = await overpass(place.bbox, industry, fetchImpl); }
    catch { return { prospects, checked, scanned, industry: industryName, error: "The business search did not respond. No prospects were invented." }; }
    scanned += elements.length;
    industryName = industryName ? `${industryName} and ${industry.label}` : industry.label;
    const qualified = await qualifyAll(elements, industry, fetchImpl, now, prefer);
    prospects = qualified.prospects;
    checked = checked.concat(qualified.checked);
  }
  return { prospects, checked, scanned, industry: prospects[0]?.industry || checked[0]?.industry || industryName, tried: industryName, error: "" };
}
function saveLead(state, item, at, stage) {
  state.leads.push({
    id: randomUUID(), business: "website-agency", name: item.name, url: item.site || "", note: item.evidence, stage,
    source: "openstreetmap", sourceId: item.sourceId, sourceUrl: item.sourceUrl, industry: item.industry,
    evidence: item.evidence, contacted: false, createdAt: at,
  });
}
function prepareOffer(state, at) {
  if ((state.drafts ?? []).some(draft => draft.kind === "offer" && draft.status === "draft")) return null;
  const lead = (state.leads ?? []).find(item => item.source === "openstreetmap" && item.stage === "discovered" && item.contacted !== true && !(state.drafts ?? []).some(draft => draft.leadId === item.id));
  if (!lead) return null;
  state.drafts.push({
    id: randomUUID(), business: "website-agency", leadId: lead.id, kind: "offer", status: "draft", externalAction: "not_performed", createdAt: at,
    title: `Offer for ${lead.name}`.slice(0, 120),
    body: `${lead.name} is a ${lead.industry} business found on OpenStreetMap.\nEvidence: ${lead.evidence}\nSource: ${lead.sourceUrl}\nOffer: a simple website they can own. Price: blank until you set it.\nThis prospect has not been contacted. This is not revenue.\nNothing was sent.`,
  });
  return { name: lead.name };
}
export function applyDiscovery(state, found, { area, now }) {
  state.leads ??= [];
  state.drafts ??= [];
  state.logs ??= [];
  state.settings ??= {};
  const at = new Date(now).toISOString();
  Object.assign(state.settings, { discoveryArea: area, lastDiscoveryDay: etDay(now), lastDiscoveryOk: !found.error });
  const added = [];
  const noted = [];
  let skipped = 0;
  if (!found.error) {
    for (const item of found.checked ?? []) {
      if (EXCLUSIONS.some(rule => rule.test.test(item.name))) continue;
      const prior = state.leads.find(lead => lead.sourceId === item.sourceId);
      const correct = prior && (prior.stage === "discovered" || /lists no website/i.test(`${prior.evidence || ""} ${prior.note || ""}`));
      if (prior && correct) {
        prior.stage = "checked"; prior.evidence = item.evidence; prior.note = item.evidence; prior.url = item.site || ""; prior.contacted = false;
        state.drafts = state.drafts.filter(draft => !(draft.leadId === prior.id && draft.kind === "offer" && draft.status === "draft"));
      } else if (!prior && state.leads.length < 200) saveLead(state, item, at, "checked");
      else continue;
      noted.push(`${item.name}: ${item.evidence}`);
    }
    for (const prospect of found.prospects ?? []) {
      if (added.length >= 5 || state.leads.length >= 200) break;
      if (EXCLUSIONS.some(rule => rule.test.test(prospect.name))) { skipped += 1; continue; }
      if (state.leads.some(lead => lead.sourceId === prospect.sourceId)) continue;
      saveLead(state, prospect, at, "discovered");
      added.push(prospect.name);
    }
  }
  const offer = prepareOffer(state, at);
  const accomplished = [];
  if (found.error) accomplished.push("The lookup did not finish. No prospects were invented.");
  else if (added.length) accomplished.push(`Found ${added.length} real ${found.industry} ${added.length === 1 ? "business" : "businesses"} in ${area} on OpenStreetMap. None were contacted.`);
  else if (!noted.length) accomplished.push(`Checked ${found.scanned ?? 0} ${found.industry || "OpenStreetMap"} listings in ${area}. No new missing or outdated website was found. No prospects were invented.`);
  for (const line of noted.slice(0, 3)) accomplished.push(line);
  if (offer) accomplished.push(`Prepared an unsent offer checklist for ${offer.name}. The price is blank.`);
  const report = pushReport(state, now, accomplished, found.error ? [found.error] : []);
  for (const message of accomplished) state.logs.push({ id: randomUUID(), at, level: "info", message, taskId: null });
  if (skipped) state.logs.push({ id: randomUUID(), at, level: "info", message: `Skipped ${skipped} on the exclusion list.`, taskId: null });
  return report;
}
