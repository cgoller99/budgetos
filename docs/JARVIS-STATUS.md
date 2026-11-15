# Jarvis worker status

Updated: 2026-11-15

## Delivered

- Scheduled proposal worker runs every 15 minutes at staggered offsets (`7,22,37,52`).
- Evidence-backed findings are deduplicated into GitHub Issues, which is the durable queue across ephemeral GitHub runners.
- Local task queue entries now contain bounded audit history, priority, and review events.
- The approved read-only executor claims one allowlisted task at a time using deterministic priority, creation time, and ID ordering.
- Executor claims are leased and reconciled after interruption. Failures retry at most three times with bounded exponential backoff; completed execution records are idempotent.
- Coding generation remains isolated in the protected `jarvis-coding` environment and emits an unapplied patch artifact only.
- Generated patches remain subject to protected-path, size, clean-apply, and review checks. No workflow merges, deploys, billing actions, banking actions, or customer-data writes.
- Model selection supports coding, business, research, and routine task kinds with configured-model validation and a chat-model fallback.

## Operating contract

The scheduled worker is periodic, not a 24/7 process. It observes signals, ranks proposals, persists review issues, and uploads a run report. A human must approve a coding task before the protected coding workflow can run, and a human must approve any generated patch before it can enter the repository.

The read-only executor is intentionally manual-only and uses the protected `jarvis-coding` environment. Do not add automatic triggers or broader GitHub token permissions without an explicit security review.

## Remaining operator actions

1. Configure and verify the repository's protected `jarvis-coding` environment reviewer.
2. Provide and verify `AI_GATEWAY_API_KEY`/`YEAH` and model variables only in GitHub Actions secrets/variables; never commit them.
3. Review proposal issues and dispatch the protected coding workflow with a single approved target file when appropriate.
4. Inspect the generated patch and CI before manually applying or merging any change.
5. Keep workflow run `43678769123` paused for its required protected-environment reviewer approval; do not bypass it.

## Validation

The Jarvis queue, executor, schedule-policy, workflow-policy, model-routing, and priority-worker tests pass locally. Live model/provider access and protected-environment approval were not claimed or bypassed.
