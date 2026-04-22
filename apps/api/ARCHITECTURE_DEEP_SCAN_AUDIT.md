# Backend Architecture Deep Scan Audit

Based on the `ARCHITECTURE_REDESIGN_PLAN.md` and a deep scan of `apps/api/src/`, here is the detailed audit covering missing items, mismatches, inline code content, and business logic flow checks for the new Laravel/Spring-inspired architecture.

## 1. Architectural Mismatches

The codebase has largely adopted the intended structure (`app/`, `lib/`, `routes/`, `config/`), but there are notable deviations from the original plan:

| Planned Structure | Actual Implementation | Audit Notes |
| :--- | :--- | :--- |
| `app/Http/Middlewares/` | `app/Http/Plugins/` still exists | The plan intended to migrate Elysia plugins to Middlewares. However, the `Plugins` directory remains in `app/Http/`, suggesting an incomplete migration or a hybrid approach. |
| `app/Exceptions/` root folder | Mixed Exception paths | Exceptions exist both in `app/Exceptions/` and `app/Http/Exceptions/`. This splits domain exceptions from HTTP exceptions, which wasn't in the plan but might be intentional. |
| `app/Repositories/Contracts/` | `src/types/repositories/*.repo.d.ts` | The plan called for Laravel-style interface contracts inside the `Repositories/Contracts` folder. In reality, these interfaces are scattered into `src/types/repositories/`. This decouples TypeScript declarations from the application folder structure. |
| Single `DebtService.ts` | CQRS Segregation (`DebtCommandService.ts`, `DebtQueryService.ts`, `DebtStatusService.ts`) | The business logic was split using Command-Query segregation instead of a monolithic service. This is a **positive evolution** for maintainability, though it differs from the simplified plan. |
| `lib/mappers/` | `app/Http/Mappers/` | The redesign plan mentioned `lib/mappers/` in the initial tree but then clarified in section 4.5 to use `app/Http/Mappers/`. This is actually matching the *revised* part of the plan. |

## 2. Missing Components

Several abstractions mapped out in the original plan are currently absent:
- **`RouteServiceProvider.ts`**: Not implemented. Controllers register their routes directly or via `routes/api.ts` without a dedicated DI provider managing the route lifecycle.
- **`lib/db/circuit-breaker.ts`**: Missing. While `@Retryable` and other decorators exist, standalone circuit breaker utilities for the database layer are not present.

## 3. "Inline" Code & Schema Definitions (The Validation Gap)

A major goal of the monorepo architecture was sharing validation schemas between the frontend and backend using `@repo/validation` or `@repo/schemas`. **This has not been fully realized.**

The backend is still heavily defining its Valibot schemas inline inside `app/Http/Requests/`:

- **🛑 `DebtRequest.ts`**: Defines `CreateDebtRequest`, `UpdateDebtStatusRequest`, `DebtQueryRequest`, and `SuggestDebtEditRequest` entirely inline. These schemas should live in the shared workspace to ensure the UI enforces the exact same rules (`minAmount`, `currency` length) as the backend.
- **⚠️ `AuthRequest.ts`**: Partially migrated. It imports `loginSchema` and `signupSchema` from `@repo/validation`, but defines `VerifyOTPRequest`, `ResendOTPRequest`, and intersects `LoginRequest` (with `rememberMe`) entirely inline.
- **🛑 Other Requests (`ImportRequest.ts`, `StorageRequest.ts`, `UserRequest.ts`)**: Based on file sizes and imports, these files also heavily rely on inline Valibot schemas rather than pulling from the centralized `@repo/validation` package.

**Impact:** The frontend forms cannot reliably reuse these inline rules, leading to duplicated validation logic and potential UX desyncs if the API updates but the UI doesn't.

## 4. UX Flow & Business Logic Review

From a high-level system view, the business flow logic executes as follows:
`Elysia Router -> Request Validation (inline) -> DI Controller -> Service -> Repository (Drizzle) -> DB`

### Observations on UX / Business Flow:
1. **CQRS Efficacy**: The separation of `DebtCommandService` (mutations) and `DebtQueryService` (reads) makes the UX flow for state updates highly robust. Complex status transitions have their own `DebtStatusService`. This prevents monolithic files and makes business rules easier to trace.
2. **Missing Shared Types in UX**: Because Valibot schemas are inline, any UX form prompting user input (e.g. creating a Debt) relies on duplicated rules on the client. If `minAmount` changes in `DebtRequest.ts`, the frontend form won't know unless manually synced. Migrating these to `@repo/validation` is critical for a smooth and cohesive UX.
3. **DI Event Bus Verification**: The `@OnEvent` decorator pattern and `EventServiceProvider` are successfully implemented in `AppServiceProvider.ts`. This effectively allows asynchronous UX flows (like sending notifications `NotificationService` or logging activity `ActivityService`) to run in the background without blocking the user's HTTP request, making the UX fast and responsive.

## 5. Summary & Action Items

To fully realize the `ARCHITECTURE_REDESIGN_PLAN.md`:
1. **Refactor Requests**: Extract all inline Valibot schemas from `app/Http/Requests/*.ts` into `packages/validation/src/`.
2. **Consolidate Interfaces**: Move `src/types/repositories/*.d.ts` to `app/Repositories/Contracts/` to align with the pure OOP/Laravel contract pattern mapped out in the plan.
3. **Clean Up App Directory**: Decide if `app/Http/Plugins/` should be refactored fully into `app/Http/Middlewares/` to maintain the planned structure, and consolidate the exception folders (`app/Exceptions/` vs `app/Http/Exceptions/`).
