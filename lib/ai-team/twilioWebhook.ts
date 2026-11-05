import { createHmac, timingSafeEqual } from "node:crypto";
/** Twilio application/x-www-form-urlencoded request signature validation. */
export function validTwilioSignature(url: string, fields: Record<string, string>, signature: string | null, authToken: string): boolean {
  if (!signature || !authToken) return false;
  const data = url + Object.keys(fields).sort().map(key => key + fields[key]).join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function jarvisIntroTwiML(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Hello. This is Jarvis, your Buxme assistant. Voice conversations are not yet enabled. This is a connection test. Goodbye.</Say><Hangup/></Response>';
}
