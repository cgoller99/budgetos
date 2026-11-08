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
  const [taskNotice, setTaskNotice] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [listening, setListening] = useState(false);
  const [micStatus, setMicStatus] = useState("Ready to check microphone");
  const [voiceOn, setVoiceOn] = useState(false);
  const recognition = useRef<SpeechRecognizer | null>(null);
  const voiceOnRef = useRef(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => () => {
    recognition.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);
  function speakReply(message: string) {
    if (!("speechSynthesis" in window)) { setError("Spoken replies are not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(message);
    // Prefer a natural British male voice, where installed. Browser voice names differ by OS.
    const voices = window.speechSynthesis.getVoices();
    const british = voices.filter(v => /^en[-_]GB$/i.test(v.lang));
    const maleNames = /ryan|george|daniel|oliver|arthur|alfie|thomas|male/i;
    const preferred = british.find(v => maleNames.test(v.name)) ?? british.find(v => /natural|neural|premium/i.test(v.name)) ?? british[0];
    if (preferred) speech.voice = preferred;
    speech.lang = "en-GB"; speech.rate = 0.93; speech.pitch = 0.88;
    speech.onerror = () => setError("Audio playback failed. Check your browser sound output and Windows volume.");
    window.speechSynthesis.speak(speech);
  }
  function setVoice(enabled: boolean) {
    voiceOnRef.current = enabled; setVoiceOn(enabled);
    if (!enabled) window.speechSynthesis?.cancel();
  }
  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busyRef.current) return;
    busyRef.current = true;
    recognition.current?.stop();
    const next: Message[] = [...messagesRef.current, { role: "user" as const, content }].slice(-24);
    messagesRef.current = next; setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Chat unavailable");
      const updated: Message[] = [...next, { role: "assistant", content: data.reply }];
      messagesRef.current = updated; setMessages(updated);
      if (voiceOnRef.current) speakReply(data.reply);
    } catch (e) { const failure = e instanceof Error ? e.message : "Chat unavailable"; setError(failure); if (voiceOnRef.current) speakReply("I cannot connect to my AI service yet. Please check the message on screen."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function saveTask() {
    const goal = draft.trim();
    if (!goal || savingTask) return;
    setSavingTask(true); setTaskNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save task");
      setDraft("");
      setTaskNotice("Task saved for review. Jarvis has not executed it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save task"); }
    finally { setSavingTask(false); }
  }
  async function startListening() {
    if (busyRef.current) { setMicStatus("Wait for Jarvis to finish responding"); return; }
    if (listening) { recognition.current?.stop(); setMicStatus("Stopped"); return; }
    setMicStatus("Checking microphone...");
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setMicStatus("Speech recognition unsupported"); setError("This browser does not support speech recognition. Open Buxme in Chrome or Edge."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setMicStatus("Microphone access unavailable"); setError("Microphone access requires HTTPS and a supported browser."); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); } catch (e) { setMicStatus("Microphone permission or device blocked"); setError("Browser cannot access your microphone. Allow microphone access for buxme.co in browser site settings and Windows privacy settings. " + (e instanceof Error ? e.message : "")); return; }
    window.speechSynthesis?.cancel();
    setVoice(true); setError("");
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) { setMicStatus("Heard: " + transcript); void send(transcript); } else setMicStatus("No words recognized");
    };
    instance.onerror = event => { setMicStatus("Speech recognition error: " + event.error); setError(event.error === "not-allowed" ? "Microphone blocked. Click the lock icon beside buxme.co, allow Microphone, and reload." : event.error === "no-speech" ? "No speech detected. Check the selected Windows microphone and try again." : event.error === "audio-capture" ? "No microphone detected. Check Windows Settings > Privacy & security > Microphone." : "Microphone error: " + event.error); setListening(false); };
    instance.onend = () => { setListening(false); setMicStatus(current => current === "Listening..." ? "Listening ended without a transcript" : current); };
    try { instance.start(); setListening(true); setMicStatus("Listening..."); } catch (e) { setMicStatus("Speech recognition failed to start"); setError("Could not start speech recognition: " + (e instanceof Error ? e.message : "unknown error")); setListening(false); }
  }
  return <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
    <h2 className="text-lg font-semibold">Talk to Jarvis</h2>
    <p className="mt-1 text-xs text-slate-400">Private admin conversation. Voice uses your browser microphone and speech playback; Use Save as task to queue a request for review; saving does not execute it.</p>
    <div aria-live="polite" className="mt-4 max-h-96 min-h-48 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-4">
      {messages.length === 0 && <p className="text-sm text-slate-400">Ask Jarvis what to build, investigate, or prioritize for Buxme.</p>}
      {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-blue-950 p-3 text-sm" : "mr-8 rounded-xl bg-slate-800 p-3 text-sm"}><p className="mb-1 text-xs font-bold text-blue-300">{m.role === "user" ? "You" : "Jarvis"}</p><p className="whitespace-pre-wrap">{m.content}</p></div>)}
      {busy && <p className="text-sm text-slate-400">Jarvis is responding...</p>}
    </div>
    <p role="status" className="mt-3 text-xs text-slate-300">Microphone: {micStatus}</p>
    {taskNotice && <p role="status" className="mt-3 text-sm text-emerald-300">{taskNotice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="mt-4 flex flex-wrap gap-2">
      <input aria-label="Message Jarvis" value={draft} onChange={e => setDraft(e.target.value)} maxLength={3000} placeholder="Message Jarvis..." className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-4 py-3 text-sm text-white" />
      <button type="button" onClick={startListening} disabled={busy} aria-pressed={listening} className={listening ? "rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold" : "rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold"}>{listening ? "Stop listening" : "Speak"}</button>
      <button type="button" onClick={() => { setVoice(!voiceOn); if (!voiceOn) speakReply("Voice is on. I will speak my replies."); }} aria-pressed={voiceOn} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm">{voiceOn ? "Voice on" : "Voice off"}</button>
      <button type="button" onClick={() => speakReply(messagesRef.current.filter(m => m.role === "assistant").at(-1)?.content || "No Jarvis reply yet.")} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm">Replay reply</button>
      <button type="button" onClick={() => void saveTask()} disabled={busy || savingTask || !draft.trim()} className="rounded-xl border border-blue-500 px-4 py-3 text-sm font-semibold">Save as task</button>
      <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">Send</button>
    </form>
  </section>;
}
