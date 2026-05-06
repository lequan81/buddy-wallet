# API Refactor Codebase Plan

## 1. Scope

This document is a detailed execution plan to refactor `apps/api` while preserving:

- Laravel-style clarity in folder structure.
- JS-friendly implementation style.
- Monorepo package boundaries.

## 2. Constraint Lock

These are fixed constraints for all refactor tasks:

- Small Action files are valid and should be preserved.
- Keep repository helper plugins in `src/app/Repositories/Extensions` intact.
- Keep framework and infrastructure plugins in `src/app/Providers/Plugins` as the default architecture.
- Keep `src/app/Http/Requests` as a permanent, first-class layer.
- Keep exception separation by layer and remove only duplicated class implementations.

## 3. Current Baseline

Current measurable state from deep scan:

- Action files: 95
- Controllers: 12
- Services: 27
- `container.register(...)` calls in `AppServiceProvider`: 114
- High constructor DI load:
- `StorageController`: 11
- `AuthController`: 10
- `DebtController`: 10
- Request layer exists but is not used consistently by controllers.
- HTTP exception classes are duplicated in more than one location.
- Plugin README still contains stale path examples.

## 4. Refactor Objectives

Primary objectives:

- Reduce DI noise without removing small Action files.
- Keep plugin boundaries explicit and stable.
- Reduce controller constructor bloat.
- Make `app/Http/Requests` authoritative for input contracts.
- Preserve layered exceptions and remove duplicate class definitions.
- Remove duplicated business logic between Actions and Services.

## 5. Definition Of Done

Refactor is complete when all criteria are met:

- Manual DI registrations in `AppServiceProvider` are reduced from 114 to <= 25.
- No controller has more than 4 constructor dependencies.
- Controller validation uses `app/Http/Requests` exports for all covered routes.
- Each HTTP exception class has one canonical implementation.
- Plugin locations remain split by intent unless fallback is explicitly approved.
- Typecheck, lint, and tests pass.

## 6. Target Runtime Chain

Default target chain:

`Controller -> Module Orchestrator -> Small Actions -> Services or Repositories -> Models`

Rationale:

- Keeps small Action files as requested.
- Reduces controller constructor bloat.
- Preserves existing service investments.
- Avoids high-risk full rewrite.

## 7. Workstream A Plugin Boundaries

Goal: freeze and enforce plugin layer intent.

Tasks:

- Keep `src/app/Repositories/Extensions/PaginationPlugin.ts` unchanged.
- Keep `src/app/Repositories/Extensions/SoftDeletePlugin.ts` unchanged.
- Keep provider plugin tree under `src/app/Providers/Plugins/**` unchanged.
- Update stale docs in `src/app/Providers/Plugins/README.md`.
- Add lint boundaries to prevent repositories importing provider plugins.
- Add lint boundaries to prevent provider plugins importing repository helpers directly.

Implementation checklist (owners and estimated hours):

- [ ] Audit all plugin imports and produce boundary matrix. Owner: Backend Architect. Est: 2h.
- [ ] Confirm repository helper plugins remain unchanged and document invariants. Owner: API Engineer. Est: 1h.
- [ ] Update `src/app/Providers/Plugins/README.md` examples to current paths. Owner: API Engineer. Est: 2h.
- [ ] Add ESLint boundary rule preventing repository -> provider plugin imports. Owner: Platform Engineer. Est: 3h.
- [ ] Add ESLint boundary rule preventing provider plugin -> repository helper imports. Owner: Platform Engineer. Est: 3h.
- [ ] Run lint and verify no boundary violations remain. Owner: QA Engineer. Est: 2h.

Deliverable:

- Stable plugin boundary with updated docs and enforceable rules.

## 8. Workstream B DI Modernization

Goal: remove low-value manual DI boilerplate.

Tasks:

- Add registration discovery utility in provider layer.
- Auto-register `@injectable` classes from:
- `src/app/Actions/**`
- `src/app/Services/**`
- `src/app/Repositories/Database/**`
- Keep manual registration only for runtime instances:
- Database
- Logger
- Event bus
- S3 storage clients
- Keep explicit interface token bindings where required.

Implementation checklist (owners and estimated hours):

- [ ] Implement injectable discovery utility for folder-based registration. Owner: Platform Engineer. Est: 5h.
- [ ] Add auto-registration for `src/app/Actions/**`. Owner: Platform Engineer. Est: 3h.
- [ ] Add auto-registration for `src/app/Services/**`. Owner: Platform Engineer. Est: 3h.
- [ ] Add auto-registration for `src/app/Repositories/Database/**`. Owner: Platform Engineer. Est: 3h.
- [ ] Keep explicit manual registrations for runtime singletons (database, logger, event bus, storage). Owner: Backend Architect. Est: 2h.
- [ ] Preserve repository interface token bindings and validate resolution. Owner: Backend Architect. Est: 2h.
- [ ] Add startup DI smoke test and compare registration count before and after. Owner: QA Engineer. Est: 3h.

Deliverable:

- `AppServiceProvider` reduced to high-signal boot and core registration logic.

## 9. Workstream C Controller De-Bloat

Goal: preserve Actions, reduce constructor injection count.

Tasks:

- Create module orchestrators:
- `AuthOrchestrator`
- `DebtOrchestrator`
- `StorageOrchestrator`
- `DataOrchestrator`
- `BankOrchestrator`
- `UserOrchestrator`
- Move multi-action route orchestration into orchestrators.
- Controllers inject orchestrators instead of many individual actions.
- Keep small Action files inside modules as use-case units.

Implementation checklist (owners and estimated hours):

- [ ] Define orchestrator contracts and method boundaries for all modules. Owner: Backend Architect. Est: 3h.
- [ ] Implement `AuthOrchestrator` and refactor `AuthController`. Owner: API Engineer. Est: 5h.
- [ ] Implement `DebtOrchestrator` and refactor `DebtController`. Owner: API Engineer. Est: 6h.
- [ ] Implement `StorageOrchestrator` and refactor `StorageController`. Owner: API Engineer. Est: 7h.
- [ ] Implement `DataOrchestrator` and refactor import/export controllers. Owner: API Engineer. Est: 5h.
- [ ] Implement `BankOrchestrator` and refactor `BankController`. Owner: API Engineer. Est: 4h.
- [ ] Implement `UserOrchestrator` and refactor user and push controllers. Owner: API Engineer. Est: 5h.
- [ ] Add controller dependency audit script and verify max 4 constructor dependencies. Owner: Platform Engineer. Est: 3h.

Deliverable:

- Thin controllers with low dependency count and clear route-level flow.

## 10. Workstream D Request Layer First-Class

Goal: keep `app/Http/Requests` permanent and authoritative.

Tasks:

- Make controllers import schemas and request types from `src/app/Http/Requests/index.ts`.
- Replace inline route request schema definitions where equivalent request DTO exists.
- Keep package-level shared schema source, adapt through request DTO wrappers.
- Add lint or CI check preventing direct inline schema drift in controllers for covered endpoints.

Implementation checklist (owners and estimated hours):

- [ ] Inventory controller inline schemas and map each to request DTO availability. Owner: API Engineer. Est: 3h.
- [ ] Add missing request DTO wrappers and exports in `app/Http/Requests`. Owner: API Engineer. Est: 4h.
- [ ] Migrate auth and debt controllers to request DTO imports. Owner: API Engineer. Est: 5h.
- [ ] Migrate storage, data, user, and bank controllers to request DTO imports. Owner: API Engineer. Est: 8h.
- [ ] Keep package-level schema dependency only behind request DTO wrappers for covered routes. Owner: Backend Architect. Est: 2h.
- [ ] Add lint or CI guard against new inline request schema drift on covered routes. Owner: Platform Engineer. Est: 4h.
- [ ] Add contract tests for key endpoint validation behavior before and after migration. Owner: QA Engineer. Est: 5h.

Deliverable:

- One clear HTTP input contract boundary at `app/Http/Requests`.

## 11. Workstream E Exception Layer Preservation

Goal: keep separation by layer while removing duplicate implementations.

Tasks:

- Keep domain and application exceptions in `src/app/Exceptions/**`.
- Keep HTTP transport exception mapping in `src/app/Http/Exceptions/**`.
- Select one canonical source for each HTTP exception class.
- Convert non-canonical duplicates to mapping or re-export only.
- Ensure controllers and services throw by correct layer and map at HTTP boundary.

Implementation checklist (owners and estimated hours):

- [ ] Build exception class inventory and identify duplicates by name and behavior. Owner: Backend Architect. Est: 2h.
- [ ] Approve canonical source per HTTP exception type. Owner: Backend Architect. Est: 2h.
- [ ] Refactor non-canonical duplicates into re-export or mapper modules only. Owner: API Engineer. Est: 4h.
- [ ] Update controller and service imports to canonical sources. Owner: API Engineer. Est: 4h.
- [ ] Validate HTTP error mapping remains consistent across endpoints. Owner: QA Engineer. Est: 4h.
- [ ] Add status-code snapshot tests for common failure paths. Owner: QA Engineer. Est: 4h.

Deliverable:

- Layered exception model preserved without duplicated class code.

## 12. Workstream F Business Logic Ownership

Goal: remove duplicate logic paths between Actions and Services.

Tasks:

- For each domain capability, choose one owner pattern.
- Owner pattern A: Action owns use case and Service is shared helper.
- Owner pattern B: Service owns use case and Action is adaptor or removed.
- Apply ownership decision first to Auth and Debt status transitions.
- Remove dead or duplicate flow after ownership decision is finalized.

Implementation checklist (owners and estimated hours):

- [ ] Create ownership matrix for Auth, Debt, Storage, Data, User, and System use cases. Owner: Backend Architect. Est: 4h.
- [ ] Mark each use case as Owner pattern A or B with rationale. Owner: Backend Architect. Est: 3h.
- [ ] Refactor Auth module to one runtime owner path per use case. Owner: API Engineer. Est: 6h.
- [ ] Refactor Debt status flows to one runtime owner path per use case. Owner: API Engineer. Est: 7h.
- [ ] Remove dead code paths, dead registrations, and dead imports after consolidation. Owner: API Engineer. Est: 4h.
- [ ] Execute regression tests for auth, debt, and storage flows. Owner: QA Engineer. Est: 6h.

Deliverable:

- Single source of truth per use case.

## 13. Optional Track Remove Actions

This is optional and not the default path.

If Actions are removed entirely, replacement chain is:

`Controller -> Feature Service -> Repository or Domain`

Replacement mapping:

- Auth Actions become methods in `AuthService`.
- Debt Actions become methods in `DebtCommandService`, `DebtQueryService`, `DebtStatusService`.
- Storage Actions become methods in `FileService` and storage moderation service.
- System Actions become methods in `PushService`, `JobsService`, `HealthService`, `EmailService`.

Trade-off summary:

- Pros: fewer classes and fewer DI bindings.
- Cons: larger service files, weaker use-case isolation, higher merge conflict risk.

## 14. Plugin Fallback Option

Default is to keep split plugin locations.

Fallback is allowed only if complexity becomes unmanageable and is explicitly approved:

- Merge plugin locations into one plugin package.
- Enforce internal naming partition:
- `RepositoryPlugin*`
- `FrameworkPlugin*`
- Add strict lint boundaries to keep behavior separation.

## 15. Execution Order

Execution order:

- Workstream A plugin boundaries.
- Workstream B DI modernization.
- Workstream C controller de-bloat.
- Workstream D request layer adoption.
- Workstream E exception de-dup.
- Workstream F business ownership cleanup.
- Optional Action removal track only after stabilization and explicit approval.

## 16. Sprint Plan

Sprint 1:

- Complete Workstream A.
- Complete Workstream B.
- Start Workstream C for Auth and Debt.

Sprint 2:

- Finish Workstream C for Storage, Data, User, Bank.
- Complete Workstream D.

Sprint 3:

- Complete Workstream E.
- Complete Workstream F.
- Hold architecture checkpoint for optional Action removal.

## 17. Verification Checklist

Validation steps:

- Typecheck: `bun run check-types`
- Lint: `bun run lint`
- Tests: `bun test`
- Controller DI audit confirms max 4 injections per controller.
- DI registration audit confirms <= 25 manual registrations.
- Request contract audit confirms controllers consume request DTO exports for covered routes.

## 18. Risk Register

Known risks and mitigation:

- DI discovery misconfiguration can break runtime resolution.
- Mitigation: startup container validation and smoke routes.
- Request DTO migration can alter validation behavior.
- Mitigation: contract snapshots before and after migration.
- Exception source consolidation can break mapping semantics.
- Mitigation: endpoint status-code snapshot tests.
- Orchestrator introduction can hide flow without documentation.
- Mitigation: module readme and unit tests for orchestrator methods.

## 19. Completion Artifacts

Expected outputs:

- Updated architecture docs and plugin README.
- Simplified `AppServiceProvider`.
- Module orchestrator classes.
- Controllers wired through `app/Http/Requests`.
- Canonicalized exception sources.
- Before and after metrics report for DI and constructor complexity.
