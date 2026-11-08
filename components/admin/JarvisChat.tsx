"use client";
import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognizer = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognizer;
  webkitSpeechRecognition?: new () => SpeechRecognizer;
};
export function JarvisChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const recognition = useRef<SpeechRecognizer | null>(null);
  const voiceOnRef = useRef(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => () => {
    recognition.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);
  function setVoice(enabled: boolean) {
    voiceOnRef.current = enabled; setVoiceOn(enabled);
    if (!enabled) window.speechSynthesis?.cancel();
  }
  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busyRef.current) return;
    busyRef.current = true;
    recognition.current?.stop();
    const next: Message[] = [...messagesRef.current, { role: "user", content }].slice(-24);
    messagesRef.current = next; setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Chat unavailable");
      const updated: Message[] = [...next, { role: "assistant", content: data.reply }];
      messagesRef.current = updated; setMessages(updated);
      if (voiceOnRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(data.reply);
        speech.lang = "en-US"; speech.rate = 1;
        window.speechSynthesis.speak(speech);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Chat unavailable"); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function startListening() {
    if (busyRef.current) return;
    if (listening) { recognition.current?.stop(); return; }
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setError("Speech recognition is not supported in this browser. Try Chrome or Edge, or type your message."); return; }
    window.speechSynthesis?.cancel();
    setVoice(true); setError("");
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) void send(transcript);
    };
    instance.onerror = event => { setError(event.error === "not-allowed" ? "Microphone permission denied. Allow microphone access in your browser." : "Microphone error: " + event.error); setListening(false); };
    instance.onend = () => setListening(false);
    try { instance.start(); setListening(true); } catch { setError("Could not start the microphone."); setListening(false); }
  }
  return <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
    <h2 className="text-lg font-semibold">Talk to Jarvis</h2>
    <p className="mt-1 text-xs text-slate-400">Private admin conversation. Voice uses your browser microphone and speech playback; no actions are executed from chat.</p>
    <div aria-live="polite" className="mt-4 max-h-96 min-h-48 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-4">
      {messages.length === 0 && <p className="text-sm text-slate-400">Ask Jarvis what to build, investigate, or prioritize for Buxme.</p>}
      {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-blue-950 p-3 text-sm" : "mr-8 rounded-xl bg-slate-800 p-3 text-sm"}><p className="mb-1 text-xs font-bold text-blue-300">{m.role === "user" ? "You" : "Jarvis"}</p><p className="whitespace-pre-wrap">{m.content}</p></div>)}
      {busy && <p className="text-sm text-slate-400">Jarvis is responding...</p>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="mt-4 flex flex-wrap gap-2">
      <input aria-label="Message Jarvis" value={draft} onChange={e => setDraft(e.target.value)} maxLength={3000} placeholder="Message Jarvis..." className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-4 py-3 text-sm text-white" />
      <button type="button" onClick={startListening} disabled={busy} aria-pressed={listening} className={listening ? "rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold" : "rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold"}>{listening ? "Stop listening" : "🎙 Speak"}</button>
      <button type="button" onClick={() => setVoice(!voiceOn)} aria-pressed={voiceOn} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm">{voiceOn ? "🔊 Voice on" : "🔇 Voice off"}</button>
      <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">Send</button>
    </form>
  </section>;
}
