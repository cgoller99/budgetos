# Buxme AI Team

The AI Team is an admin-only operating layer for Buxme. V1 lives inside the existing `/admin`
experience and reuses the same admin authentication, Supabase service layer, and platform metrics.

## V1 roles

- **Chief of Staff** — turns goals into prioritized specialist work and surfaces decisions.
- **Engineering** — analyzes code and technical risk, then proposes the smallest safe implementation.
- **QA** — defines regression coverage and reproducible acceptance checks.
- **Analytics** — establishes baselines, separates evidence from inference, and identifies data gaps.

## Safety model

V1 is read-first. It may inspect available admin metrics and create plans, but it does not execute
production writes. Production deploys, database writes, subscription/payment operations, customer
communications, destructive actions, and other customer-impacting changes require an approval gate.
## Current architecture

- `lib/ai-team/agents.ts` — agent definitions and permissions.
- `lib/ai-team/snapshot.ts` — resilient evidence snapshot from existing admin services.
- `lib/ai-team/planner.ts` — deterministic goal decomposition and approval-gate fallback.
- `lib/ai-team/modelRuntime.ts` — Vercel AI SDK multi-agent runtime with structured output and safe fallback.
- `app/api/admin/ai-team/route.ts` — protected GET/POST API.
- `components/admin/AdminAiTeamSection.tsx` — admin control-plane UI.

No new database tables or migrations are required for V1.

The model runtime uses Vercel AI Gateway when credentials/OIDC are available. Specialists default
to `openai/gpt-5.6-luna`; the Chief of Staff defaults to `openai/gpt-5.6-sol-fast`. Both can be
overridden with server-only environment variables. If the gateway is unavailable, planning falls
back to deterministic logic rather than failing the admin experience.

## Evidence rules

1. Never invent unavailable metrics or system state.
2. Label observations separately from recommendations.
3. Surface unavailable sources instead of silently substituting guesses.
4. Use the existing admin authorization boundary for every server-side request.
5. Stop at an approval gate before any production-sensitive action.
## Next rollout

1. Add durable task/run persistence after the control plane is proven useful.
2. Add a model-provider adapter with strict structured output and server-only credentials.
3. Add read-only adapters for PostHog, repository state, preview deployments, and QA evidence.
4. Add approval records and audited execution for narrowly scoped actions.
5. Expand to Product, Growth, Customer, and Critic agents only after the core four are reliable.

The operating principle is evidence first, proposal second, approval third, execution last.
