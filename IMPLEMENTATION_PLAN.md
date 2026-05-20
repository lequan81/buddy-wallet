# Implementation Plan — Phase 2: Strong Typing, Type Architecture, & Commons Cleanup

This plan finalizes the monorepo refactoring for `buddy-wallet`. It addresses four pillars:

1. **Strong Typing** — Purge every `any` from debt services
2. **Type Architecture Fix** — Move interfaces out of handler/service files into `types/` dirs
3. **Commons Reorganization** — Relocate used utilities, delete dead files
4. **Magic Number Cleanup** — Replace raw constants with `SHARED_CONSTANTS`

---

## User Review Required

> [!IMPORTANT]
> **Structural change**: Interfaces currently exported from `*.handler.ts` and `*.service.ts` and `*.ts` from `apps/api/src/commons` files will be moved into each module's `types/` directory. This is a **non-breaking, import-path-only** change — no runtime behavior changes. All consumers will be updated atomically.

> [!WARNING]
> **Duplicate `PushPayload`**: The interface `PushPayload` is defined in *two* places:
>
> - `modules/notification/services/push.service.ts` (line 14)
> - `modules/notification/types/push.ts` (line 16)
>
> The service copy will be deleted and the service will import from `types/push.ts`. Please confirm this is acceptable.

---

## Open Questions

> [!NOTE]
> **`ServiceResult<T>` placement**: Currently lives in `debt.service.ts` (the barrel file). Since it's a shared service type used by all 8 debt micro-services, the plan moves it to `modules/debts/types/index.ts`. An alternative would be placing it in `src/types/` as a project-wide utility type if other modules also need it in the future. Currently only debts use it — keeping it module-scoped seems correct. Please confirm.

---

## Proposed Changes

### Pillar 1: Strong Typing in Debt Services

All 8 debt service files use `user: any` and `Promise<ServiceResult<any>>`. The fix is mechanical: import `AuthenticatedUser` from `@/types/handler-context` and `Debt` from `@repo/db`, then narrow the generics.

---

#### [MODIFY] [cancel-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/cancel-debt.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt | null>>`

#### [MODIFY] [complete-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/complete-debt.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt | null>>`

#### [MODIFY] [confirm-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/confirm-debt.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `txDb: any` → `txDb: DbClient`
- `(tx: any)` → `(tx: DbClient)`
- `const updateData: any` → `const updateData: Partial<Debt> & { updatedAt: Date }`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt>>`

#### [MODIFY] [create-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/create-debt.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt & { duplicateWarning?: { count: number; message: string } }>>`

#### [MODIFY] [suggest-edit.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/suggest-edit.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt | null>>`

#### [MODIFY] [respond-suggestion.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/respond-suggestion.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `const updateData: any` → `const updateData: Partial<Debt> & { updatedAt: Date }`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt | null>>`

#### [MODIFY] [update-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/update-debt.service.ts)

- `user: any` → `user: AuthenticatedUser`
- `Promise<ServiceResult<any>>` → `Promise<ServiceResult<Debt | null>>`

#### [MODIFY] [remove-debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/remove-debt.service.ts)

- All 3 functions: `user: any` → `user: AuthenticatedUser`
- `removeDebt` → `Promise<ServiceResult<{ deleted: boolean }>>`
- `batchRemoveDebts` → `Promise<ServiceResult<{ deleted: string[]; notFound: string[] }>>`
- `removeAllDebts` → `Promise<ServiceResult<{ deleted: number }>>`

---

### Pillar 2: Type Architecture — Move Interfaces to `types/` Directories

The codebase has a clear convention: each module has a `types/` directory for interfaces/type aliases (e.g., `debts/types/handler.types.d.ts`, `auth/types/handler.types.d.ts`). Several files violate this by exporting interfaces inline:

| File | Interface(s) | Problem |
|------|-------------|---------|
| `data/handlers/preview.handler.ts` | `ImportPreviewData` | Handler exports a domain data shape |
| `data/services/import-preview.service.ts` | `ParsedSpreadsheet`, `PreviewResult`, `ValidationResult`, `ColumnMapping`, `ParseResult` | Service exports 5 domain types |
| `notification/services/push.service.ts` | `PushPayload` | Duplicate of `notification/types/push.ts` |
| `auth/services/email.service.ts` | `EmailMessage`, `SendResult` | Service exports infra types |
| `debts/services/debt.service.ts` | `ServiceResult<T>` | Barrel file exports utility type |
| `debts/handlers/remove-all.handler.ts` | `RemoveAllDebtContext` | Handler exports context type |
| `debts/handlers/batch-remove.handler.ts` | `BatchRemoveDebtContext` | Handler exports context type |

**Why this matters**: Handlers and services are implementation layers. When they export interfaces, any consumer that needs just the *type* must import from the implementation file, creating tight coupling and circular dependency risk. The `types/` directory is the canonical place for all type definitions.

---

#### [MODIFY] [data/types/handler.types.d.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/types/handler.types.d.ts)

- Add `ImportPreviewData` interface (moved from `preview.handler.ts`)
- Add `ParsedSpreadsheet`, `PreviewResult`, `ValidationResult`, `ColumnMapping`, `ParseResult` (moved from `import-preview.service.ts`)

#### [MODIFY] [data/handlers/preview.handler.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/preview.handler.ts)

- Remove `export interface ImportPreviewData { ... }` block
- Add `import type { ImportPreviewData } from '../types/handler.types';`

#### [MODIFY] [data/services/import-preview.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/services/import-preview.service.ts)

- Remove all 5 interface/type exports (`ParsedSpreadsheet`, `PreviewResult`, `ValidationResult`, `ColumnMapping`, `ParseResult`)
- Add `import type { ... } from '../types/handler.types';`

#### [MODIFY] [notification/services/push.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/notification/services/push.service.ts)

- Remove duplicate `export interface PushPayload { ... }` (lines 14-19)
- Add `import type { PushPayload } from '../types/push';`

#### [MODIFY] [auth/types/handler.types.d.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/types/handler.types.d.ts)

- Add `EmailMessage` and `SendResult` interfaces (moved from `email.service.ts`)

#### [MODIFY] [auth/services/email.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/email.service.ts)

- Remove `export interface EmailMessage { ... }` and `export interface SendResult { ... }` blocks
- Add `import type { EmailMessage, SendResult } from '../types/handler.types';`

#### [MODIFY] [debts/types/index.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/types/index.ts)

- Add `ServiceResult<T>` type (moved from `debt.service.ts`)

#### [MODIFY] [debts/services/debt.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/debt.service.ts)

- Remove `export type ServiceResult<T> = ...` (line 8)
- Remove `import type { ErrorLike } from '@/commons/http/response';`
- Re-export `ServiceResult` from types: `export type { ServiceResult } from '../types';`
- All 8 micro-service imports of `ServiceResult` from `./debt.service` continue to work via the barrel

#### [MODIFY] [debts/handlers/remove-all.handler.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/handlers/remove-all.handler.ts)

- Move `export type RemoveAllDebtContext` to `debts/types/handler.types.d.ts`
- Import from `'../types/handler.types'`

#### [MODIFY] [debts/handlers/batch-remove.handler.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/handlers/batch-remove.handler.ts)

- Move `export type BatchRemoveDebtContext` to `debts/types/handler.types.d.ts`
- Import from `'../types/handler.types'`

#### [MODIFY] [debts/types/handler.types.d.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/types/handler.types.d.ts)

- Add `BatchRemoveDebtContext` and `RemoveAllDebtContext` type aliases

---

### Pillar 3: Commons Reorganization

#### [NEW] [commons/http/pagination.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/http/pagination.ts)

- Relocate `calculatePagination` from `commons/pagination.ts`

#### [NEW] [commons/logging/activity-logger.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/logging/activity-logger.ts)

- Relocate from `commons/activity-logger.ts`

#### [DELETE] Dead utility files (confirmed 0 imports across entire workspace)

- `commons/array.ts`
- `commons/date.ts`
- `commons/debt.ts`
- `commons/number.ts`
- `commons/result.ts`
- `commons/string.ts`
- `commons/index.ts`
- `commons/pagination.ts` (after relocation)
- `commons/activity-logger.ts` (after relocation)

#### [MODIFY] Import path updates across all consumer files

- **`@/commons/pagination`** → **`@/commons/http/pagination`** in:
  - `modules/user/handlers/admin.handler.ts`
  - `modules/storage/handlers/storage.handler.ts`
  - `modules/notification/handlers/notification.handler.ts`
  - `modules/debts/handlers/list.handler.ts`
  - `modules/data/handlers/import.handler.ts`
  - `modules/bank/handlers/bank.handler.ts`
  - `modules/activity/handlers/activity.handler.ts`
  - `tests/pagination.middleware.test.ts`

- **`@/commons/activity-logger`** → **`@/commons/logging/activity-logger`** in:
  - All 8 debt service files
  - `modules/storage/handlers/storage.handler.ts`
  - `modules/storage/handlers/proof.handler.ts`
  - `modules/data/handlers/preview.handler.ts`
  - `modules/data/handlers/import.handler.ts`

---

### Pillar 4: Magic Number Cleanup

#### [MODIFY] [validation.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/validation.service.ts)

- Replace `amount <= 0` → `amount < SHARED_CONSTANTS.DEBT.MIN_AMOUNT`
- Replace `amount > 999999999999` → `amount > SHARED_CONSTANTS.DEBT.MAX_AMOUNT`
- Add `import { SHARED_CONSTANTS } from '@repo/config';`

---

## Verification Plan

### Automated Tests

Run full monorepo typecheck and test suite:

```powershell
bun check-types
```

```powershell
bun test
```

### Manual Verification

- Confirm no `export interface` or `export type` remaining in any `*.handler.ts` or `*.service.ts` file (except barrel re-exports)
- Confirm zero `any` remaining in `modules/debts/services/`
- Confirm zero imports from dead files (`commons/array.ts`, `commons/date.ts`, etc.)
