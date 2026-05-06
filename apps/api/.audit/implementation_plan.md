# Architecture & UX Flow Audit

This document contains a comprehensive grading of the current ElysiaJS architecture, identification of legacy leftovers and naming violations, and a critical analysis of the UX/Business flows.

## 1. Architecture Grading (ElysiaJS & SOLID)

**Overall Grade: A-**

The transition to ElysiaJS functional programming principles is well-designed. The architecture heavily embraces composition, pure functions, and schema-first validation.

**Strengths (S-O-D Alignment):**
- **Single Responsibility (SRP):** The division of modules into `schema.ts`, `handlers/`, `services/`, and `routes.ts` perfectly isolates validation, HTTP glue code, and business logic.
- **Open/Closed Principle (OCP):** Elysia's `app.use()` and plugin architecture allow extending the application without modifying existing core code.
- **Dependency Inversion (DIP):** Passing dependencies like the database instance directly to repositories and avoiding massive IoC containers reduces overhead while preserving testability.

**Architectural Quirks & Duplications:**
- **Route Registration Duplication:** There are currently two parallel routing paradigms in the new structure:
  1. `src/modules/debts/index.ts` exposes a module barrel `debtsModule.use(debtRoutes)`.
  2. `src/routes/api.ts` registers routes using `debtController.register(new Elysia())` which imports from `modules/debts/routes/debt.routes.ts`.
  *Fix:* Unify these. The `src/routes/api.ts` should simply mount the module barrel files (e.g., `.use(authModule)`), and the `controller.register` classes can be removed to be fully functional.

## 2. Legacy Leftovers & Naming Violations

The codebase contains a significant amount of legacy OOP code and PascalCase files that violate the "kebab-case only" architecture rule.

**Legacy Directories (To Be Deleted):**
- `src/app/`: The entire Laravel-style directory (`Controllers`, `Exceptions`, `Http`, `Models`, `Providers`, `Repositories`, `Services`) is obsolete.
- `src/lib/`: Contains legacy DI (`di/`), HTTP helpers (`http/`), security wrappers, and OOP mappers.
- `src/types/`: Contains redundant interfaces (e.g., `services/` interfaces for OOP classes) that are no longer needed in FP.

**PascalCase Naming Violations:**
Even within the new architecture directories, there are several `PascalCase` files that need to be renamed to `kebab-case`:
- `src/commons/authorization/AccessControlPlugin.ts` -> `access-control.plugin.ts`
- `src/commons/authorization/EmailVerifiedPlugin.ts` -> `email-verified.plugin.ts`
- `src/commons/authorization/PermissionPlugin.ts` -> `permission.plugin.ts`
- `src/commons/http/CorsMiddleware.ts` -> `cors.middleware.ts`
- `src/commons/http/CsrfMiddleware.ts` -> `csrf.middleware.ts`
- `src/commons/http/SecurityHeadersMiddleware.ts` -> `security-headers.middleware.ts`
- `src/commons/http/Logging/RequestLoggerMiddleware.ts` -> `logging/request-logger.middleware.ts`
- `src/commons/http/RateLimiting/RateLimitMiddleware.ts` -> `rate-limiting/rate-limit.middleware.ts`
- `src/providers/redis/Cache.ts`, `CircuitBreaker.ts`, `Connection.ts`, `RedisPlugin.ts`
- `src/modules/auth/plugins/ActorPlugin.ts`, `JwtPlugin.ts`, `SessionAuthPlugin.ts`

## 3. UX Business Flow Logic & Quirks

**Overall Grade: B+**

The business logic is solid, but there are several critical edge cases and potential deadlocks in the UX flow.

> [!CAUTION]
> **Critical Flaw: Phone-Only Password Reset Lockout**
> The UX Flow allows users to register using **only** a phone number (Scenario 1). However, the Forgot Password flow strictly relies on sending an OTP to an email. If a phone-only user forgets their password, they have no way to reset it.
> *Fix:* Force email collection during registration.

> [!WARNING]
> **UX Issue: Password Change Invalidates Current Session**
> When a user changes their password, incrementing the session version invalidates *all* sessions, including the one they just used to change the password. The user gets immediately booted out and forced to log in again.
> *Fix:* Issue a new fresh JWT for the current session automatically upon password change, while invalidating all other devices.

> [!WARNING]
> **Business Deadlock: 10 Pending Debts Limit**
> Users are limited to 10 unconfirmed debts. If a user creates debts for a counterparty who never installs the app or never confirms, the creator permanently loses their quota. 
> *Fix:* Removed the limited quotas 10 unconfirmed debts for all users. All users have free will to create as many as needed unconfirmed debts amount.

> [!NOTE]
> **Quirk: Discarding Default Bank Accounts**
> When a user adds their first bank account, it becomes default. If they delete their default account, does the system automatically fallback to another account, or do they now have 0 default accounts? This edge case is underspecified.

> [!NOTE]
> **Quirk: Synchronous Push Notification Broadcasts**
> Broadcasting to all users in chunks of 100 via an API request will eventually hit timeout limits as the user base grows. 
> *Fix:* Broadcasts should spawn a background job (e.g., Redis custom queue) rather than blocking the HTTP request.

## Proposed Cleanup Plan

If approved, I will proceed with the following actions:

1. **Unify Routing Paradigm**: Refactor `src/routes/api.ts` to consume `*Module` barrel files from `src/modules/` instead of legacy `*Controller.register` pattern. Delete redundant `*.routes.ts` controller files.
2. **Rename PascalCase Files**: Rename all plugins, middlewares, and providers in `commons/`, `modules/`, and `providers/` to strictly follow `kebab-case.ts`.
3. **Delete Legacy Code**: Remove `src/app/`, `src/lib/`, and legacy `src/types/` entirely.
