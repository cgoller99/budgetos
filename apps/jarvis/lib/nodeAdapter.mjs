export async function fromNode(req) {
  const host = req.headers.host || "127.0.0.1";
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error("Request is too large."), { status: 413 });
    chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || key.toLowerCase() === "x-jarvis-ip") continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  headers.set("x-jarvis-ip", req.socket?.remoteAddress || "local");
  const method = req.method || "GET";
  const body = method === "GET" || method === "HEAD" || size === 0 ? undefined : Buffer.concat(chunks);
  return new Request(`${proto}://${host}${req.url}`, { method, headers, body });
}

export async function writeNode(res, response) {
  res.statusCode = response.status;
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("set-cookie", cookies.length === 1 ? cookies[0] : cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}
