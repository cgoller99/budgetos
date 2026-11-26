export function normalizeSpeech(text) {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function isEcho(heard, spoken) {
  const said = normalizeSpeech(heard);
  const played = normalizeSpeech(spoken);
  if (!said || !played || said.length < 8) return false;
  return said === played || played.includes(said) || said.includes(played);
}

export function commandFromSpeech(text) {
  const clean = normalizeSpeech(text).replace(/^jarvis\s+/, "");
  if (!clean) return { type: "ignore", text: "" };
  if (/^(open|show) (that|the) draft$/.test(clean)) return { type: "open-draft", text: clean };
  if (/^(open|show) (that|the) preview$/.test(clean)) return { type: "open-preview", text: clean };
  return { type: "ask", text: clean };
}
