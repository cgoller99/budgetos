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
  const [dispatching, setDispatching] = useState(false);
  const [codingApproved, setCodingApproved] = useState(false);
  const [codingFile, setCodingFile] = useState("");
  const [listening, setListening] = useState(false);
  const [micStatus, setMicStatus] = useState("Ready to check microphone");
  const [voiceOn, setVoiceOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const recognition = useRef<SpeechRecognizer | null>(null);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  const microphoneReadyRef = useRef(false);
  const playbackRef = useRef(false);
  const speechSequenceRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceOnRef = useRef(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => () => {
    handsFreeRef.current = false;
    recognition.current?.stop();
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);
  async function speakReply(message: string) {
    const sequence = ++speechSequenceRef.current;
    playbackRef.current = true;
    recognition.current?.stop();
    audioRef.current?.pause();
    audioRef.current = null;
    try {
      const response = await fetch("/api/admin/jarvis-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message.slice(0, 2400) }) });
      if (!response.ok) {
        const details = await response.json().catch(() => null) as { error?: string } | null;
        setError(details?.error || "Neural voice unavailable. Check Vercel AI Gateway speech access.");
        playbackRef.current = false;
        return;
      }
      if (response.ok) {
        const blob = await response.blob();
        if (!voiceOnRef.current || sequence !== speechSequenceRef.current) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); if (sequence === speechSequenceRef.current) { playbackRef.current = false; if (handsFreeRef.current) void startListeningRef.current(); } };
        audio.onerror = () => { URL.revokeObjectURL(url); if (sequence === speechSequenceRef.current) { playbackRef.current = false; if (handsFreeRef.current) void startListeningRef.current(); } };
        await audio.play();
        return;
      }
    } catch { setError("Neural voice request failed. Check your connection and Vercel AI Gateway."); playbackRef.current = false; return; }
    if (!voiceOnRef.current || sequence !== speechSequenceRef.current) { playbackRef.current = false; return; }
    speakBrowserReply(message);
  }
  function speakBrowserReply(message: string) {
    if (!("speechSynthesis" in window)) { playbackRef.current = false; setError("Spoken replies are not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(message);
    // Prefer a natural British male voice, where installed. Browser voice names differ by OS.
    const voices = window.speechSynthesis.getVoices();
    const british = voices.filter(v => /^en[-_]GB$/i.test(v.lang));
    const maleNames = /ryan|george|daniel|oliver|arthur|alfie|thomas|david|mark|james|male/i;
    const preferred = british.find(v => maleNames.test(v.name)) ?? voices.find(v => /^en[-_]/i.test(v.lang) && maleNames.test(v.name));
    if (!preferred) { playbackRef.current = false; setError("No known male browser voice installed. Check AI Gateway speech access, or install a male English voice in Windows."); if (handsFreeRef.current) { handsFreeRef.current = false; setHandsFree(false); } return; }
    if (preferred) speech.voice = preferred;
    speech.lang = preferred.lang; speech.rate = 0.94; speech.pitch = 0.95;
    speech.onend = () => { playbackRef.current = false; if (handsFreeRef.current) void startListeningRef.current(); };
    speech.onerror = () => { playbackRef.current = false; setError("Audio playback failed. Check your browser sound output and Windows volume."); if (handsFreeRef.current) void startListeningRef.current(); };
    window.speechSynthesis.speak(speech);
  }
  function setVoice(enabled: boolean) {
    voiceOnRef.current = enabled; setVoiceOn(enabled);
    if (!enabled) { ++speechSequenceRef.current; playbackRef.current = false; handsFreeRef.current = false; setHandsFree(false); recognition.current?.stop(); window.speechSynthesis?.cancel(); audioRef.current?.pause(); }
  }
  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busyRef.current) return;
    busyRef.current = true;
    recognition.current?.stop();
    listeningRef.current = false;
    const next: Message[] = [...messagesRef.current, { role: "user" as const, content }].slice(-24);
    messagesRef.current = next; setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Chat unavailable");
      const updated: Message[] = [...next, { role: "assistant", content: data.reply }];
      messagesRef.current = updated; setMessages(updated);
      if (voiceOnRef.current) void speakReply(data.reply);
    } catch (e) { const failure = e instanceof Error ? e.message : "Chat unavailable"; setError(failure); if (voiceOnRef.current) void speakReply("I cannot connect to my AI service yet. Please check the message on screen."); }
    finally { busyRef.current = false; setBusy(false); if (handsFreeRef.current && !voiceOnRef.current) void startListeningRef.current(); }
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
  async function dispatchTask(taskText?: string) {
    const goal = (taskText ?? draft).trim();
    if (!goal || dispatching) return;
    setDispatching(true); setTaskNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/jarvis-dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Worker dispatch failed");
      if (!taskText) setDraft("");
      setTaskNotice("Sent to GitHub Actions for proposal review. No code has been executed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Worker dispatch failed"); }
    finally { setDispatching(false); }
  }
  async function requestCodingReview() {
    const task = draft.trim();
    if (!task || !codingApproved || dispatching) return;
    setDispatching(true); setError(""); setTaskNotice("");
    try {
      const response = await fetch("/api/admin/jarvis-coding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, targetFile: codingFile.trim(), approved: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start coding review");
      setCodingApproved(false); setDraft("");
      setTaskNotice("Approved isolated AI patch proposal queued. The proposed patch will not be applied or deployed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start coding review"); }
    finally { setDispatching(false); }
  }
  async function startListening() {
    if (busyRef.current || playbackRef.current || startingRef.current || listeningRef.current) return;
    startingRef.current = true;
    setMicStatus("Checking microphone...");
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { startingRef.current = false; handsFreeRef.current = false; setHandsFree(false); setMicStatus("Speech recognition unsupported"); setError("This browser does not support speech recognition. Open Buxme in Chrome or Edge."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { startingRef.current = false; handsFreeRef.current = false; setHandsFree(false); setMicStatus("Microphone access unavailable"); setError("Microphone access requires HTTPS and a supported browser."); return; }
    try { if (!microphoneReadyRef.current) { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); microphoneReadyRef.current = true; } } catch (e) { startingRef.current = false; handsFreeRef.current = false; setHandsFree(false); setMicStatus("Microphone permission or device blocked"); setError("Browser cannot access your microphone. Allow microphone access for buxme.co in browser site settings and Windows privacy settings. " + (e instanceof Error ? e.message : "")); return; }
    if (busyRef.current || playbackRef.current || !voiceOnRef.current) { startingRef.current = false; return; }
    window.speechSynthesis?.cancel();
    setVoice(true); setError("");
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) { setMicStatus("Heard: " + transcript); void send(transcript); } else setMicStatus("No words recognized");
    };
    instance.onerror = event => { if (event.error !== "no-speech") { handsFreeRef.current = false; setHandsFree(false); } setMicStatus("Speech recognition error: " + event.error); setError(event.error === "not-allowed" ? "Microphone blocked. Click the lock icon beside buxme.co, allow Microphone, and reload." : event.error === "no-speech" ? "No speech detected. Check the selected Windows microphone and try again." : event.error === "audio-capture" ? "No microphone detected. Check Windows Settings > Privacy & security > Microphone." : "Microphone error: " + event.error); setListening(false); };
    instance.onend = () => { if (recognition.current !== instance) return; listeningRef.current = false; recognition.current = null; setListening(false); setMicStatus(current => current === "Listening..." ? "Listening ended without a transcript" : current); if (handsFreeRef.current && !busyRef.current) void startListeningRef.current(); };
    try { instance.start(); startingRef.current = false; listeningRef.current = true; setListening(true); setMicStatus("Listening..."); } catch (e) { setMicStatus("Speech recognition failed to start"); setError("Could not start speech recognition: " + (e instanceof Error ? e.message : "unknown error")); setListening(false); }
  }
  startListeningRef.current = startListening;
  async function toggleHandsFree() {
    if (handsFreeRef.current) { ++speechSequenceRef.current; playbackRef.current = false; handsFreeRef.current = false; setHandsFree(false); recognition.current?.stop(); audioRef.current?.pause(); window.speechSynthesis?.cancel(); setMicStatus("Hands-free stopped"); return; }
    handsFreeRef.current = true; setHandsFree(true); setVoice(true); await startListening();
  }
  return <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
    <h2 className="text-lg font-semibold">Talk to Jarvis</h2>
    <p className="mt-1 text-xs text-slate-400">Private admin conversation. Start conversation for hands-free back-and-forth; speech recognition requires Chrome or Edge. Send last instruction forwards your most recent spoken or typed request to GitHub Actions for proposal review; no code is executed automatically.</p>
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
      <button type="button" onClick={() => void toggleHandsFree()} aria-pressed={handsFree} className={handsFree ? "rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold" : "rounded-xl border border-emerald-500 px-4 py-3 text-sm font-semibold"}>{handsFree ? "End conversation" : "Start conversation"}</button>
      <button type="button" onClick={startListening} disabled={busy} aria-pressed={listening} className={listening ? "rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold" : "rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold"}>{listening ? "Stop listening" : "Speak"}</button>
      <button type="button" onClick={() => { setVoice(!voiceOn); if (!voiceOn) void speakReply("Voice is on. I will speak my replies."); }} aria-pressed={voiceOn} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm">{voiceOn ? "Voice on" : "Voice off"}</button>
      <button type="button" onClick={() => { setVoice(true); void speakReply(messagesRef.current.filter(m => m.role === "assistant").at(-1)?.content || "No Jarvis reply yet."); }} className="rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm">Replay reply</button>
      <button type="button" onClick={() => void saveTask()} disabled={busy || savingTask || !draft.trim()} className="rounded-xl border border-blue-500 px-4 py-3 text-sm font-semibold">Save as task</button>
      <button type="button" onClick={() => { const last = [...messagesRef.current].reverse().find(m => m.role === "user"); if (last) void dispatchTask(last.content); }} disabled={busy || dispatching || !messages.some(m => m.role === "user")} className="rounded-xl border border-purple-500/60 px-4 py-3 text-sm font-semibold disabled:opacity-50">Send last instruction</button>
      <button type="button" onClick={() => void dispatchTask()} disabled={busy || dispatching || !draft.trim()} className="rounded-xl border border-purple-500 px-4 py-3 text-sm font-semibold disabled:opacity-50">{dispatching ? "Sending..." : "Send to worker"}</button>
      <input aria-label="Approved source file" value={codingFile} onChange={e => setCodingFile(e.target.value)} placeholder="components/example.tsx" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-4 py-3 text-sm text-white" />
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={codingApproved} onChange={e => setCodingApproved(e.target.checked)} />Approve isolated coding validation</label>
      <button type="button" onClick={() => void requestCodingReview()} disabled={busy || dispatching || !codingApproved || !codingFile.trim() || !draft.trim()} className="rounded-xl border border-amber-500 px-4 py-3 text-sm font-semibold disabled:opacity-50">Run approved validation</button>
      <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">Send</button>
    </form>
  </section>;
}
