/** Jarvis outbound-call transport. Never invoke from a background decision loop without authorization. */
export type JarvisCallRequest = {
  to: string;
  approvedByUser: boolean;
  reason: string;
  callbackUrl: string;
};
export type JarvisCallResult = { sid: string; status: string };
export function validateJarvisCallRequest(request: JarvisCallRequest): void {
  if (!request.approvedByUser) throw new Error("Explicit call approval is required.");
  if (!/^\+[1-9]\d{7,14}$/.test(request.to)) throw new Error("Invalid E.164 phone number.");
  if (!request.reason.trim()) throw new Error("A call reason is required.");
  const url = new URL(request.callbackUrl);
  if (url.protocol !== "https:") throw new Error("Call callback must use HTTPS.");
}
export async function placeJarvisCall(request: JarvisCallRequest): Promise<JarvisCallResult> {
  validateJarvisCallRequest(request);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const allowed = process.env.JARVIS_VERIFIED_PHONE_NUMBER;
  if (!sid || !token || !from || !allowed) throw new Error("Jarvis calling is not configured.");
  if (request.to !== allowed) throw new Error("Destination is not the verified Jarvis phone number.");
  if (!/^AC[a-f0-9]{32}$/i.test(sid)) throw new Error("Invalid Twilio account configuration.");
  const body = new URLSearchParams({ To: request.to, From: from, Url: request.callbackUrl, Method: "POST" });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Call provider returned HTTP ${response.status}.`);
  const result = await response.json() as { sid?: string; status?: string };
  if (!result.sid) throw new Error("Call provider did not return a call identifier.");
  return { sid: result.sid, status: result.status ?? "queued" };
}
