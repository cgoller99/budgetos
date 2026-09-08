# Buxme AI Team — V2

Buxme AI Team V2 is the admin-only Mission Control for operating Buxme. It lives inside the existing
`/admin` experience and reuses Buxme's existing admin authentication, Supabase service layer,
platform metrics, and Vercel deployment runtime.

## Operating team

- **Chief of Staff** — orchestrates selected specialists, weighs the Critic review, and produces the final plan.
- **Engineering** — investigates code, integrations, reliability, security, and technical risk.
- **QA** — defines launch/release coverage, regressions, and reproducible acceptance checks.
- **Analytics** — establishes baselines, trends, measurable outcomes, and missing evidence.
- **Product** — improves UX and product flows while resisting unnecessary feature sprawl.
- **Growth** — designs measurable acquisition, activation, pricing, and conversion experiments.
- **Customer** — turns available feedback/support signals into product and response recommendations.
- **Critic** — challenges unsupported assumptions, unsafe actions, weak evidence, and low-value scope before the Chief of Staff finalizes a plan.

Specialists are selected deterministically from the founder goal so the system does not call every
agent on every run. Analytics participates by default, the relevant specialists are routed in, and
the Critic reviews their briefs before the Chief of Staff produces the final structured plan.

## Safety model

V2 remains read-first for execution. It can inspect available admin evidence, coordinate agents, persist plans and tasks,
record approval decisions, manage playbooks, and surface approval-gated work. It does not execute production-sensitive actions from Mission Control.

Production deploys, database writes, billing/subscription operations, pricing changes, customer
communications, customer-data exports, destructive actions, and similar customer-impacting work are
classified behind an approval gate. Admins can record an immutable approval or rejection decision,
but that decision never executes the underlying action.

## Mission Control

The admin UI includes:

- runtime/model status and evidence freshness
- high-level agent, run, approval, and evidence counters
- Command, Work Queue, Runs, Approvals, Playbooks, Evidence, and Agents sections
- deterministic Launch Readiness and Operating Health scores with visible contributors
- executive brief, KPI strip, recent activity, and ranked planning-only suggestions
- founder goal composer with quick-goal templates
- deterministic agent-routing preview before submission
- all eight agent definitions, permissions, missions, and guardrails
- persisted run history with task-level evidence and approval reasons
- bounded approval history with immutable decisions
- built-in and persisted custom playbooks
- searchable/filterable persisted work queue and run explorer
- verified model-call, token, and duration telemetry when available
- live/partial/unavailable evidence cards
- safe, deterministic next-action suggestions
- automatic evidence refresh with stale-response protection
- loading, empty, and error states designed for the existing Buxme admin UI

## Current architecture

- `lib/ai-team/agents.ts` — eight agent definitions, missions, permissions, and guardrails.
- `lib/ai-team/routing.ts` — deterministic specialist selection.
- `lib/ai-team/snapshot.ts` — resilient evidence snapshot built from existing admin services.
- `lib/ai-team/planner.ts` — deterministic planning fallback and approval-gate classification.
- `lib/ai-team/modelRuntime.ts` — Vercel AI SDK multi-agent runtime with structured output, timeouts, and safe fallback.
- `lib/ai-team/runHistory.ts` — atomic run/task persistence and bounded history queries.
- `lib/ai-team/operations.ts` — approval-decision and custom-playbook persistence.
- `lib/ai-team/intelligence.ts` — deterministic scores and operating suggestions.
- `app/api/admin/ai-team/route.ts` — protected GET/POST API with rate limits, distributed run locking, and persistence.
- `app/api/admin/ai-team/approvals/route.ts` — decision-only approval recording.
- `app/api/admin/ai-team/playbooks/route.ts` — custom playbook CRUD.
- `app/api/health/ai-team/route.ts` — non-sensitive public readiness endpoint.
- `components/admin/ai-team/*` — maintainable Mission Control views.
- `scripts/test-ai-team-safety.mjs` — approval-policy and routing regression checks.

## Persistence

V2 uses four admin-only Supabase tables:

- `public.ai_team_runs`
- `public.ai_team_tasks`
- `public.ai_team_approval_decisions`
- `public.ai_team_playbooks`

All four have RLS enabled and are intentionally unavailable to `anon` and `authenticated` roles.
Server-side admin access uses the existing service-role boundary. Run + task persistence is atomic
through `public.save_ai_team_run_atomic(...)`, which is executable by `service_role` only.

Migration sequence:

- `20260907_ai_team_event_type.sql`
- `20260907_ai_team_run_history.sql`
- `20260908_ai_team_expand_roles.sql`
- `20260909_ai_team_atomic_persistence.sql`
- `20260910_ai_team_v2.sql`
- `20260911_ai_team_v2_hardening.sql`

## Runtime

The model runtime uses Vercel AI Gateway when Vercel OIDC or an explicit gateway credential is
available. Defaults:

- Specialists: `openai/gpt-5.6-luna`
- Chief of Staff: `openai/gpt-5.6-sol-fast`

Both can be overridden with server-only environment variables. Specialist output and Chief output
have explicit token limits, and model calls have timeouts. If the model runtime fails, Mission Control
falls back to deterministic planning rather than inventing results or breaking the admin experience.

## Evidence rules

1. Never invent unavailable metrics, customer feedback, repository state, or completed work.
2. Separate observed evidence from recommendation and inference.
3. Surface unavailable sources directly in both the UI and persisted task evidence.
4. Use the existing admin authorization boundary for every server-side request.
5. Stop at an approval gate before production-sensitive execution.
6. Keep requests cost-bounded with selective routing, daily planning limits, output limits, and timeouts.

## V2 verification

V2 is considered complete when:

- all eight roles and all seven V2 views are available in Mission Control
- production-sensitive work is approval-gated
- run/task persistence is atomic and all V2 persistence is access-controlled
- approval decisions are immutable and do not execute work
- runtime telemetry is displayed only when it was actually reported or measured
- Mission Control can load live production evidence through the configured production backend
- AI Team safety and V2 invariant tests, lint, and production build pass

The operating principle is: evidence first, critique second, proposal third, approval fourth,
execution only after an explicit approved action exists.
