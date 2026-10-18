#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bills Edit / Remove</title>
  <style>
    :root {
      --bg: #0b0f14; --fg: #f9fafb; --muted: #94a3b8; --surface: #11161d;
      --accent: #3b82f6; --accent-light: #60a5fa; --danger: #f87171;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .phone { width: 390px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 13px; margin: 0 0 8px; }
    .list { background: var(--surface); border-radius: 16px; overflow: hidden; }
    .row { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .row:last-child { border-bottom: 0; }
    .avatar { width: 36px; height: 36px; border-radius: 12px; background: rgba(59,130,246,0.2); color: var(--accent-light); display: grid; place-items: center; font-weight: 700; }
    .main { flex: 1; min-width: 0; }
    .name { font-size: 15px; font-weight: 500; }
    .meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .amt { font-weight: 600; font-variant-numeric: tabular-nums; }
    .edit { min-height: 32px; border: 0; border-radius: 999px; background: rgba(255,255,255,0.08); color: var(--accent-light); font-weight: 600; font-size: 13px; padding: 0 12px; }
    .pay { min-height: 32px; border: 0; border-radius: 999px; background: var(--accent); color: white; font-weight: 600; font-size: 13px; padding: 0 12px; }
    .sheet { margin-top: 8px; background: var(--surface); border-radius: 18px; padding: 16px; }
    .sheet h2 { margin: 0 0 12px; font-size: 18px; }
    .field { margin-bottom: 10px; }
    .field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .field .box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 12px; font-size: 15px; }
    .actions { display: flex; gap: 8px; margin-top: 14px; }
    .btn { flex: 1; min-height: 44px; border: 0; border-radius: 12px; font-weight: 600; font-size: 15px; }
    .btn.secondary { background: rgba(255,255,255,0.08); color: var(--fg); }
    .btn.primary { background: var(--accent); color: white; }
    .btn.danger { background: transparent; color: var(--danger); width: 100%; margin-top: 8px; min-height: 44px; border: 0; font-weight: 600; font-size: 15px; }
    .badge { display: inline-block; margin-top: 4px; font-size: 11px; color: var(--accent-light); background: rgba(59,130,246,0.12); padding: 4px 8px; border-radius: 999px; }
  </style>
</head>
<body>
  <div class="phone">
    <h1>Bills</h1>
    <p class="sub">Each bill has an Edit button · changes persist</p>
    <div class="list">
      <div class="row">
        <div class="avatar">R</div>
        <div class="main"><div class="name">Rent</div><div class="meta">Due in 4 days · Recurring</div></div>
        <div class="amt">$1,450.00</div>
        <button class="edit">Edit</button>
      </div>
      <div class="row">
        <div class="avatar">U</div>
        <div class="main"><div class="name">Utilities</div><div class="meta">Due tomorrow · Autopay</div></div>
        <div class="amt">$128.40</div>
        <button class="edit">Edit</button>
        <button class="pay">Pay</button>
      </div>
      <div class="row">
        <div class="avatar">I</div>
        <div class="main"><div class="name">Internet</div><div class="meta">Due in 12 days</div></div>
        <div class="amt">$79.99</div>
        <button class="edit">Edit</button>
      </div>
    </div>

    <div class="sheet">
      <h2>Edit Bill</h2>
      <div class="field"><label>Bill name</label><div class="box">Utilities</div></div>
      <div class="field"><label>Amount</label><div class="box">$128.40</div></div>
      <div class="field"><label>Due date (day of month)</label><div class="box">19</div></div>
      <div class="field"><label>Frequency</label><div class="box">Monthly</div></div>
      <div class="field"><label>Linked bank account</label><div class="box">Checking</div></div>
      <div class="actions">
        <button class="btn secondary">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
      <button class="btn danger">Remove bill</button>
      <div><span class="badge">Confirm before remove · history kept</span></div>
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "networkidle" });
const pathOut = `${OUT}/bills-edit-remove-iphone.png`;
await page.screenshot({ path: pathOut, fullPage: true });
await browser.close();
console.log(pathOut);
