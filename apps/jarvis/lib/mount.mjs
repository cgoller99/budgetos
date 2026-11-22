import { join } from "node:path";

const PREFIX = "/jarvis";

// Literal paths so the Next.js file trace ships the dashboard with this route.
export const dashboardAssets = [
  join(process.cwd(), "apps/jarvis/public/index.html"),
  join(process.cwd(), "apps/jarvis/public/app.js"),
  join(process.cwd(), "apps/jarvis/public/app.css"),
  join(process.cwd(), "apps/jarvis/public/favicon.ico"),
  join(process.cwd(), "apps/jarvis/public/silence.wav"),
  join(process.cwd(), "apps/jarvis/public/manifest.webmanifest"),
];

export function clientAddress(headers) {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map(part => part.trim()).filter(Boolean);
  return (parts.at(-1) || "local").slice(0, 80);
}

export async function mountJarvis(request, app, prefix = PREFIX) {
  if (prefix !== PREFIX) return text("Not found.", 404);
  const incoming = new URL(request.url);
  const path = incoming.pathname;
  if (path !== prefix && !path.startsWith(`${prefix}/`)) return text("Not found.", 404);
  const stripped = path.slice(prefix.length) || "/";
  const url = new URL(request.url);
  url.pathname = stripped;
  const headers = new Headers(request.headers);
  headers.delete("x-jarvis-ip");
  headers.set("x-jarvis-ip", clientAddress(headers));
  const method = request.method.toUpperCase();
  const forwarded = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
  });
  return adaptResponse(await app.handle(forwarded), prefix, stripped);
}

async function adaptResponse(response, prefix, stripped) {
  const headers = new Headers(response.headers);
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookies.length) {
    headers.delete("set-cookie");
    for (const cookie of cookies) headers.append("set-cookie", cookie.replace(/Path=\/(?=$|;)/, `Path=${prefix}`));
  }
  if (stripped.endsWith(".wav")) headers.set("content-type", "audio/wav");
  if (stripped.endsWith(".ico")) headers.set("content-type", "image/x-icon");
  if (!(headers.get("content-type") || "").includes("text/html")) {
    return new Response(response.body, { status: response.status, headers });
  }
  const html = (await response.text()).replaceAll('href="/', `href="${prefix}/`).replaceAll('src="/', `src="${prefix}/`);
  headers.delete("content-length");
  return new Response(html, { status: response.status, headers });
}

function text(message, status) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
