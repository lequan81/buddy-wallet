# ADR-004: Boundary, Security, Validation, and Resilience Migration

Status: Proposed

Date: 2026-04-09

Owners: Backend and Platform Team

Decision Type: Monorepo Architecture and Security Hardening

## Context

The current monorepo has made major progress on service contracts and degraded-mode behavior, but still carries structural debt in four areas.

- Shared package overreach.
  - packages/permissions is effectively backend-only and adds workspace overhead.
  - packages/schemas uses TypeBox while packages/validation uses Valibot, creating dual schema systems.

- Runtime and contract drift.
  - Email defaults are duplicated in service and config composition.
  - Permission literals are inconsistent between web and backend policy constants.

- Resilience and workflow maturity.
  - Redis breaker logic exists but is service-specific and not fully generalized for other dependencies.
  - Import lifecycle behavior is distributed and not modeled as a first-class workflow state machine.

- Security and deployment boundaries.
  - SSR guards exist but claims and capability integrity can be strengthened.
  - Admin chunk isolation in a single-app deployment cannot be fully guaranteed.

## Decision Drivers

- Single source of truth for policy, schema, and configuration.
- Stronger zero-trust posture for UI and session claims.
- Better tree-shaking and faster build graph.
- Lower blast radius through explicit domain boundaries.
- Implementation safety through phased migration and compatibility adapters.

## Decisions

### D1: Email config ownership

- Remove local DEFAULT_EMAIL_CONFIG from apps/api/src/services/email/email.service.ts.
- Require EmailServiceConfig in EmailService constructor.
- Keep default resolution only in apps/api/src/configs.ts and DI composition in apps/api/src/plugins/di/services.plugin.ts.

Outcome:

- No duplicated SMTP default sources.
- Service remains pure and testable.

### D2: Permissions domain move

- Move permission constants and helper functions from packages/permissions into apps/api domain.
- New canonical module: apps/api/src/domain/authz/permissions.ts.
- New policy helper module: apps/api/src/domain/authz/policy.ts.

Outcome:

- Backend-owned authz policy remains in backend boundary.

### D3: Compatibility adapter exports

- Add temporary compatibility exports for non-breaking migration in apps/api/src/domain/authz/compat.ts.
- Keep legacy symbols PERMISSIONS, Permission, hasPermission, hasAllPermissions, hasAnyPermission.

Outcome:

- Existing import sites can migrate incrementally without breaking runtime behavior.

### D4: Unified schema package on Valibot

- Introduce new package packages/schema as Valibot-first source for env and DTO schemas.
- Initial subdomains:
  - env
  - dto/debt
  - dto/auth
  - dto/import
  - adapters

Outcome:

- Single validation system for env, DTO, and parser logic.

### D5: End-to-end controller migration (one group)

- Migrate import controller group from TypeBox dependency to Valibot parser path.
- Primary target: apps/api/src/controllers/import-export/import.controller.ts.
- Replace @repo/schemas imports with parse functions from @repo/schema.

Outcome:

- Verified pattern for subsequent controller-group migrations.

### D6: OOP breaker and telemetry

- Replace ad-hoc breaker style with OOP breaker implementation and explicit states.
- Add telemetry hooks for state transitions, open duration, rejection count, and probe count.
- Apply to Redis first, then external dependency clients.

Outcome:

- Consistent resilience strategy across service dependencies.

### D7: Import workflow machine

- Introduce explicit workflow state machine for import lifecycle:
  - pending -> queued -> processing -> success or failed or cancelled.
- Persist transition events and actor metadata.

Outcome:

- Traceable workflow behavior with deterministic transitions.

### D8: Remove deprecated shared packages

- Remove packages/permissions after migration and compatibility period.
- Remove packages/schemas after first controller-group migration template is proven and then applied to remaining groups.

Outcome:

- Lower Turborepo graph complexity and clearer ownership.

### D9: Remove broad runtime barrels

- Remove broad runtime export-star root barrels from config and validation entries.
- Require subpath imports for runtime code.

Outcome:

- Better tree-shaking and fewer accidental transitive imports.

### D10: Zero-trust claims and SSR gates

- Harden JWT/session claims with capability versioning and integrity checks.
- Enforce server-side admin capability checks before protected payload generation.
- Keep client-side permission flags as display-only and non-authoritative.

Outcome:

- Reduced trust in mutable client state and tighter SSR authorization.

### D11: Deployment model decision for admin chunk protection

Decision:

- Target model: split-admin-origin deployment.
- Transitional model: current single-app deployment with strict SSR and edge route guards.

Rationale:

- In a single-app static asset graph, preventing all admin chunk delivery to unauthorized clients is not strong enough.
- Split-admin-origin provides clean network and CDN-level policy separation.

### D12: Strict TS and Bun standardization

- Normalize all tsconfig extends to shared profiles.
- Add root bunfig conventions and worker bunfig parity.
- Keep app-specific overrides minimal and documented.

Outcome:

- Consistent compile strictness and runtime behavior across apps.

## Target Folder Map

buddy-wallet/

- apps/
  - api/
    - src/
      - domain/
        - authz/
          - permissions.ts
          - policy.ts
          - compat.ts
      - core/
        - resilience/
          - breaker/
            - circuit-breaker.ts
            - breaker-states.ts
            - breaker-metrics.ts
        - workflow/
          - import/
            - import-workflow.machine.ts
            - import-workflow.types.ts
- packages/
  - schema/
    - src/
      - env/
        - api-env.schema.ts
        - worker-env.schema.ts
      - dto/
        - debt/
          - create-debt.schema.ts
        - auth/
          - login.schema.ts
          - register.schema.ts
        - import/
          - preview.schema.ts
          - start-import.schema.ts
          - progress.schema.ts
      - adapters/
        - parse.ts
    - package.json
    - tsconfig.json

## Migration Plan (Phased)

### Phase 0: Guardrails and baseline

- Snapshot current typecheck and test states.
- Add architecture migration branch and CI gate for phased merges.

### Phase 1: Email config source of truth

- Remove local service defaults and enforce constructor injection.
- Keep compatibility in DI only.

### Phase 2: Permissions move and literal consistency

- Add API-domain permissions module.
- Migrate import sites in API.
- Align web literal checks with backend canonical values.

### Phase 3: Schema package bootstrap

- Add packages/schema and first env and DTO schemas.
- Add parser adapters and error mapping.

### Phase 4: Controller-group proof migration

- Migrate import controller group end-to-end from TypeBox to Valibot parsing.

### Phase 5: OOP breaker and telemetry

- Replace Redis breaker and wire telemetry.
- Add dependency-specific breaker instances.

### Phase 6: Import workflow state machine

- Integrate workflow machine with jobs service and import lifecycle.

### Phase 7: Package removals and barrel cleanup

- Remove packages/permissions.
- Remove packages/schemas.
- Narrow config and validation root exports.

### Phase 8: Zero-trust hardening and deployment split

- Add claim hardening and SSR guard updates.
- Execute split-admin-origin rollout plan.

### Phase 9: TS and Bun strict pass

- Standardize tsconfig and bunfig across all apps and relevant packages.

## Risks and Mitigations

- Risk: Migration churn across API imports.
  - Mitigation: Temporary compatibility exports and phased PRs.

- Risk: Validation behavior differences from TypeBox to Valibot.
  - Mitigation: Contract tests for migrated controller group before broad rollout.

- Risk: Breaker over-eager open state under transient spikes.
  - Mitigation: Tune policy per dependency and capture probe metrics.

- Risk: Admin deployment split complexity.
  - Mitigation: Transitional SSR and edge route policy with canary rollout.

## Verification Gates

- API:
  - bun run check-types in apps/api
  - bun test in apps/api

- Worker:
  - bun run typecheck in apps/worker

- Web:
  - bun run check in apps/web

- Packages:
  - bun run check-types in packages/schema
  - bun run check-types in packages/config
  - bun run check-types in packages/validation

- Security and behavior:
  - Unauthorized users cannot access admin SSR data.
  - Admin capability claims are validated server-side.
  - Import workflow transitions are persisted and auditable.

## Consequences

Positive:

- Smaller dependency graph, stronger boundaries, one validation stack, stronger zero-trust posture, and reusable resilience primitives.

Trade-offs:

- Multi-phase migration overhead and temporary compatibility layer maintenance.

## Approval Checklist

- Platform lead approval.
- Backend lead approval.
- Frontend lead approval.
- Security sign-off for claims and deployment split.
