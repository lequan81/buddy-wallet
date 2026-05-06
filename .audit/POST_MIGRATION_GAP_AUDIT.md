# Post-Migration Gap Audit

**Date:** May 3, 2026  
**Scope:** Issues found after manual migration completion  
**Status:** 🔴 ACTION REQUIRED

---

## Executive Summary

After systematic codebase scan, **5 critical gaps** were identified in completed migrations:

| # | Issue | Severity | Files Affected |
|---|-------|----------|--------------|
| 1 | SafeUser → UserResponse incomplete | 🔴 High | 7+ files |
| 2 | ActivityAction missing 'import_preview' | 🔴 High | 1 type + 1 usage |
| 3 | TypeBox + Superforms runtime compatibility | 🟡 Medium | All form remotes |
| 4 | packages/errors tsconfig cache | 🟡 Low | 1 file |
| 5 | Unused parameter warning | 🟢 Low | 1 file |

---

## 1. SafeUser → UserResponse Migration Incomplete

### Problem

`SafeUser` was aliased to `UserResponse` in `packages/types/src/core/user.d.ts`, but **imports still reference `SafeUser`** across service layer and API handlers.

### Files Still Using `SafeUser`

| File | Lines | Current Code |
|------|-------|--------------|
| `packages/types/src/services/debt.service.d.ts` | 2, 9, 10 | `import type { SafeUser }` |
| `packages/types/src/services/auth.service.d.ts` | 2, 28 | `user?: SafeUser` in `AuthResultData` |
| `packages/types/src/services/user.service.d.ts` | 2, 8 | `PaginatedResult<SafeUser>` |
| `packages/types/src/services/session.service.d.ts` | 2, 7 | `user: SafeUser` in `RefreshSessionData` |
| `apps/api/src/modules/auth/plugins/actor.plugin.ts` | Multiple | Various usages |
| `apps/api/src/modules/user/handlers/admin.handler.ts` | Multiple | Various usages |
| `apps/api/src/modules/auth/handlers/login.handler.ts` | 2 | Usage in response |
| `apps/api/src/modules/auth/handlers/register.handler.ts` | 2 | Usage in response |
| `apps/web/src/routes/(admin)/admin/users/+page.server.ts` | 3 | Import from `@repo/types` |

### Root Cause

Alias pattern provides backward compatibility but perpetuates old naming:
```typescript
// packages/types/src/core/user.d.ts
/** @deprecated Use UserResponse instead */
export type SafeUser = UserResponse;
```

Services still import `SafeUser` instead of `UserResponse`.

### Fix Required

**Step 1:** Update all service imports
```typescript
// BEFORE
import type { SafeUser } from '../core/user';

// AFTER  
import type { UserResponse } from '../core/user';
```

**Step 2:** Update all usages
```typescript
// BEFORE
export interface AuthResultData {
  user?: SafeUser;
}

// AFTER
export interface AuthResultData {
  user?: UserResponse;
}
```

**Step 3:** Remove `SafeUser` alias after full migration

---

## 2. ActivityAction Missing 'import_preview'

### Problem

The `ActivityAction` type union in `packages/types/src/core/activity.d.ts` doesn't include `'import_preview'`, but it's used at:
- `apps/api/src/modules/data/handlers/preview.handler.ts:117`

### Current State

```typescript
// packages/types/src/core/activity.d.ts:1-32
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | ...
  | string;  // ← fallback allows any string, but explicit is better
```

### Usage Location

```typescript
// apps/api/src/modules/data/handlers/preview.handler.ts:115-121
logActivity({
  userId: user.id,
  action: 'import_preview',  // ❌ Not in explicit union
  resource: 'import',
  resourceId: previewId,
  metadata: { ... }
});
```

### Fix Required

```typescript
export type ActivityAction =
  | 'create'
  | 'update'
  | ...
  | 'import'           // existing
  | 'import_preview'   // ADD THIS
  | string;
```

---

## 3. TypeBox + SvelteKit Superforms Runtime Compatibility

### Problem

Raw TypeBox schemas are being passed to `superValidate()` and `form()` without `toStandardSchema()` wrapper.

### Affected Files

| File | Line | Code |
|------|------|------|
| `apps/web/src/routes/(auth)/signup/+page.server.ts` | 8, 17 | `superValidate(registerRequestSchema)` |
| `apps/web/src/routes/(auth)/signup/+page.svelte` | 19 | `superForm<Infer<typeof registerRequestSchema>>` |
| `apps/web/src/lib/remotes/profile.remote.ts` | 5 | `form(profileSchema, ...)` |
| `apps/web/src/lib/remotes/auth.remote.ts` | 5 | `form(loginSchema, ...)` |
| `apps/web/src/lib/remotes/security.remote.ts` | 9, 26 | `form(Type.Object(...), ...)` |
| `apps/web/src/lib/remotes/banks.remote.ts` | 8, 42, 77 | `form(Type.Object(...), ...)` |

### The Issue

SvelteKit Superforms 2.x requires **Standard Schema** interface:
```typescript
{
  '~standard': {
    version: 1,
    vendor: string,
    validate: (value) => { value } | { issues }
  }
}
```

TypeBox doesn't natively implement this. You created `toStandardSchema()` adapter at:
- `packages/schema/src/adapters/standard-schema.ts`

But it's **not being used anywhere**.

### Potential Runtime Failure

```typescript
// Current code (may fail silently or with cryptic errors)
import { registerRequestSchema } from '@repo/schema/dto/auth';
const form = await superValidate(registerRequestSchema);  // ❌ No standard schema wrapper

// Should be:
import { registerRequestSchema, toStandardSchema } from '@repo/schema/dto/auth';
const form = await superValidate(toStandardSchema(registerRequestSchema));  // ✅
```

### Verification Steps

1. Run signup form with validation errors
2. Check browser console for `validate is not a function`
3. Check if server-side validation works

### Fix Options

**Option A:** Wrap all schema usages (explicit)
```typescript
const form = await superValidate(toStandardSchema(registerRequestSchema));
```

**Option B:** Re-export wrapped schemas from schema package (recommended)
```typescript
// packages/schema/src/dto/auth/register.schema.ts
export const registerRequestSchema = Type.Object({...});
export const RegisterStandardSchema = toStandardSchema(registerRequestSchema);
```

**Option C:** Create adapter wrapper for superforms
```typescript
// sveltekit-superforms adapter for TypeBox
import { typebox } from '@repo/schema/adapters/superforms';
const form = await superValidate(typebox(registerRequestSchema));
```

---

## 4. packages/errors tsconfig.json Cache Issue

### Problem

IDE shows error:
```
No inputs were found in config file...
Specified 'include' paths were '["index.ts"]'
```

But file shows:
```json
"include": ["src/**/*.ts"]
```

### Root Cause

TypeScript language server hasn't picked up file change. The cache still references old `"index.ts"` path before file was moved to `src/`.

### Fix

**Immediate:** Reload VS Code window or restart TypeScript server

**Verification:** Error should disappear after reload.

---

## 5. Unused Parameter Warning

### Problem

```typescript
// packages/errors/src/hierarchy.ts:25
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {  // ⚠️ 'field' defined but never used
    super(message, 'VALIDATION_ERROR', 400);
  }
}
```

### Fix

Prefix with underscore to indicate intentional unused:
```typescript
constructor(message: string, _field?: string) {
  super(message, 'VALIDATION_ERROR', 400);
}
```

---

## Migration Completion Checklist

### Completed ✅
- [x] Valibot → TypeBox in `packages/schema`
- [x] `drizzle-valibot` removed from `packages/db`
- [x] `@repo/validation` → `@repo/schema` (no references found)
- [x] `randomUUID()` → `randomUUIDv7()`
- [x] `owed`/`owing` → `LEND`/`BORROW`
- [x] SSE → XHR polling
- [x] Result types using generic `Result<T>`
- [x] Generic `IdParams`, `ListQuery` patterns
- [x] `Bank<T>` generic consolidation
- [x] `SHARED_CONSTANTS` with `satisfies`
- [x] `packages/errors/src/` structure
- [x] Workflow states unified (`ImportState`, `JobState`)

### Incomplete 🔴
- [ ] SafeUser → UserResponse (7+ files still use old name)
- [ ] ActivityAction missing 'import_preview'
- [ ] TypeBox + Superforms runtime verification needed

### Cosmetic 🟡
- [ ] packages/errors tsconfig cache reload
- [ ] Unused `_field` parameter prefix

---

## Recommended Action Order

1. **Fix SafeUser imports** (type-only change, safe)
2. **Add 'import_preview' to ActivityAction** (type-only change, safe)
3. **Restart TS server** for errors package
4. **Verify Superforms runtime** (test signup form validation)
5. **Implement Standard Schema wrapper** if needed
6. **Fix unused parameter** warning

---

**End of Audit**
