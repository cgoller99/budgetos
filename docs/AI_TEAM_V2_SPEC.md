# Buxme AI Mission Control V2 build spec

Build a cohesive V2 of the existing admin-only Buxme AI Mission Control on branch ai-team-v2.

## Read first
- AGENTS.md if present
- docs/AI_TEAM.md
- app/api/admin/ai-team/route.ts
- components/admin/AdminAiTeamSection.tsx
- components/admin/AdminDashboard.tsx and existing admin UI primitives/tokens
- lib/ai-team/*
- lib/admin/apiAuth.ts and lib/admin/eventLog.ts
- lib/supabase/database.types.ts
- existing AI Team migrations
- package.json
- current installed AI SDK docs/source in node_modules/ai before relying on ToolLoopAgent result fields

## Design direction
- Premium Buxme dark fintech aesthetic: deep navy/black, Buxme blue, subtle depth, restrained glass.
- Apple/Linear-quality clarity, not cyberpunk.
- Desktop should feel like a real founder command center; mobile must remain usable.
- Refactor the giant AdminAiTeamSection into smaller components under components/admin/ai-team/ where sensible.
- Do not add a dependency unless clearly justified.

## V2 features

### 1. Executive Command Center
- live runtime state, model names, evidence freshness
- deterministic Launch Readiness / Operating Health score using only available snapshot evidence; show contributors and missing evidence
- Executive Brief: top signals, risks, opportunities, next moves from snapshot + recent runs
- KPI strip: agents, recent runs, open approvals, open work items, healthy evidence sources, daily planning usage
- goal composer with Ctrl/Cmd+Enter, quick templates, routing preview
- selected-agent chips and expected call count
- recent activity timeline

### 2. Work Queue
Aggregate persisted tasks from recent runs:
- search
- owner/status/approval filters
- newest/oldest/priority sorting
- responsive table/card layout
- show title, objective, owner, run goal, evidence count, approval reason/decision state
- no automatic action execution
- Copy execution brief copies markdown to clipboard only

### 3. Run Explorer
- search plus source/model/agent filters
- expandable details
- selected/routed agents
- task status breakdown
- approval count
- evidence list
- copy run as Markdown/JSON
- clearly label AI vs deterministic fallback
- bounded history
- show duration/model-call/token usage metadata only if verified against installed AI SDK APIs

### 4. Approval Center
Record decisions without executing actions:
- Approve / Reject buttons for approval-gated tasks
- optional note and confirmation dialog
- persist actor, task, run, decision, note, timestamp
- immutable audit history
- UI clearly states a decision does not execute the underlying action
- pending count excludes decided tasks
- audit each decision
- use an additive admin-only persistence table/migration

### 5. Playbooks
Built-in templates:
- Launch Risk
- Plaid Health
- Onboarding Conversion
- Release QA
- Growth Experiment
- Support Themes
- Subscription Health
- iOS Purchase QA

Custom playbooks:
- create from a goal
- title, description, category, goal template, favorite
- edit/favorite/delete custom playbooks
- choosing a playbook fills composer; never auto-runs
- persist custom playbooks in an additive admin-only table/migration

### 6. Evidence Center
- source cards for overview, revenue/Stripe, Plaid, analytics, health
- status healthy/partial/unavailable
- freshness and exactly which fields are available
- observations + unavailable sources
- data gaps section
- never infer missing values
- collapsed raw JSON inspector for admin debugging

### 7. Agent Directory
- all 8 agents
- icon, role class, mission, permissions, guardrails
- route keywords/capabilities
- whether selected for typed goal
- deterministic why-routed explanation
- cost-awareness badge: core/default/conditional

### 8. Operating Suggestions
3-6 deterministic safe planning/read-only suggestions based on evidence + recent runs.
Rank by severity/impact.
Clicking fills the composer only.

### 9. Runtime Telemetry
Verify installed AI SDK APIs first.
If supported, persist:
- selected specialists
- total input/output/total token usage
- total model call count
- total duration
- optional critic summary if straightforward
Use a backward-compatible runtime_metadata jsonb field on ai_team_runs.
Never fabricate usage.
Do not estimate dollar costs unless a trustworthy runtime source exists.

### 10. Public health endpoint
Add GET /api/health/ai-team with no sensitive/user data:
{
  ok: boolean,
  version: "2.0.0",
  ready: boolean,
  persistenceConfigured: boolean,
  runtimeConfigured: boolean
}
It should safely verify required AI Team persistence objects. Do not expose models, emails, keys, private counts, or data.

### 11. Product polish
- intentional skeleton/loading/error/empty states
- keyboard-friendly navigation
- responsive mobile
- accessible forms/buttons/dialogs
- subtle CSS transitions
- no horizontal overflow
- maintainable components
- do not break the rest of /admin

### 12. Preserve V1 protections
Keep current admin authorization, database access boundary, daily plan limit, active-run locking, timeouts/output limits, selective routing, Critic-before-Chief flow, deterministic fallback, and approval classification. V2 still does not execute production-sensitive tasks from Mission Control.

## Database changes
Create additive local migration files only; do not apply them yet:
- ai_team_approval_decisions
- ai_team_playbooks
- runtime_metadata jsonb on ai_team_runs
- carefully update save_ai_team_run_atomic to accept runtime metadata
Enable RLS on new tables and keep them server-admin only.
Keep RPC SECURITY INVOKER.
Update database.types.ts.

## Testing
Extend scripts/test-ai-team-safety.mjs where useful and add a lightweight V2 invariant test if useful.
Run:
- git diff --check
- npm run test:ai-team-safety
- any new V2 test
- targeted eslint for changed files
- npm run build

Do not commit, push, deploy, apply migrations, or modify/read secret values.
Do not touch untracked npm or test.env.
Finish with a concise report.
