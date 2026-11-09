"use client";
import { useEffect, useState } from "react";
type Check = { name: string; state: "ready" | "missing" | "unverified"; detail: string };
export function JarvisSetup() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/jarvis-setup", { cache: "no-store" }).then(async r => {
      const body = await r.json();
      if (!r.ok) throw Error(body.error || "Setup status unavailable");
      if (alive) setChecks(body.checks ?? []);
    }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-6">
    <h2 className="text-lg font-semibold">Coding worker readiness</h2>
    <p className="mt-2 text-sm text-slate-400">Checks are read-only. Unverified does not mean ready. No secret values are displayed.</p>
    {error && <p role="alert" className="mt-3 text-amber-300">{error}</p>}
    <div className="mt-4 space-y-3">{checks.map(check => <div key={check.name} className="rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{check.name}</strong><span className="text-xs uppercase text-blue-300">{check.state}</span></div>
      <p className="mt-2 text-xs text-slate-400">{check.detail}</p>
    </div>)}</div>
    <p className="mt-4 text-xs text-slate-400">A successful first patch generation and workflow run are still required before Jarvis coding can be considered operational.</p>
  </article>;
}
