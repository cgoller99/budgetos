import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "./lib/app.mjs";
import { fromNode, writeNode } from "./lib/nodeAdapter.mjs";

async function handleNode(app, req, res) {
  try {
    const request = await fromNode(req);
    await writeNode(res, await app.handle(request));
  } catch (error) {
    const status = error.status || 500;
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: status === 413 ? "Request is too large." : "Jarvis could not complete that request." }));
  }
}

const app = createApp();

export default function handler(req, res) {
  return handleNode(app, req, res);
}

export function startServer({ port = 0, host = "127.0.0.1", env, dataDir, fetchImpl, now, execFileImpl } = {}) {
  const local = createApp({ env, dataDir, fetchImpl, now, execFileImpl });
  const server = createServer((req, res) => handleNode(local, req, res));
  return new Promise(resolveListen => {
    server.listen(port, host, () => {
      const address = server.address();
      resolveListen({
        url: `http://${host}:${address.port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || "127.0.0.1";
  createServer(handler).listen(port, host, () => {
    console.log(`Jarvis listening on http://${host}:${port}`);
  });
}
