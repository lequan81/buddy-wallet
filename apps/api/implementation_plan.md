# Implementation Plan: Full-Stack Architecture Modernization

This plan outlines the step-by-step execution to resolve the technical debt identified in the audit. We will tackle this systematically, starting with the most critical issue: **End-to-End Type Safety**.

---

## Phase 1: End-to-End Type Safety (Focus for This Iteration)

The primary goal of Phase 1 is to eliminate the `new Response()` anti-pattern in the backend, which breaks Eden Treaty type inference and forces the frontend to use `api-envelope.ts` and `as any` casts.

### 1.1 Backend: Refactor `commons/http/response.ts`
We will replace the custom `apiError` and `apiSuccess` functions.
- **[MODIFY]** `apps/api/src/commons/http/response.ts`
  - Remove `new Response(...)` logic.
  - Create a new utility or simply recommend using Elysia's native `error(status, payload)`.
  - For success payloads that need a 201/202, we will use Elysia's `Context.set.status` combined with a raw object return.

### 1.2 Backend: Migrate All Handlers
We will systematically update all handlers across modules to use the new pattern.
- **[MODIFY]** `apps/api/src/modules/*/handlers/*.ts` (e.g., `debts`, `auth`, `user`, etc.)
  - Replace `return apiError(...)` with `return error(statusCode, payload)`.
  - Replace `return apiSuccess(data)` with `return data`.
  - Replace `return apiCreated(data)` with `set.status = 201; return data;`.

### 1.3 Backend: Fix Public Route Grouping
- **[MODIFY]** `apps/api/src/modules/system/routes.ts`
  - Group the `/check-debt` route under a `.group('/public', ...)` namespace to fix the Eden Treaty bracket-notation issue.

### 1.4 Frontend: Eliminate Envelope Parsers
Because Eden Treaty will now natively infer `{ data, error }` as a Discriminated Union, we can remove the complex parser logic.
- **[DELETE]** `apps/web/src/lib/services/api-envelope.ts`
- **[MODIFY]** `apps/web/src/lib/remotes/*.ts` (e.g., `auth.remote.ts`, `debts.remote.ts`)
  - Remove imports of `extractApiData` and `extractApiErrorMessage`.
  - Consume `data` and `error` directly from Treaty responses.
  - Remove the `(api as any)['check-debt']` cast and replace it with `api.public['check-debt']`.

---

## Future Phases (Preview)

Once Phase 1 is complete and type safety is restored end-to-end, we will proceed to:

### Phase 2: DTOs & Defense-in-Depth
- Refactor backend `handler.types.d.ts` to use DRY TS Utility types (`Partial`, `Pick`).
- Inject Valibot `safeParse` into Repository `update` methods for runtime validation.

### Phase 3: Frontend Modernization
- Refactor `debts/create/+page.server.ts` to use Svelte 5 `$state` instead of `searchParams`.
- Extract duplicated cookie extraction loops from `auth.remote.ts`.
- Split `DebtsTable.svelte` (570+ lines) into smaller, manageable components.

### Phase 4: Business Logic Completion
- Implement the actual file parsing and Redis Queue dispatching inside `apps/api/src/modules/data/handlers/data.handler.ts`.

---

## User Review Required

> [!IMPORTANT]  
> Modifying the API response shape (removing the explicit `{ success: true, data: ... }` envelope) is a breaking change for the frontend. The frontend remotes *must* be updated simultaneously to prevent the UI from breaking. 
> 
> Are you ready to approve this plan so I can begin executing Phase 1?
