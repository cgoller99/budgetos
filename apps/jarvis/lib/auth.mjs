import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "jarvis_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

export function passwordsMatch(input, expected) {
  return timingSafeEqual(digest(input), digest(expected));
}

export function sessionSecret(env, password) {
  const configured = env.JARVIS_SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  if (env.VERCEL || env.NODE_ENV === "production") return "";
  return createHash("sha256").update(`jarvis-local-session:${password}`).digest("base64url");
}

export function authConfigured(env) {
  const password = env.JARVIS_OWNER_PASSWORD?.trim() ?? "";
  return password.length >= 10;
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSession(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + MAX_AGE_SECONDS * 1000, role: "owner" })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(cookieHeader, secret, now = Date.now()) {
  if (!secret) return null;
  const raw = String(cookieHeader ?? "").split(/;\s*/).map(part => part.split("=")).find(([name]) => name === COOKIE)?.[1];
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (body.role !== "owner" || typeof body.exp !== "number" || body.exp <= now) return null;
    return body;
  } catch {
    return null;
  }
}

export function sessionCookie(token, secure) {
  const parts = [`${COOKIE}=${token}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${MAX_AGE_SECONDS}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(secure) {
  const parts = [`${COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clientHeaderOk(request) {
  return request.headers.get("x-jarvis-client") === "dashboard";
}

export function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
