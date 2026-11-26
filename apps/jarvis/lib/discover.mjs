import { randomUUID } from "node:crypto";
import { EXCLUSIONS, etDay } from "./operator.mjs";

const UA = "Jarvis/1.0 (https://buxme.co)";
const CITY = /^[\p{L}\p{N}\s,.'-]{2,80}$/u;
const PLACE_KINDS = new Set(["city", "town", "village", "suburb", "municipality", "borough", "hamlet"]);
const SOCIAL = /(?:^|\.)((?:facebook|fb|instagram|tiktok|yelp)\.com|linktr\.ee|linkin\.bio)$/i;
const STALE = /(?:^|\.)(home\.comcast\.net|geocities\.com|angelfire\.com|tripod\.com|members\.aol\.com|homestead\.com)$/i;
const OVERPASS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export const INDUSTRIES = [
  { id: "dental", label: "dental", key: "amenity", value: "dentist" },
  { id: "legal", label: "legal", key: "office", value: "lawyer" },
  { id: "home", label: "home services", key: "craft", value: "plumber" },
  { id: "restaurant", label: "restaurant", key: "amenity", value: "restaurant" },
  { id: "fitness", label: "fitness", key: "leisure", value: "fitness_centre" },
  { id: "retail", label: "retail", key: "shop", value: "clothes" },
  { id: "professional", label: "professional", key: "office", value: "accountant" },
  { id: "automotive", label: "automotive", key: "shop", value: "car_repair" },
];

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
    if (contacted && (lead.stage === "deposit" || lead.stage === "sold") && Number.isInteger(lead.depositCents) && lead.depositCents > 0) {
      counts.revenueCents += lead.depositCents;
    }
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
  const text = String(html ?? "").slice(0, 20000);
  if (/under construction|coming soon|domain (?:is )?for sale|this domain is parked/i.test(text)) return "The page says it is unfinished or for sale.";
  const years = [...text.matchAll(/(?:©|\(c\)|copyright)\s*(20\d{2})/gi)].map(match => Number(match[1]));
  const newest = years.length ? Math.max(...years) : 0;
  const year = Number(etDay(now).slice(0, 4));
  if (newest && newest <= year - 6) return `The page copyright is ${newest}.`;
  return "";
}

function blockedLines(extra = []) {
  return [
    ...extra,
    "Buxme publishing, signups, and subscriptions are not connected. No campaign was ranked or created.",
    "No verified supplier page with a delivered cost and shipping cost is on file. No DriveNest product was recommended.",
  ];
}

function approvalTitles(state) {
  return (state.drafts ?? [])
    .filter(draft => draft.status === "needs-christian" || (draft.kind === "offer" && draft.status === "draft"))
    .map(draft => draft.title);
}

function currentOffer(state) {
  const draft = (state.drafts ?? []).find(item => item.kind === "offer" && item.status === "draft");
  return draft ? { title: draft.title, body: draft.body } : null;
}

function rememberedProspects(state) {
  return (state.leads ?? [])
    .filter(lead => lead.source === "openstreetmap" && lead.stage === "discovered" && lead.contacted !== true)
    .slice(-8)
    .map(lead => ({ name: lead.name, industry: lead.industry, evidence: lead.evidence, sourceUrl: lead.sourceUrl }));
}

function pushReport(state, now, accomplished, extra = []) {
  state.reports ??= [];
  const report = {
    id: randomUUID(), at: new Date(now).toISOString(), accomplished, blocked: blockedLines(extra),
    needsApproval: approvalTitles(state), pipeline: pipeline(state), prospects: rememberedProspects(state),
    offer: currentOffer(state), choice: chooseWork(state).reason, sent: false,
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
  if (!raw || /^(none|n\/a|na|-|no)$/i.test(raw)) return "";
  return raw.slice(0, 300);
}

function hostOf(value) {
  try { return new URL(value.startsWith("http") ? value : `https://${value}`).hostname; }
  catch { return ""; }
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

function prospectFromElement(element, industry) {
  const name = String(element?.tags?.name ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 80);
  if (name.length < 2 || (element.type !== "node" && element.type !== "way") || !Number.isInteger(element.id)) return null;
  if (element.tags?.[industry.key] !== industry.value) return null;
  const sourceId = `${element.type}/${element.id}`;
  const base = { name, sourceId, sourceUrl: `https://www.openstreetmap.org/${sourceId}`, industry: industry.label, evidence: "", site: "" };
  const listed = listedWebsite(element.tags);
  if (!listed) return { ...base, evidence: "OpenStreetMap lists no website." };
  const host = hostOf(listed).toLowerCase();
  if (!host) return { ...base, evidence: "OpenStreetMap lists a website value that is not a link." };
  if (SOCIAL.test(host)) return { ...base, evidence: `OpenStreetMap lists only a social page (${host}).` };
  if (STALE.test(host)) return { ...base, evidence: `OpenStreetMap lists an outdated host (${host}).` };
  return { ...base, site: listed };
}

async function fetchEvidence(site, fetchImpl, now) {
  const url = publicHttpUrl(site);
  if (!url) return "";
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (!response?.ok || (typeof response.url === "string" && response.url && !publicHttpUrl(response.url))) return "";
    const finalHost = typeof response.url === "string" && response.url ? hostOf(response.url).toLowerCase() : "";
    if (finalHost && SOCIAL.test(finalHost)) return `The listed website redirects to a social page (${finalHost}).`;
    const type = response.headers?.get?.("content-type") ?? "";
    if ((type && !/html|text\/plain/i.test(type)) || typeof response.text !== "function") return "";
    return pageEvidence(await response.text(), now);
  } catch { return ""; }
}

async function qualifyAll(elements, industry, fetchImpl, now) {
  const ready = [];
  const pages = [];
  for (const element of elements) {
    const prospect = prospectFromElement(element, industry);
    if (!prospect) continue;
    if (prospect.evidence) ready.push(prospect);
    else if (pages.length < 2) pages.push(prospect);
  }
  if (ready.length >= 3) return ready.slice(0, 5);
  for (const page of pages) {
    if (ready.length >= 5) break;
    const evidence = await fetchEvidence(page.site, fetchImpl, now);
    if (evidence) ready.push({ ...page, evidence, site: "" });
  }
  return ready.slice(0, 5);
}

async function geocode(area, fetchImpl) {
  const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=jsonv2&limit=5`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
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
      const response = await fetchImpl(host, {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(data)}`,
        signal: AbortSignal.timeout(15000),
      });
      if (!response?.ok || typeof response.json !== "function") continue;
      const body = await response.json();
      if (Array.isArray(body?.elements)) return body.elements;
    } catch { /* try the next public search server */ }
  }
  throw new Error("lookup failed");
}

export async function searchBusinesses({ area, now, fetchImpl }) {
  const clean = String(area ?? "").trim();
  const empty = { prospects: [], scanned: 0, industry: "", error: "" };
  if (!CITY.test(clean)) return { ...empty, error: "Enter a city name. No prospects were invented." };
  let place;
  try { place = await geocode(clean, fetchImpl); }
  catch { return { ...empty, error: "The business search did not respond. No prospects were invented." }; }
  if (!place) return { ...empty, error: "That area was not found on OpenStreetMap. No prospects were invented." };
  if (place.tooLarge) return { ...empty, error: "That area is too large. Name a city. No prospects were invented." };
  const start = industryFor(now);
  const tried = [];
  let prospects = [];
  let scanned = 0;
  for (let offset = 0; offset < 2 && prospects.length === 0; offset += 1) {
    const industry = INDUSTRIES[(INDUSTRIES.indexOf(start) + offset) % INDUSTRIES.length];
    let elements;
    try { elements = await overpass(place.bbox, industry, fetchImpl); }
    catch { return { prospects: [], scanned, industry: tried.join(" and "), error: "The business search did not respond. No prospects were invented." }; }
    scanned += elements.length;
    tried.push(industry.label);
    prospects = await qualifyAll(elements, industry, fetchImpl, now);
  }
  return { prospects, scanned, industry: prospects[0]?.industry || tried.join(" and "), tried, error: "" };
}

function prepareOffer(state, at) {
  if ((state.drafts ?? []).some(draft => draft.kind === "offer" && draft.status === "draft")) return null;
  const lead = (state.leads ?? []).find(item => item.source === "openstreetmap" && item.stage === "discovered" && item.contacted !== true && !(state.drafts ?? []).some(draft => draft.leadId === item.id));
  if (!lead) return null;
  const draft = {
    id: randomUUID(), business: "website-agency", leadId: lead.id, kind: "offer", status: "draft", externalAction: "not_performed", createdAt: at,
    title: `Offer for ${lead.name}`.slice(0, 120),
    body: `${lead.name} is a ${lead.industry} business found on OpenStreetMap.\nEvidence: ${lead.evidence}\nSource: ${lead.sourceUrl}\nOffer: a simple website they can own. Price: blank until you set it.\nThis prospect has not been contacted. This is not revenue.\nNothing was sent.`,
  };
  state.drafts.push(draft);
  return { name: lead.name, id: draft.id };
}

export function applyDiscovery(state, found, { area, now }) {
  state.leads ??= [];
  state.drafts ??= [];
  state.logs ??= [];
  state.settings ??= {};
  const at = new Date(now).toISOString();
  state.settings.discoveryArea = area;
  state.settings.lastDiscoveryDay = etDay(now);
  state.settings.lastDiscoveryOk = !found.error;
  const added = [];
  let skipped = 0;
  if (!found.error) {
    for (const prospect of found.prospects ?? []) {
      if (added.length >= 5 || state.leads.length >= 200) break;
      if (EXCLUSIONS.some(item => item.test.test(prospect.name))) { skipped += 1; continue; }
      if (state.leads.some(lead => lead.sourceId === prospect.sourceId)) continue;
      const lead = {
        id: randomUUID(), business: "website-agency", name: prospect.name, url: "", note: prospect.evidence, stage: "discovered",
        source: "openstreetmap", sourceId: prospect.sourceId, sourceUrl: prospect.sourceUrl, industry: prospect.industry,
        evidence: prospect.evidence, contacted: false, createdAt: at,
      };
      state.leads.push(lead);
      added.push(lead);
    }
  }
  const offer = prepareOffer(state, at);
  const accomplished = [];
  if (found.error) accomplished.push("The lookup did not finish. No prospects were invented.");
  else if (added.length) accomplished.push(`Found ${added.length} real ${found.industry} ${added.length === 1 ? "business" : "businesses"} in ${area} on OpenStreetMap. None were contacted.`);
  else accomplished.push(`Checked ${found.scanned ?? 0} ${found.industry || "OpenStreetMap"} listings in ${area}. No new missing or outdated website was found. No prospects were invented.`);
  if (offer) accomplished.push(`Prepared an unsent offer checklist for ${offer.name}. The price is blank.`);
  const report = pushReport(state, now, accomplished, found.error ? [found.error] : []);
  const log = (message) => state.logs.push({ id: randomUUID(), at, level: "info", message, taskId: null });
  for (const message of accomplished) log(message);
  if (skipped) log(`Skipped ${skipped} on the exclusion list.`);
  return report;
}
