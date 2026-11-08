"use client";
import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
export function JarvisChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }].slice(-24);
    setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Chat unavailable");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Chat unavailable"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
    <h2 className="text-lg font-semibold">Talk to Jarvis</h2>
    <p className="mt-1 text-xs text-slate-400">Private admin chat. Planning only; no actions are executed from messages.</p>
    <div aria-live="polite" className="mt-4 max-h-96 min-h-48 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-4">
      {messages.length === 0 && <p className="text-sm text-slate-400">Ask Jarvis what to build, investigate, or prioritize for Buxme.</p>}
      {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-blue-950 p-3 text-sm" : "mr-8 rounded-xl bg-slate-800 p-3 text-sm"}><p className="mb-1 text-xs font-bold text-blue-300">{m.role === "user" ? "You" : "Jarvis"}</p><p className="whitespace-pre-wrap">{m.content}</p></div>)}
      {busy && <p className="text-sm text-slate-400">Jarvis is responding...</p>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="mt-4 flex gap-2">
      <input aria-label="Message Jarvis" value={draft} onChange={e => setDraft(e.target.value)} maxLength={3000} placeholder="Message Jarvis..." className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-4 py-3 text-sm text-white" />
      <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">Send</button>
    </form>
  </section>;
}
