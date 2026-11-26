const sections = ["Overview", "Chat", "Voice", "Tasks", "Agents", "Business", "Services", "History", "Settings", "Health"];
const state = {
  authenticated: false,
  buxme: false,
  section: "Home",
  desk: null,
  chatOpen: false,
  muted: false,
  messages: [],
  tasks: [],
  logs: [],
  businesses: [],
  services: null,
  status: null,
  gates: null,
  error: "",
  notice: "",
  voiceOn: false,
  handsFree: false,
  orb: "idle",
  setup: "",
};
let recognition = null;
let audio = null;
let speakSeq = 0;
const base = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const root = document.querySelector("#root");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === false || value == null) continue;
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}
function formatTime(iso) {
  if (!iso) return "";
  return `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso))} ET`;
}
async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-jarvis-client": "dashboard" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "Request failed.");
  return payload;
}
function setOrb(next) { state.orb = next; const orb = document.querySelector(".orb"); if (orb) orb.dataset.state = next; const label = document.querySelector("#orb-label"); if (label) label.textContent = next; }
function unlockAudio() {
  try {
    const silent = new Audio(`${base}/silence.wav`);
    silent.play().catch(() => undefined);
  } catch { /* playback can still use speech synthesis */ }
  if (window.speechSynthesis) {
    const primer = new SpeechSynthesisUtterance(" ");
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
  }
}
function interruptSpeech() {
  speakSeq += 1;
  audio?.pause();
  window.speechSynthesis?.cancel();
  recognition?.stop();
  setOrb("idle");
}
async function speak(text) {
  const sequence = ++speakSeq;
  audio?.pause();
  window.speechSynthesis?.cancel();
  setOrb("speaking");
  if (state.services?.speech?.neural) {
    try {
      const response = await fetch(`${base}/api/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-jarvis-client": "dashboard" },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const url = URL.createObjectURL(await response.blob());
        await new Promise((resolve, reject) => {
          audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("playback")); };
          audio.play().catch(reject);
        });
        if (sequence !== speakSeq) return;
        setOrb(state.handsFree ? "listening" : "idle");
        if (state.handsFree) startListening();
        return;
      }
    } catch {
      state.error = "Neural speech did not play. Device speech will be used.";
    }
  }
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
    state.error = "This browser cannot play speech. The reply is on screen.";
    setOrb("idle");
    render();
    return;
  }
  await new Promise(resolve => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    const timer = setTimeout(finish, Math.min(20000, 1200 + text.length * 45));
    try {
      const item = new SpeechSynthesisUtterance(text);
      item.rate = 1;
      item.onend = () => { clearTimeout(timer); finish(); };
      item.onerror = () => {
        clearTimeout(timer);
        state.error = "Speech playback stopped. The reply is still on screen.";
        finish();
      };
      window.speechSynthesis.speak(item);
    } catch {
      clearTimeout(timer);
      state.error = "This browser could not play speech. The reply is still on screen.";
      finish();
    }
  });
  if (sequence !== speakSeq) return;
  setOrb(state.handsFree ? "listening" : "idle");
  if (state.handsFree) startListening();
}
async function handleTranscript(text) {
  const clean = text.trim();
  if (!clean) return;
  interruptSpeech();
  setOrb("thinking");
  state.error = "";
  try {
    const data = await api("/api/voice/turn", { method: "POST", body: { transcript: clean } });
    state.messages = data.messages;
    state.voiceOn = true;
    render();
    await speak(data.reply);
  } catch (error) {
    state.error = error.message;
    setOrb("idle");
    render();
  }
}
async function startListening() {
  if (state.muted) { setOrb("muted"); return; }
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
    } catch (error) {
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        state.error = "Microphone permission was blocked. Allow it for this site, then tap Listen again.";
        setOrb("idle");
        render();
        return;
      }
    }
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    state.error = "This browser has no speech recognition. Type the words in Voice, and Jarvis will answer and speak. On iPhone, open this page in Safari and allow the microphone.";
    setOrb("idle");
    render();
    return;
  }
  recognition?.stop();
  recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = event => handleTranscript(event.results?.[0]?.[0]?.transcript || "");
  recognition.onerror = event => {
    const code = event.error;
    state.error = code === "not-allowed"
      ? "Microphone permission was blocked. Allow it for this site, then tap Listen again."
      : code === "no-speech"
        ? "I did not hear anything. Tap Listen and try again."
        : "Listening failed. Tap Listen to try again, or type instead.";
    setOrb("idle");
    render();
  };
  recognition.onend = () => { if (state.orb === "listening") setOrb("idle"); };
  try {
    recognition.start();
    setOrb("listening");
  } catch (error) {
    state.error = "The microphone did not start. Tap Listen once more.";
    setOrb("idle");
    render();
  }
}
async function refresh() {
  const [chat, tasks, logs, businesses, services, status, settings, desk] = await Promise.all([
    api("/api/chat"), api("/api/tasks"), api("/api/logs"), api("/api/businesses"), api("/api/services"), api("/api/status"), api("/api/settings"), api("/api/desk"),
  ]);
  state.desk = desk;
  state.messages = chat.messages;
  state.tasks = tasks.tasks;
  state.logs = logs.logs;
  state.businesses = businesses.businesses;
  state.services = services.services;
  state.status = status;
  state.gates = settings.gates;
}
function connectionText() {
  const ai = state.services?.aiGateway;
  const link = state.status?.connection;
  const ceiling = state.services?.spendCeiling?.note || "Model spend stops at $5 per day.";
  const statusText = link?.connected || ai?.connected
    ? `AI connected. ${ai?.spendNote || "The model router can answer."}`
    : (link?.reason || ai?.spendNote || "AI is not connected.");
  return `${statusText} ${ceiling}`;
}
function routeText() {
  const routes = state.services?.aiGateway?.routes || {};
  const parts = ["routine", "coding", "research", "business"].map(kind => routes[kind]?.[0] ? `${kind}: ${routes[kind][0]}` : "").filter(Boolean);
  return parts.length ? parts.join(" · ") : "Model routes are unavailable.";
}
function queueText() {
  const counts = state.status?.counts || {};
  return `Approval required ${counts.proposed ?? 0} · Queued ${counts.approved ?? 0} · Running ${counts.running ?? 0} · Completed ${counts.completed ?? 0} · Failed ${counts.failed ?? 0} · Blocked ${counts.blocked ?? 0}`;
}
function serviceLabel(name, service) {
  if (name === "aiGateway") return service.connected ? "Connected" : service.configured ? "Key present, spending cap off" : "Not connected";
  if (name === "speech") return service.neural ? "Neural speech on" : "Device speech";
  if (name === "persistence") return service.mode === "redis" ? "Redis" : "Local disk";
  if (service.configured === true || service.localCommit === true) return "Configured";
  return "Not configured";
}
function field(label, control) { return el("label", {}, [label, control]); }
function button(label, onClick, className) { return el("button", { type: "button", class: className, onclick: onClick }, [label]); }

function renderLogin() {
  if (state.buxme) {
    root.replaceChildren(el("main", { class: "login" }, [el("section", { class: "card" }, [
      el("p", { class: "kicker" }, ["Jarvis"]),
      el("h1", {}, ["Command"]),
      el("p", { class: "muted" }, ["Sign in to Buxme with the admin account. Jarvis opens from that session."]),
      state.error ? el("p", { class: "error", role: "alert" }, [state.error]) : null,
      el("a", { href: "/login?redirect=/jarvis" }, ["Sign in to Buxme"]),
    ])]));
    return;
  }
  const password = el("input", { type: "password", autocomplete: "current-password", "aria-label": "Password" });
  const form = el("form", { class: "card", onsubmit: async event => {
    event.preventDefault();
    state.error = "";
    try {
      await api("/api/session", { method: "POST", body: { password: password.value } });
      state.authenticated = true;
      await refresh();
      render();
    } catch (error) { state.error = error.message; render(); }
  } }, [
    el("p", { class: "kicker" }, ["Jarvis"]),
    el("h1", {}, ["Command"]),
    el("p", { class: "muted" }, ["This is Jarvis, separate from Buxme. Sign in with the owner password configured on this server."]),
    field("Password", password),
    state.error ? el("p", { class: "error", role: "alert" }, [state.error]) : null,
    el("button", { class: "primary", type: "submit" }, ["Sign in"]),
  ]);
  root.replaceChildren(el("main", { class: "login" }, [form]));
}

const STATUS_LABEL = {
  proposed: "approval required",
  approved: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  blocked: "blocked",
  rejected: "rejected",
};
function bubble(message) {
  const meta = message.role !== "assistant" ? ""
    : message.source === "gateway" ? `${message.kind || "request"} · ${message.model}`
      : message.source === "queue" ? "Task queue · no model call"
        : "";
  const failure = message.role === "assistant" && message.source === "unavailable" ? (message.error || "AI is not connected.") : "";
  return el("div", { class: `bubble ${message.role}` }, [
    el("strong", {}, [message.role === "user" ? "You" : "Jarvis"]),
    meta ? el("p", { class: "meta" }, [meta]) : null,
    failure && failure !== message.content ? el("p", { class: "error" }, [failure]) : null,
    el("p", {}, [message.content]),
  ]);
}
function taskCard(task) {
  const model = task.result?.source === "gateway"
    ? `answered by ${task.model?.model}`
    : task.status === "running" ? `running on ${task.model?.model || "the selected model"}`
      : task.model?.model ? `selected ${task.model.model}` : "model pending";
  return el("article", { class: "item" }, [
    el("strong", {}, [task.title]),
    el("p", { class: "muted" }, [`${task.businessName} · ${STATUS_LABEL[task.status] || task.status} · ${task.risk} risk · ${task.kind} · ${model}`]),
    task.result?.connectionError ? el("p", { class: "meta" }, [task.result.connectionError]) : null,
    task.lastError ? el("p", { class: "error" }, [task.lastError]) : null,
    task.result?.text ? el("p", {}, [task.result.text]) : null,
    task.result?.summary ? el("p", {}, [task.result.summary]) : null,
    ...(task.progress || []).slice(-4).map(entry => el("p", { class: "muted" }, [`${formatTime(entry.at)} · ${entry.message}`])),
    el("div", { class: "row" }, [
      task.status === "proposed" ? button("Approve", () => act(`/api/tasks/${task.id}/review`, { decision: "approved" })) : null,
      task.status === "proposed" ? button("Reject", () => act(`/api/tasks/${task.id}/review`, { decision: "rejected" }), "warn") : null,
      task.status === "failed" || task.status === "blocked" ? button("Retry as proposal", () => act(`/api/tasks/${task.id}/retry`, {})) : null,
    ]),
  ]);
}
async function act(path, body) {
  state.error = "";
  try { await api(path, { method: "POST", body }); await refresh(); state.notice = "Saved. No external account was changed."; }
  catch (error) { state.error = error.message; }
  render();
}
function renderHome() {
  const desk = state.desk;
  const waiting = desk?.waiting || [];
  return el("section", { class: "home" }, [
    el("p", { class: "greeting" }, [desk?.greeting || "Good evening, Christian"]),
    el("p", { class: "headline" }, [desk?.headline || "Nothing new has been recorded."]),
    desk?.headlineAt ? el("p", { class: "muted" }, [formatTime(desk.headlineAt)]) : null,
    el("p", { class: state.status?.connection?.connected ? "ok" : "meta" }, [connectionText()]),
    el("p", { class: "muted" }, [state.services?.inbox?.connected ? "Agency inbox is connected. Sending still needs your approval." : (state.services?.inbox?.reason || "Agency inbox is not connected.")]),
    el("p", { class: "muted" }, [state.services?.inbox?.summary || "The inbox check runs once a day and handles 10 unread messages."]),
    el("p", { class: "muted" }, [state.services?.inbox?.replyRoute || "Replies sent to christiangoller99@gmail.com stay in Gmail until they are forwarded."]),
    state.services?.persistence?.configured ? null : el("p", { class: "muted" }, ["Work saved here can disappear on restart. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the budgetos project."]),
    waiting.length ? el("div", { class: "list" }, waiting.map(item => el("article", { class: "item" }, [
      el("h2", {}, [item.title]),
      el("p", { class: "muted" }, [`Needs you · ${formatTime(item.at)} · not sent`]),
      button("Open", () => { state.section = item.business === "website-agency" ? "Agency" : "Home"; render(); }),
    ]))) : el("p", { class: "muted" }, ["Nothing is waiting on you."]),
    button(state.chatOpen ? "Hide chat" : "Chat", () => { state.chatOpen = !state.chatOpen; render(); }),
    state.chatOpen ? renderChat() : null,
  ]);
}
function renderDesk(id) {
  const names = { buxme: "buxme", "website-agency": "agency", drivenest: "drivenest" };
  const key = names[id] || id;
  const card = state.desk?.businesses?.[key];
  const saved = (state.businesses || []).find(item => item.id === id);
  const drafts = (saved?.drafts || []).filter(draft => draft.status === "needs-christian" || draft.status === "draft");
  return el("section", { class: "panel" }, [
    el("h2", {}, [card?.question || "This workspace"]),
    el("p", {}, [card?.answer || "This source has not reported yet."]),
    card?.blocker ? el("p", { class: "error" }, [card.blocker]) : null,
    el("p", { class: "muted" }, [card?.recovery || ""]),
    ...drafts.map(draft => el("article", { class: "item" }, [
      el("h3", {}, [draft.title]),
      el("p", { class: "muted" }, [formatTime(draft.createdAt)]),
      el("p", {}, [draft.body]),
      button("Approve response", () => act(`/api/drafts/${draft.id}/approval`, { action: "outreach" }), "primary"),
    ])),
  ]);
}
function renderChat() {
  const box = el("textarea", { "aria-label": "Message Jarvis", maxlength: "2000" });
  return el("div", { class: "panel" }, [
    el("div", { class: "thread", "aria-live": "polite" }, state.messages.map(bubble)),
    box,
    button("Send", async () => {
      const text = box.value.trim();
      if (!text) return;
      try {
        const data = await api("/api/chat", { method: "POST", body: { text } });
        state.messages = data.messages;
        render();
        if (state.voiceOn) await speak(data.reply);
      } catch (error) { state.error = error.message; render(); }
    }, "primary"),
  ]);
}
function renderPanel() {
  if (state.section === "Home" || state.section === "Overview") return renderHome();
  if (state.section === "Buxme") return renderDesk("buxme");
  if (state.section === "Agency") return renderDesk("website-agency");
  if (state.section === "DriveNest") return renderDesk("drivenest");
  if (state.section === "Overview") {
    const counts = state.status?.counts || {};
    return el("section", { class: "grid" }, [
      stat("Recorded tasks", counts.tasks ?? 0, "Stored in this Jarvis app"),
      stat("Waiting for approval", counts.proposed ?? 0, "Not started"),
      stat("Running", counts.running ?? 0, "Claimed by the worker"),
      stat("Completed here", counts.completed ?? 0, "No external action is implied"),
      stat("Buxme metrics", "Not connected", "No revenue is shown"),
      el("article", { class: "panel" }, [
        el("h2", {}, ["What is true right now"]),
        el("p", {}, [connectionText()]),
        el("p", { class: "muted" }, [routeText()]),
        state.status?.lastError ? el("p", { class: "error" }, [`${state.status.lastError.model || "model"}: ${state.status.lastError.message}`]) : null,
        el("p", { class: "muted" }, ["DriveNest store performance is not connected. Agency outreach is drafted only when you enter the facts."]),
      ]),
    ]);
  }
  if (state.section === "Chat") {
    const box = el("textarea", { "aria-label": "Message Jarvis", maxlength: "2000" });
    return el("section", { class: "panel" }, [
      el("div", { class: "thread", "aria-live": "polite" }, state.messages.map(bubble)),
      el("div", { class: "composer" }, [box, el("div", { class: "row" }, [
        button("Send", async () => {
          const text = box.value.trim();
          if (!text) return;
          state.error = "";
          try {
            const data = await api("/api/chat", { method: "POST", body: { text } });
            state.messages = data.messages;
            box.value = "";
            render();
            if (state.voiceOn) await speak(data.reply);
          } catch (error) { state.error = error.message; render(); }
        }, "primary"),
        button(state.voiceOn ? "Voice replies on" : "Speak replies", () => { state.voiceOn = !state.voiceOn; if (state.voiceOn) unlockAudio(); render(); }),
        button("Replay last reply", async () => {
          const last = state.messages.filter(message => message.role === "assistant").at(-1);
          if (!last) { state.error = "There is no reply to replay."; render(); return; }
          unlockAudio();
          await speak(last.content);
        }),
      ])]),
    ]);
  }
  if (state.section === "Voice") {
    const box = el("textarea", { "aria-label": "Words to send when the microphone is unavailable", maxlength: "2000" });
    return el("section", { class: "panel" }, [
      el("h2", {}, ["Speak and listen"]),
      el("p", { class: "muted" }, ["Tap Listen, speak, and Jarvis answers out loud. If recognition is unavailable, type the same words. Interrupt stops playback immediately."]),
      el("div", { class: "thread", "aria-live": "polite" }, state.messages.slice(-6).map(bubble)),
      el("div", { class: "row" }, [
        button("Listen", () => { unlockAudio(); state.error = ""; startListening(); }, "primary"),
        button("Interrupt", interruptSpeech, "warn"),
        button(state.handsFree ? "Hands-free on" : "Hands-free off", () => { state.handsFree = !state.handsFree; unlockAudio(); render(); }),
      ]),
      box,
      button("Send typed speech", () => handleTranscript(box.value), "primary"),
    ]);
  }
  if (state.section === "Tasks" || state.section === "Agents") {
    const title = el("input", { "aria-label": "Task title", maxlength: "180" });
    const detail = el("textarea", { "aria-label": "Task notes", maxlength: "4000" });
    const business = el("select", { "aria-label": "Business" }, [
      el("option", { value: "buxme" }, ["Buxme"]),
      el("option", { value: "website-agency" }, ["Website-building agency"]),
      el("option", { value: "drivenest" }, ["DriveNest Auto Care"]),
    ]);
    return el("section", { class: "panel" }, [
      el("h2", {}, [state.section === "Agents" ? "Authorized worker" : "Tasks"]),
      el("p", { class: "muted" }, [queueText()]),
      el("p", { class: "muted" }, ["The worker uses the same model router as chat when a spending cap is authorized. Publishing, spending, outreach, and deploys stay blocked."]),
      field("Title", title), field("Notes", detail), field("Business", business),
      el("div", { class: "row" }, [
        button("Create task", async () => {
          try {
            await api("/api/tasks", { method: "POST", body: { title: title.value, detail: detail.value, business: business.value } });
            state.notice = "Task proposed. It has not been executed.";
            await refresh();
          } catch (error) { state.error = error.message; }
          render();
        }, "primary"),
        button("Suggest tasks", () => act("/api/suggestions", {})),
        button("Run worker", () => act("/api/worker/run", {}), "primary"),
      ]),
      el("div", { class: "list" }, state.tasks.length ? state.tasks.map(taskCard) : [el("p", { class: "muted" }, ["No tasks yet."])]),
    ]);
  }
  if (state.section === "Business") {
    return el("section", { class: "list" }, state.businesses.map(business => {
      const name = el("input", { "aria-label": `${business.name} lead name`, maxlength: "80" });
      const url = el("input", { "aria-label": `${business.name} lead URL`, placeholder: "https://" });
      const note = el("textarea", { "aria-label": `${business.name} facts` });
      return el("article", { class: "panel" }, [
        el("h2", {}, [business.name]),
        el("p", {}, [business.summary]),
        el("p", { class: "pill" }, ["Metrics: not connected"]),
        field("Lead or product", name), field("URL", url), field("Facts you want used", note),
        el("div", { class: "row" }, [
          button("Save lead", async () => {
            try {
              await api("/api/leads", { method: "POST", body: { business: business.id, name: name.value, url: url.value, note: note.value } });
              state.notice = "Lead recorded. Nobody was contacted.";
              await refresh();
            } catch (error) { state.error = error.message; }
            render();
          }),
          button("Save draft", async () => {
            try {
              await api("/api/drafts", { method: "POST", body: { business: business.id, kind: business.id === "drivenest" ? "listing" : "outreach", title: name.value || "Draft", notes: note.value } });
              state.notice = "Draft saved. It was not sent.";
              await refresh();
            } catch (error) { state.error = error.message; }
            render();
          }, "primary"),
        ]),
        ...business.leads.map(lead => el("div", { class: "item" }, [
          el("strong", {}, [lead.name]),
          el("p", { class: "muted" }, [`${lead.stage} · recorded by you · not contacted by Jarvis`]),
          el("div", { class: "row" }, ["drafted", "responded", "closed"].map(stage => button(`Record ${stage}`, () => act(`/api/leads/${lead.id}/stage`, { stage })))),
        ])),
        ...business.drafts.map(draft => el("div", { class: "item" }, [
          el("strong", {}, [draft.title]),
          el("p", {}, [draft.body]),
          el("div", { class: "row" }, [
            button("Ask approval to publish", () => act(`/api/drafts/${draft.id}/approval`, { action: "publish" })),
            button("Ask approval for outreach", () => act(`/api/drafts/${draft.id}/approval`, { action: "outreach" })),
          ]),
        ])),
      ]);
    }));
  }
  if (state.section === "Services") {
    const entries = Object.entries(state.services || {});
    return el("section", { class: "list" }, entries.map(([name, service]) => el("article", { class: "panel" }, [
      el("h2", {}, [name]),
      el("p", {}, [service.note || service.spendNote || ""]),
      el("p", { class: "pill" }, [serviceLabel(name, service)]),
      button("Show setup", () => { state.setup = state.setup === name ? "" : name; render(); }),
      state.setup === name ? el("p", {}, [`Set these environment variables on the Jarvis host: ${(service.requiredEnv || []).join(", ") || "None. This connector is intentionally absent."}`]) : null,
    ])));
  }
  if (state.section === "History") {
    return el("section", { class: "panel list" }, [
      el("h2", {}, ["Execution history"]),
      button("Refresh", async () => { try { await refresh(); } catch (error) { state.error = error.message; } render(); }),
      ...(state.logs.length ? state.logs.slice().reverse().map(entry => el("p", { class: "item" }, [`${formatTime(entry.at)} · ${entry.message}`])) : [el("p", { class: "muted" }, ["No log entries yet."])]),
    ]);
  }
  if (state.section === "Settings") {
    const gates = state.gates || {};
    const inputs = Object.keys(gates).map(key => {
      const input = el("input", { type: "checkbox", checked: gates[key] ? "checked" : null, "aria-label": key });
      input.checked = Boolean(gates[key]);
      input.dataset.gate = key;
      return el("label", {}, [input, ` Require approval for ${key}`]);
    });
    return el("section", { class: "panel" }, [
      el("h2", {}, ["Approval gates"]),
      el("p", { class: "muted" }, ["Turning a gate off does not send email, spend money, or deploy. Those actions are still not executed from this app."]),
      ...inputs,
      button("Save permissions", async () => {
        const next = {};
        for (const input of root.querySelectorAll("[data-gate]")) next[input.dataset.gate] = input.checked;
        try { state.gates = (await api("/api/settings", { method: "POST", body: { gates: next } })).gates; state.notice = "Permissions saved."; }
        catch (error) { state.error = error.message; }
        render();
      }, "primary"),
      button("Prepare local git commit", async () => {
        try {
          const result = await api("/api/git", { method: "POST", body: { confirm: "commit-local", taskId: "not-selected", files: [] } });
          state.notice = result.reason;
        } catch (error) { state.error = error.message; }
        render();
      }),
    ]);
  }
  const counts = state.status?.counts || {};
  return el("section", { class: "panel" }, [
    el("h2", {}, ["System health"]),
    el("p", {}, [`Auth configured: ${state.services?.auth?.configured ? "yes" : "no"}`]),
    el("p", {}, [`Persistence: ${state.services?.persistence?.mode || "unknown"}`]),
    el("p", {}, [connectionText()]),
    el("p", {}, [routeText()]),
    el("p", {}, [`Speech: ${state.services?.speech?.neural ? "neural voice and device speech" : "device speech"}`]),
    el("p", {}, [`Model requests recorded today: ${state.status?.usage?.requests ?? 0}`]),
    el("p", {}, [`Provider errors recorded: ${state.status?.usage?.errors?.length ?? 0}`]),
    state.status?.lastError ? el("p", { class: "error" }, [`${state.status.lastError.model || "model"}: ${state.status.lastError.message}`]) : null,
    el("p", {}, [`Tasks: ${counts.tasks ?? 0}. Leads: ${counts.leads ?? 0}. Drafts: ${counts.drafts ?? 0}.`]),
    button("Refresh health", async () => { try { await refresh(); state.notice = "Health reloaded from this server."; } catch (error) { state.error = error.message; } render(); }, "primary"),
  ]);
}
function stat(label, value, detail) {
  return el("article", { class: "stat" }, [el("h2", {}, [label]), el("strong", {}, [String(value)]), el("p", { class: "muted" }, [detail])]);
}
function render() {
  if (!state.authenticated) { renderLogin(); return; }
  const tabs = ["Buxme", "Agency", "DriveNest"].map(section => el("button", {
    type: "button",
    class: `tab tab-${section.toLowerCase()}`,
    "aria-current": state.section === section ? "page" : null,
    onclick: async () => { state.section = state.section === section ? "Home" : section; state.error = ""; await refresh().catch(error => { state.error = error.message; }); render(); },
  }, [section]));
  const voiceState = state.muted ? "muted" : state.orb;
  root.replaceChildren(el("div", { class: "shell phone" }, [
    el("header", { class: "top" }, [
      el("p", { class: "kicker" }, ["Jarvis"]),
      button(state.muted ? "Unmute" : "Mute", () => { state.muted = !state.muted; if (state.muted) interruptSpeech(); setOrb(state.muted ? "muted" : "idle"); render(); }),
    ]),
    el("aside", { class: "orb-wrap" }, [
      el("button", { class: "orb", type: "button", "data-state": voiceState, "aria-label": state.muted ? "Jarvis is muted" : `Jarvis is ${voiceState}. Talk.`, onclick: () => { if (state.muted) return; unlockAudio(); state.error = ""; startListening(); } }),
      el("p", { id: "orb-label" }, [voiceState]),
    ]),
    el("main", { class: "content" }, [
      state.error ? el("p", { class: "error", role: "alert" }, [state.error]) : null,
      state.notice ? el("p", { class: "muted" }, [state.notice]) : null,
      renderPanel(),
    ]),
    el("nav", { class: "tabbar", "aria-label": "Businesses" }, tabs),
  ]));
  const thread = document.querySelector(".thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}
window.jarvisHandleTranscript = handleTranscript;
setInterval(async () => {
  if (!state.authenticated) return;
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
  try {
    const [tasks, logs, status, services, desk] = await Promise.all([
      api("/api/tasks"), api("/api/logs"), api("/api/status"), api("/api/services"), api("/api/desk"),
    ]);
    let changed = JSON.stringify(tasks.tasks) !== JSON.stringify(state.tasks)
      || JSON.stringify(logs.logs) !== JSON.stringify(state.logs)
      || JSON.stringify(status.counts) !== JSON.stringify(state.status?.counts)
      || JSON.stringify(status.connection) !== JSON.stringify(state.status?.connection)
      || JSON.stringify(desk.waiting) !== JSON.stringify(state.desk?.waiting);
    state.desk = desk;
    state.tasks = tasks.tasks;
    state.logs = logs.logs;
    state.status = status;
    state.services = services.services;
    if (state.chatOpen || state.section === "Chat" || state.section === "Voice") {
      const chat = await api("/api/chat");
      if (JSON.stringify(chat.messages) !== JSON.stringify(state.messages)) {
        state.messages = chat.messages;
        changed = true;
      }
    }
    if (changed && !typing) render();
  } catch { /* keep the last saved state on screen */ }
}, 3000);
api("/api/session").then(async data => {
  state.authenticated = data.authenticated;
  state.buxme = data.buxme === true;
  if (state.authenticated) await refresh();
  render();
}).catch(error => { state.error = error.message; renderLogin(); });
