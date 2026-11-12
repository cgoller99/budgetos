import assert from "node:assert/strict";
import { parseJarvisExecutionLedger } from "../lib/jarvis/executionLedger.mjs";
const body = "Read-only Jarvis execution completed.\n\nExecution ID: abcdef0123456789abcd\nWorkflow: 12345";
const sample = { title: "Jarvis execution: revenue-funnel-audit", body, number: 9, html_url: "https://github.com/test/issues/9", created_at: "2026-11-11T00:00:00Z" };
assert.deepEqual(parseJarvisExecutionLedger([sample], ["revenue-funnel-audit"]).map(x=>x.status), ["ledger_recorded"]);
assert.equal(parseJarvisExecutionLedger([{...sample, pull_request: {} }], ["revenue-funnel-audit"]).length, 0);
assert.equal(parseJarvisExecutionLedger([{...sample, body: "forged" }], ["revenue-funnel-audit"]).length, 0);
assert.equal(parseJarvisExecutionLedger([sample], ["different-task"]).length, 0);
console.log("Jarvis execution ledger parsing passed");
