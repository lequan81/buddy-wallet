# 2026-04-11 Score Gates Baseline

Owner: Platform Team

Source plan: implement_plan_110426.md

## Score gates

- OOP: 8.8
- SOLID: 8.6
- KISS: 8.1
- DRY: 8.4
- YAGNI: 8.0
- Microservices readiness: 8.7
- Shakeability: 8.6
- Loose type dependency: 8.9

## Acceptance guardrails per phase

- Every phase must keep app-level type checks green for changed areas.
- Outbound dependency integrations must expose readiness snapshots and breaker states.
- Shared contracts can move to packages/types only when reused across app boundaries.
- Runtime imports should prefer package exports over tsconfig path bypasses.
- Stateful flows should use explicit transition guards for invalid state changes.

## Critical paths to monitor

- Auth login/register/session refresh
- Import preview/start/progress and worker processing
- Debt listing and activity listing pagination behavior
- Health readiness endpoints for db, queue, email, storage, vietqr

## Baseline command matrix

- apps/api: bun run check-types
- apps/worker: bun run check-types
- packages/types: bun run check-types
- packages/db: bun run check-types
- apps/web: bun run check (tracked separately due requested skip during this batch)

## Execution status (2026-04-11)

- [x] apps/api check-types passed
- [x] apps/worker check-types passed
- [x] packages/types check-types passed
- [x] packages/db check-types passed
- [ ] apps/web check skipped for this batch per current request
