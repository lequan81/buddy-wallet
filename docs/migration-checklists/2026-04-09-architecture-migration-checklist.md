# 2026-04-09 Architecture Migration Checklist

Owner: Platform Team

Related ADR: docs/adr/ADR-004-boundary-security-validation-resilience-migration.md

Scope:

- Remove local email defaults and centralize DI config.
- Move permissions into API domain and align literals.
- Add temporary compatibility adapters.
- Add packages/schema with Valibot env and DTO schemas.
- Migrate one API controller group from TypeBox to Valibot parser.
- Replace breaker with OOP breaker and telemetry.
- Add import workflow machine.
- Remove packages/permissions and packages/schemas.
- Narrow root runtime barrels for config and validation.
- Harden zero-trust claims and SSR policy gates.
- Decide and execute admin deployment model.
- Standardize tsconfig and bunfig.

## Phase 0 - Baseline and guardrails

- [ ] Confirm clean baseline commands:
  - apps/api: bun run check-types
  - apps/web: bun run check
  - apps/worker: bun run typecheck
- [ ] Snapshot current import usage for target packages:
  - @repo/permissions
  - @repo/schemas
  - @repo/validation
- [ ] Open migration branch and enforce CI gates for each phase PR.

## Phase 1 - Email config source of truth

Files:

- [ ] apps/api/src/services/email/email.service.ts
  - Remove DEFAULT_EMAIL_CONFIG.
  - Make constructor require EmailServiceConfig.
- [ ] apps/api/src/plugins/di/services.plugin.ts
  - Keep canonical EmailService config injection.
- [ ] apps/api/src/configs.ts
  - Keep canonical SMTP defaults and fallback policy.

Verification:

- [ ] apps/api typecheck passes.
- [ ] Email flows still work in dev and test.

## Phase 2 - Permissions move and literal consistency

Files to add:

- [ ] apps/api/src/domain/authz/permissions.ts
  - Canonical permission constants and type.
- [ ] apps/api/src/domain/authz/policy.ts
  - hasPermission, hasAllPermissions, hasAnyPermission helpers.
- [ ] apps/api/src/domain/authz/compat.ts
  - Temporary compatibility exports with legacy symbol names.
- [ ] apps/api/src/domain/authz/index.ts

Files to update:

- [ ] apps/api/src/plugins/guards/permission.guard.ts
- [ ] apps/api/src/controllers/debt/debts.controller.ts
- [ ] apps/api/src/controllers/user/users.controller.ts
- [ ] apps/api/src/controllers/storage/upload.controller.ts
- [ ] apps/api/src/controllers/notification/push.controller.ts
- [ ] apps/api/src/controllers/bank/bank.controller.ts
- [ ] apps/api/src/services/auth/auth-core.service.ts
- [ ] apps/api/src/services/debt/debt.service.ts
- [ ] apps/api/package.json
  - Remove dependency on @repo/permissions.

Permission literal alignment in web:

- [ ] apps/web/src/routes/(admin)/+layout.server.ts
  - Replace users:manage, data:import, data:export with canonical literals.
- [ ] apps/web/src/hooks.server.ts
  - Keep admin:view check aligned with canonical backend literal.

Build config cleanup:

- [ ] apps/web/vite.config.ts
  - Remove stale @repo/permissions exclude entry if no longer used.

Verification:

- [ ] Permission checks still enforce expected access rules.
- [ ] Admin pages render correctly for admin and non-admin users.

## Phase 3 - Stand up packages/schema (Valibot-first)

Create package:

- [ ] packages/schema/package.json
- [ ] packages/schema/tsconfig.json
- [ ] packages/schema/src/index.ts

Env schemas:

- [ ] packages/schema/src/env/api-env.schema.ts
- [ ] packages/schema/src/env/worker-env.schema.ts
- [ ] packages/schema/src/env/index.ts

DTO schemas:

- [ ] packages/schema/src/dto/auth/login.schema.ts
- [ ] packages/schema/src/dto/auth/register.schema.ts
- [ ] packages/schema/src/dto/auth/index.ts
- [ ] packages/schema/src/dto/debt/create-debt.schema.ts
- [ ] packages/schema/src/dto/debt/index.ts
- [ ] packages/schema/src/dto/import/preview.schema.ts
- [ ] packages/schema/src/dto/import/start-import.schema.ts
- [ ] packages/schema/src/dto/import/progress.schema.ts
- [ ] packages/schema/src/dto/import/index.ts

Adapters:

- [ ] packages/schema/src/adapters/parse.ts
- [ ] packages/schema/src/adapters/index.ts

Workspace integration:

- [ ] apps/api/package.json
  - Add @repo/schema workspace dependency.
- [ ] root package lock refresh.

Verification:

- [ ] packages/schema check-types passes.
- [ ] No server-only runtime imported into web bundles.

## Phase 4 - Migrate one API controller group end-to-end

Target group: import-export import endpoints

Files:

- [ ] apps/api/src/controllers/import-export/import.controller.ts
  - Replace @repo/schemas TypeBox usage with Valibot parser calls.
- [ ] apps/api/src/core/http
  - Add or extend request parsing helper for Valibot issue mapping.
- [ ] apps/api/src/services/import-export/import.validators.ts
  - Align helper contracts with new schema package.

Verification:

- [ ] Existing endpoint behavior and response contracts preserved.
- [ ] SSE endpoint behavior preserved.
- [ ] API typecheck and tests pass.

## Phase 5 - OOP breaker and telemetry

Add breaker core:

- [x] apps/api/src/core/resilience/breaker/circuit-breaker.ts
- [x] apps/api/src/core/resilience/breaker/breaker-states.ts
- [x] apps/api/src/core/resilience/breaker/breaker-policy.ts
- [x] apps/api/src/core/resilience/breaker/breaker-metrics.ts
- [x] apps/api/src/core/resilience/breaker/index.ts

Migrate Redis integration:

- [x] apps/api/src/plugins/redis/circuit-breaker.ts
  - Replace with adapter using new OOP breaker.
- [x] apps/api/src/plugins/redis/connection.ts
- [x] apps/api/src/plugins/redis/cache.ts

Telemetry hooks:

- [x] apps/api/src/plugins/redis/cache.ts
  - Emit breaker open, half-open probe, reject, and close metrics.

Verification:

- [x] Redis failure simulation opens breaker as expected.
- [x] Telemetry emitted for transitions and rejected operations.

## Phase 6 - Introduce import workflow machine

Add workflow machine:

- [x] apps/api/src/core/workflow/import/import-workflow.types.ts
- [x] apps/api/src/core/workflow/import/import-workflow.machine.ts
- [x] apps/api/src/core/workflow/import/index.ts

Integrate in runtime:

- [x] apps/api/src/services/system/jobs.service.ts
- [x] apps/api/src/services/import-export/import.service.ts
- [x] apps/api/src/services/import-export/import-logger.service.ts

Verification:

- [x] Transition graph enforces valid states only.
- [x] Workflow events are auditable and replay-safe.

## Phase 7 - Remove packages/permissions and packages/schemas

Before deletion:

- [x] Confirm zero imports remain for @repo/permissions and @repo/schemas.

Delete:

- [x] packages/permissions/index.ts
- [x] packages/permissions/package.json
- [x] packages/permissions/tsconfig.json
- [x] packages/schemas/src
- [x] packages/schemas/package.json
- [x] packages/schemas/tsconfig.json

Update dependencies:

- [x] apps/api/package.json
  - Remove @repo/permissions and @repo/schemas.
- [x] Any other package manifests with stale references.

Verification:

- [x] Full workspace install and typecheck pass.

## Phase 8 - Remove broad runtime root barrels

Config package:

- [x] packages/config/src/index.ts
  - Replace broad export-star with explicit subpath exports.

Validation package:

- [x] packages/validation/index.ts
- [x] packages/validation/client.ts
  - Remove broad valibot re-exports in root runtime entries.
  - Keep narrow, explicit exports.

Optional internal barrel tightening:

- [ ] apps/api/src/plugins/index.ts
- [ ] apps/api/src/utils/index.ts
  - Avoid accidental heavy transitive imports where feasible.

Verification:

- [x] Imports are explicit and tree-shaking behavior improves.

## Phase 9 - Zero-trust claims and SSR policy hardening

JWT and claims:

- [ ] apps/api/src/plugins/auth/jwt.plugin.ts
  - Add capability claims schema fields.
- [ ] apps/api/src/services/auth/auth-security.service.ts
  - Include capability version/hash in signed access token.
- [ ] apps/api/src/plugins/auth/session-auth.plugin.ts
  - Validate capability claims against authoritative data.

SSR gates:

- [ ] apps/web/src/hooks.server.ts
  - Enforce strict protected-route gate semantics.
- [ ] apps/web/src/routes/(admin)/+layout.server.ts
- [ ] apps/web/src/routes/(admin)/admin/+layout.server.ts
  - Ensure unauthorized sessions do not resolve admin payloads.

Verification:

- [ ] Permission tampering in browser memory does not grant admin access.
- [ ] Stale capability claims are rejected.

## Phase 10 - Admin chunk protection deployment decision and rollout

Decision:

- [ ] Record final decision: split-admin-origin target, single-app transitional.

Implementation planning files:

- [ ] infra/deployment/admin-origin-plan.md
- [ ] infra/cdn/edge-auth-rules.md

Transitional controls:

- [ ] Keep strict SSR auth gates in single-app mode.
- [ ] Add edge rule to deny admin entry routes without authorized session.

Split rollout:

- [ ] Create separate admin frontend deployment target.
- [ ] Restrict admin asset origin and cookie scope.

Verification:

- [ ] Unauthorized clients cannot fetch admin chunks from admin origin.

## Phase 11 - Strict config pass (TS and Bun)

TypeScript base profiles:

- [ ] packages/typescript-config/base.json
- [ ] packages/typescript-config/app.json
- [ ] packages/typescript-config/library.json
- [ ] packages/typescript-config/svelte.json

App configs:

- [ ] apps/api/tsconfig.json
- [ ] apps/web/tsconfig.json
- [ ] apps/worker/tsconfig.json

Package configs with drift:

- [ ] packages/logger/tsconfig.json
- [ ] packages/utils/tsconfig.json
- [ ] packages/validation/tsconfig.json

Bun configs:

- [ ] bunfig.toml at root (new)
- [ ] apps/api/bunfig.toml (align with root conventions)
- [ ] apps/worker/bunfig.toml (new)

Verification:

- [ ] Consistent strict mode and module resolution policy.
- [ ] Dev, build, and typecheck commands work consistently across apps.

## Final release checklist

- [ ] Migration PRs merged in phase order.
- [ ] Compatibility adapter removal date agreed.
- [ ] SLO and telemetry dashboards updated for breaker and workflow machine.
- [ ] Security sign-off completed for claim hardening and admin deployment split.
- [ ] Post-release review completed with regression checklist.
