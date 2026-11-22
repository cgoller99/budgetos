import { join } from "node:path";

const PREFIX = "/jarvis";

// Literal paths so the Next.js file trace ships the dashboard with this route.
export const dashboardAssets = [
  join(process.cwd(), "apps/jarvis/public/app.js"),
  join(process.cwd(), "apps/jarvis/public/app.css"),
];

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; base-uri 'none'; form-action 'self'",
};

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
  const method = request.method.toUpperCase();
  if ((stripped === "/" || stripped === "/index.html") && (method === "GET" || method === "HEAD")) {
    return adaptResponse(new Response(method === "HEAD" ? null : pageShell(), { headers: PAGE_HEADERS }), prefix, stripped);
  }
  if (stripped === "/silence.wav" && (method === "GET" || method === "HEAD")) {
    return new Response(method === "HEAD" ? null : silentWav(), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  const url = new URL(request.url);
  url.pathname = stripped;
  const headers = new Headers(request.headers);
  headers.delete("x-jarvis-ip");
  headers.set("x-jarvis-ip", clientAddress(headers));
  const forwarded = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
  });
  return adaptResponse(await app.handle(forwarded), prefix, stripped);
}

function pageShell() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#061018">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Jarvis</title>
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <div id="root"></div>
  <noscript>Jarvis needs JavaScript for chat, voice, and tasks.</noscript>
  <script type="module" src="/app.js"></script>
</body>
</html>`;
}

function silentWav() {
  const dataLength = 8;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataLength, true);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  bytes.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  bytes.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataLength, true);
  bytes.fill(128, 44);
  return bytes;
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
