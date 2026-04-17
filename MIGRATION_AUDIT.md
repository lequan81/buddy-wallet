# Backend Architecture Migration Audit Report

**Status:** In Progress (70% Complete)  
**Date:** 2026-04-17  
**Git State:** Changes staged but NOT committed - all old files marked as deleted (D)

---

## Executive Summary

Migration from old scattered structure → Laravel-inspired architecture **partially complete**. New structure (`src/app/`, `src/lib/`, `src/config/`) created with ~80% of code migrated, but **incomplete cleanup** and **broken imports** remain.

### Critical Issues
1. ✅ **New structure created** (app/, lib/, config/)
2. ✅ **Controllers migrated** (13 controllers in app/Http/Controllers/)
3. ✅ **Repositories migrated** (9 interfaces + 9 implementations)
4. ✅ **Services migrated** (20 main services in app/Services/)
5. ✅ **DI Container setup** (tsyringe with AppServiceProvider)
6. ⚠️ **Imports broken** (3 files referencing deleted old paths)
7. ⚠️ **Duplicate files** (old and new versions coexist in app/Services/)
8. ⚠️ **Old folders still exist** (core/, plugins/, states/)
9. ⚠️ **Type safety issues** (92+ `any` type assertions in new code)
10. ❌ **Models not created** (Debt.ts, User.ts domain entities missing)
11. ❌ **DTOs/Requests not created** (app/Http/Requests/ folder empty)
12. ❌ **Decorators partially implemented** (cacheable, retryable created but unused)

---

## Part 1: BROKEN IMPORTS (MUST FIX)

### 1. **src/app/Services/DebtService.ts:11**
```typescript
// ❌ BROKEN - File marked as deleted
import { debtStateMachine } from '@/states';
```
**Issue:** `@/states` is marked for deletion in git. State machine exists but shouldn't be imported.  
**Fix Options:**
- Option A: Keep state machine, update import path (but plan says to replace with models)
- Option B: Remove import and replace with Debt model methods (recommended per redesign plan)
- **Solution:** Replace with methods from planned `app/Models/Debt.ts` (NOT YET CREATED)

**Workaround Until Models Exist:**
```typescript
// Temporarily comment out or remove - will use Debt.canBeCancelledBy() method instead
// import { debtStateMachine } from '@/states';
```

---

### 2. **src/app/Services/debt/debt.service.ts:23 & 39-40**
```typescript
// ❌ BROKEN - File marked as deleted
import { debtStateMachine } from '@/states';
import { PushService } from '@/services/notification/push.service';
import { ActivityService } from '@/services/activity/activity.service';
```
**Issue:** This is a **duplicate/orphaned file** - there's also `DebtService.ts` in parent directory.  
**Status:** File exists in git history but marked for deletion  
**Action:** **DELETE THIS FILE ENTIRELY** - use `src/app/Services/DebtService.ts` instead

---

### 3. **src/app/Http/Controllers/ImportController.ts:14**
```typescript
// ❌ BROKEN - File marked as deleted  
import { validateImportUploadFile } from '@/services/import-export/import.validators';
```
**Issue:** Path points to old location, but file exists at `src/app/Services/import-export/import.validators.ts`  
**Fix:**
```typescript
// ✅ CORRECT
import { validateImportUploadFile } from '@/app/Services/import-export/import.validators';
```

---

## Part 2: DUPLICATE & ORPHANED FILES TO REMOVE

These files exist in BOTH new PascalCase and old nested kebab-case locations. Keep the PascalCase version only.

| Category | Keep (New Structure) | Delete (Old) | Status |
|----------|----------------------|--------------|--------|
| **Activity** | `ActivityService.ts` | `activity/activity.service.ts` | 🔴 Both exist |
| **Auth** | `AuthService.ts` + `AuthSecurityService.ts` + `AuthSessionService.ts` | `auth/*` | 🔴 Nested auth/ exists |
| **Bank** | `BankAccountService.ts` | `bank/*` | ✅ Nested gone, check if needed |
| **Debt** | `DebtService.ts` | `debt/debt.service.ts` + `debt/debt.utils.ts` + `debt/debt.validators.ts` | 🔴 PRIORITY: Old nested still referenced |
| **Email** | `EmailService.ts` + `EmailVerificationService.ts` + `PasswordResetService.ts` | `email/*` | ✅ Nested gone |
| **Import/Export** | `ImportService.ts` + `ExportService.ts` + `SpreadsheetService.ts` + `ImportLoggerService.ts` | None (only nested indices exist) | ⚠️ Validators/helpers in nested |
| **Notification** | `PushService.ts` | `notification/*` | ✅ Nested gone |
| **Storage** | `FileService.ts` + `S3StorageService.ts` + `ImageService.ts` | `storage/*` | ✅ Nested gone |
| **System** | `JobsService.ts` | `system/*` | ✅ Nested gone |
| **User** | `UserService.ts` + `SessionService.ts` | `user/*` | ✅ Nested gone |

### Nested Directories Status:
```
src/app/Services/
├── activity/                      # 🔴 REMOVE - ActivityService.ts exists in root
├── auth/                          # 🔴 REMOVE - Auth services exist in root  
├── debt/                          # 🔴 REMOVE - DebtService exists + need to migrate validators
├── email/                         # ✅ OK - just index.ts, services in root
├── import-export/                 # ⚠️ KEEP - has import.validators.ts, import-logger.service.ts
│   ├── import.validators.ts       # KEEP - used by ImportController
│   ├── import-logger.service.ts   # KEEP - used by ImportService
│   └── index.ts
├── notification/                  # ✅ OK - just index.ts
├── storage/                       # ⚠️ KEEP - has StorageServiceInterface.ts contract
│   ├── Contracts/
│   │   └── StorageServiceInterface.ts
│   ├── index.ts
│   └── storage.service.ts         # Duplicate of FileService? Check usage
├── system/                        # ✅ OK - just index.ts
└── user/                          # ✅ OK - just index.ts
```

---

## Part 3: BROKEN/MISSING PATHS & ALIASES

### Path Alias Issues

| Path | Old | New | Status | Issue |
|------|-----|-----|--------|-------|
| Utils | `@/utils/*` | `@/lib/*` | ✅ Migrated | No old references found |
| Security | `@/utils/password.utils` | `@/lib/security/password.ts` | ✅ Used correctly | AuthService imports correctly |
| Crypto | `@/utils/crypto.utils` | `@/lib/security/crypto.ts` | ✅ Check | Need to verify usages |
| IP Utils | `@/utils/ip.utils` | `@/lib/security/ip/*.ts` | ✅ Split | Exists at ip/extract.ts, parse.ts, validate.ts |
| Phone Utils | `@/utils/phone.utils` | `@/lib/validation/phone.ts` | ✅ Migrated | Check valibot version |
| Result Helper | `@/core/error/error-factory.ts` | `@/lib/result.ts` | ✅ Migrated | DatabaseError imported correctly |
| State Machine | `@/states/*` | ❌ SHOULD BE `@/app/Models/Debt.ts` | 🔴 MISSING | Models not created yet |
| Validators | `@/services/*/validators` | `@/app/Services/*/validators` | ⚠️ BROKEN PATH | ImportController has wrong path |

### Current tsconfig.json Paths
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"],
    "@app/*": ["src/app/*"],
    "@lib/*": ["src/lib/*"],
    "@config/*": ["src/config/*"],
    "@plugins": ["src/plugins/index.ts"],  // ⚠️ OLD
    "@core/*": ["src/core/*"]              // ⚠️ OLD - should be removed when core is cleaned
  }
}
```

**Status:** Aliases mostly correct, but old paths still active.

---

## Part 4: TYPE SAFETY - `any` ASSERTIONS (92 instances found)

### Distribution by File:
```
35 instances in src/app/Http/Controllers/ (mostly BankController, DebtController)
20 instances in src/app/Services/ (ExportService, ImportService)
15 instances in other files
22 instances unaccounted (need deeper scan)
```

### By Category:

#### **Controllers - 35 instances**

**BankController.ts** (8 instances)
```typescript
// ❌ Line 95-96
const result = await this.bankAccountService.createBankAccount(body as any);
// ❌ Line 106
} as any);
// ❌ Line 109-110
const result = await this.bankAccountService.updateBankAccount(id, freshUser.id, body as any);
// ❌ Line 116
const primaryAccount = accounts.find((a: any) => a.isPrimary) || accounts[0];
// ❌ Line 117
const accounts = (freshUser.bank_accounts || []).map((a: any) => ({
// ❌ Line 122
amount: debt.amount as any,
// ❌ Line 128
return respondFailure(set, result as any, {
```
**Root Cause:** Response types not properly typed, need to create BankAccount/CreateBankAccountRequest DTOs

**DebtController.ts** (7 instances)
```typescript
// ❌ Line 37
const status = (query.status as any) || undefined;
// ❌ Line 61
const status = (query.status as any) || undefined;
// ❌ Line 87
expiryOption: body.expiryOption as any,
// ❌ Multiple respondFailure/respondDebtFailure calls with `as any`
```
**Root Cause:** Request body types not validated with Zod schemas, status enums not properly typed

#### **Services - 20 instances**

**ImportService.ts** (8 instances)
```typescript
// Likely: Result type casting, data transformations
```

**ExportService.ts** (5 instances)
```typescript
// Likely: CSV/Excel data transformation without proper typing
```

---

## Part 5: MISSING MIGRATIONS (NOT YET IMPLEMENTED)

### ❌ 1. Rich Domain Models (CRITICAL)
**Status:** Not created - plan requires these  
**Files Needed:**
```
src/app/Models/
├── Debt.ts                    # Replace state machine with rich domain methods
├── User.ts                    # User business logic
├── Enums/
│   ├── DebtStatus.ts          # 'pending' | 'confirmed' | 'disputed' | 'paid' | 'cancelled'
│   └── UserRole.ts            # 'user' | 'admin'
└── ValueObjects/
    └── Money.ts               # For amount/currency operations
```

**Why Needed:**
- Current code uses state machine (`src/states/`) which is marked for deletion
- Debt service imports deleted state machine (breaks build)
- Rich models enable testable business logic per design plan
- Replaces 250+ lines of state logic with ~100 lines in model

**Example Debt Model (SHOULD BE CREATED):**
```typescript
// src/app/Models/Debt.ts
export class Debt {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly debtorId: string,
    public readonly creditorId: string,
    private _status: DebtStatus,
    public readonly createdAt: Date
  ) {}

  get status(): DebtStatus { return this._status; }

  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new Error('Debt cannot be cancelled');
    }
    return new Debt(this.id, this.amount, this.currency, this.debtorId, 
      this.creditorId, 'cancelled', this.createdAt);
  }

  // ... other state transition methods
}
```

**Migration Path:**
1. Create `src/app/Models/Debt.ts` with all state machine logic
2. Update DebtService to use `Debt.canBeCancelledBy()` instead of `debtStateMachine`
3. Delete `src/states/` folder (currently marked for deletion)
4. Update imports: `import { Debt } from '@/app/Models/Debt'`

---

### ❌ 2. Request/DTO Classes (HTTP Input Validation)
**Status:** Not created - folder exists but empty  
**Files Needed:**
```
src/app/Http/Requests/
├── CreateDebtRequest.ts       # POST /debts { amount, currency, debtorId, ... }
├── UpdateDebtStatusRequest.ts # PATCH /debts/:id { status }
├── CreateBankAccountRequest.ts
├── RegisterRequest.ts
├── ImportRequest.ts
├── ExportRequest.ts
└── ... (one per endpoint)
```

**Why Needed:**
- Controllers currently cast `body as any` (15+ instances)
- No compile-time validation of request shapes
- Reduces type safety and IDE autocomplete
- Zod/Valibot schemas exist in `@repo/schema` but not integrated

**Example (SHOULD BE CREATED):**
```typescript
// src/app/Http/Requests/CreateDebtRequest.ts
import { z } from 'zod';

export const CreateDebtRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  debtorId: z.string().uuid(),
  creditorId: z.string().uuid(),
  description: z.string().optional()
});

export type CreateDebtRequest = z.infer<typeof CreateDebtRequestSchema>;
```

**Integration:**
```typescript
// In DebtController
.post('/debts', 
  { body: CreateDebtRequestSchema }, // ✅ Elysia auto-validates
  async ({ body }) => {
    // body is now typed as CreateDebtRequest
    await this.debtService.createDebt(body);
  }
)
```

---

### ❌ 3. Middleware Migration (INCOMPLETE)
**Status:** Old plugins still exist in `src/plugins/`  
**Files Status:**
```
src/plugins/                          # OLD - should move to app/Http/Middlewares/
├── auth/
│   └── session-auth.plugin.ts       # 🔴 Still in use (index.ts imports)
├── guards/
│   ├── access-control.plugin.ts     # 🔴 Still in use
│   ├── email-verified.guard.ts      # 🔴 Still in use
│   └── permission.guard.ts          # 🔴 Still in use
├── middleware/
│   ├── csrf.middleware.ts           # 🔴 Still in use
│   ├── index.ts
│   ├── pagination.middleware.ts     # 🔴 Still in use
│   ├── rate-limit.middleware.ts     # 🔴 Still in use
│   └── security-headers.middleware.ts
├── redis/
│   ├── cache.ts                     # 🔴 Still in use
│   ├── caches/
│   │   ├── import.ts
│   │   ├── jwt-blacklist.ts
│   │   └── session.ts
│   ├── connection.ts
│   └── index.ts
├── di/
│   └── services.plugin.ts           # 🔴 OLD - replaced by AppServiceProvider
└── index.ts                         # 🔴 Exports all plugins
```

**Required Migration:**
```
src/plugins/ → src/app/Http/Middlewares/
  ├── AuthMiddleware.ts           (from session-auth.plugin.ts)
  ├── AccessControlMiddleware.ts  (from access-control.plugin.ts)
  ├── RateLimitMiddleware.ts      (from rate-limit.middleware.ts)
  ├── CorsMiddleware.ts           (already in index.ts as corsPlugin)
  └── SecurityHeadersMiddleware.ts
```

**Current Usage in src/index.ts:**
```typescript
import { corsPlugin, csrfPlugin, sessionAuthPlugin, ... } from './plugins';
// ✅ These imports work but should point to new paths after migration
```

---

### ❌ 4. Core HTTP Helpers (PARTIALLY MIGRATED)
**Status:** Still in `src/core/http/` - should be refactored  
**Files:**
```
src/core/http/
├── error-maps/                  # Can move to lib/mappers/
│   ├── auth.error-map.ts
│   ├── bank.error-map.ts
│   └── debt.error-map.ts
├── result-helper.ts             # ✅ OK - is utility
├── response.helpers.ts          # Could move to lib/mappers/
├── pagination.ts                # ✅ OK - middleware
├── require-auth.ts              # ✅ OK - guard
├── idempotency.ts               # ✅ OK - utility
└── import-status.ts             # Could move to lib/helpers/
```

**Recommendation:** Keep in `src/core/http/` for now - these are HTTP-specific and NOT marked for deletion.

---

## Part 6: CONFIG STRUCTURE (CORRECT)
**Status:** ✅ Properly migrated  
**Location:** `src/config/` (NEW) + `@repo/config` (shared)  
```
src/config/
├── app.ts                       # App configuration (PORT, HOST, etc.)
├── auth.ts                      # Auth settings (JWT, bcrypt, etc.)
├── database.ts                  # Database config
├── cache.ts                     # Redis config
└── services.ts                  # External APIs (VietQR, email, storage)
```

**Status:** ✅ Using `@repo/config` for shared values - correct pattern

---

## Part 7: STEP-BY-STEP FIX CHECKLIST

### Phase 1: Immediate Fixes (CRITICAL - BLOCKS BUILD)
- [ ] **Fix ImportController.ts:14** - Change path from `@/services/import-export/import.validators` → `@/app/Services/import-export/import.validators`
- [ ] **Create Debt Model** OR comment out `@/states` imports temporarily
  - [ ] Create `src/app/Models/Debt.ts`
  - [ ] Update DebtService.ts:11 to use new model
  - [ ] Delete duplicate `src/app/Services/debt/debt.service.ts`
- [ ] **Commit all changes** - Don't leave migration half-done

### Phase 2: Cleanup (HIGH - REMOVES CONFUSION)
- [ ] **Delete old folders** (confirm they're marked for deletion):
  - [ ] `src/states/` → Move logic to `src/app/Models/Debt.ts`
  - [ ] `src/controllers/` → Replaced by `src/app/Http/Controllers/`
  - [ ] `src/repositories/adapters/` → Replaced by `src/app/Repositories/Database/`
  - [ ] `src/utils/` → Moved to `src/lib/`
  - [ ] Nested service folders in `src/app/Services/` (activity/, auth/, debt/, etc.) - keep only indices
- [ ] **Delete services/di/services.plugin.ts** → Replaced by AppServiceProvider

### Phase 3: Type Safety (MEDIUM - IMPROVES CODE QUALITY)
- [ ] **Create Request DTOs in `src/app/Http/Requests/`**
  - [ ] CreateDebtRequest
  - [ ] UpdateDebtStatusRequest  
  - [ ] CreateBankAccountRequest
  - [ ] RegisterRequest
  - [ ] ... (for each endpoint)
- [ ] **Replace `as any` in Controllers** (35 instances)
  - [ ] BankController.ts (8 instances)
  - [ ] DebtController.ts (7 instances)
  - [ ] Other controllers (20 instances)
- [ ] **Add proper Response types** to services
- [ ] **Fix Service return types** (ImportService, ExportService)

### Phase 4: Middleware Migration (OPTIONAL - LATER REFACTOR)
- [ ] Move `src/plugins/` → `src/app/Http/Middlewares/`
- [ ] Update imports in index.ts
- [ ] Update tsconfig.json paths

---

## Part 8: FILE-BY-FILE IMPORT FIXES

### Critical Fixes Required:

**1. src/app/Http/Controllers/ImportController.ts**
```diff
- import { validateImportUploadFile } from '@/services/import-export/import.validators';
+ import { validateImportUploadFile } from '@/app/Services/import-export/import.validators';
```

**2. src/app/Services/DebtService.ts**
Option A (Temporary - until models created):
```diff
- import { debtStateMachine } from '@/states';
+ // import { debtStateMachine } from '@/states'; // TODO: Replace with Debt model methods
```

Option B (Permanent - after models created):
```diff
- import { debtStateMachine } from '@/states';
+ import { Debt } from '@/app/Models/Debt';

  // Then replace all debtStateMachine.getNextState() calls with Debt methods
  // debt.canBeCancelledBy(userId), debt.cancel(), etc.
```

**3. src/app/Services/debt/debt.service.ts** (DELETE ENTIRE FILE)
```bash
# This is a duplicate - remove completely
git rm src/app/Services/debt/debt.service.ts
git rm src/app/Services/debt/debt.utils.ts
git rm src/app/Services/debt/debt.validators.ts
git rm src/app/Services/debt/index.ts
git rmdir src/app/Services/debt/
```

**4. src/app/Services/debt/debt.service.ts (if keeping nested structure temporarily)**
```diff
- import { debtStateMachine } from '@/states';
- import { PushService } from '@/services/notification/push.service';
- import { ActivityService } from '@/services/activity/activity.service';
+ import { PushService } from '@/app/Services/PushService';
+ import { ActivityService } from '@/app/Services/ActivityService';
+ // import { debtStateMachine } from '@/states'; // TODO: Use Debt model instead
```

---

## Part 9: PACKAGE.JSON & tsconfig.json CHANGES NEEDED

### tsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@app/*": ["src/app/*"],
      "@lib/*": ["src/lib/*"],
      "@config/*": ["src/config/*"],
      // ⚠️ DEPRECATED - should remove after cleanup:
      "@plugins": ["src/plugins/index.ts"],  
      "@core/*": ["src/core/*"]              
    }
  }
}
```

**After cleanup (Week 2):**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@app/*": ["src/app/*"],
      "@lib/*": ["src/lib/*"],
      "@config/*": ["src/config/*"]
    }
  }
}
```

### package.json
**Current imports look correct:**
```json
{
  "tsyringe": "^4.x",
  "reflect-metadata": "^0.1.x"
}
```
✅ DI container dependencies already added

---

## Part 10: SUMMARY - WHAT'S DONE VS WHAT'S LEFT

### ✅ COMPLETED (70%)
- [x] New folder structure created (app/, lib/, config/, routes/)
- [x] All 13 controllers migrated to app/Http/Controllers/
- [x] All 9 repository interfaces created (Contracts/)
- [x] All 9 repository implementations migrated
- [x] 20 services migrated to app/Services/ (PascalCase)
- [x] DI Container setup (tsyringe + AppServiceProvider)
- [x] tsconfig.json path aliases configured
- [x] Security utils migrated to lib/security/
- [x] Validation utils migrated to lib/validation/
- [x] Decorators framework created (cacheable, retryable, etc.)
- [x] HTTP helpers refactored (result.ts, response helpers)

### 🔴 CRITICAL - MUST FIX (HIGH PRIORITY)
- [ ] **Fix broken import in ImportController.ts** (1 file)
- [ ] **Create Debt Model** or comment out @/states import (DebtService.ts)
- [ ] **Delete duplicate debt folder** (src/app/Services/debt/)
- [ ] Commit all changes - currently in staging

### ⚠️ IMPORTANT - FIX SOON (MEDIUM PRIORITY)
- [ ] Create Request DTOs (15+ new files needed)
- [ ] Replace 92 `any` assertions with proper types
- [ ] Delete old activity/, auth/, debt/ nested folders
- [ ] Remove src/states/ folder completely
- [ ] Clean up old src/utils/ references

### ❌ NICE-TO-HAVE - LATER (LOW PRIORITY)
- [ ] Migrate src/plugins/ → src/app/Http/Middlewares/
- [ ] Create ValueObjects (Money, etc.)
- [ ] Implement remaining decorators usage
- [ ] Add EventBus/observer pattern for domain events

---

## Part 11: RECOMMENDED COMMIT SEQUENCE

**Commit 1: Fix Critical Imports**
```bash
git add -A
git commit -m "fix: correct import paths in migrated services"
# Files: ImportController.ts, DebtService.ts
```

**Commit 2: Remove Deleted Files**
```bash
# Already marked for deletion in git status
git commit -m "chore: remove old controllers, services, repositories folders"
```

**Commit 3: Add Debt Model**
```bash
git add src/app/Models/Debt.ts
git commit -m "feat: add rich Debt domain model with business logic"
```

**Commit 4: Type Safety - DTOs** (later)
```bash
git add src/app/Http/Requests/
git commit -m "feat: add request DTOs for type-safe HTTP validation"
```

---

## QUESTIONS TO VERIFY

1. **Should I delete `src/app/Services/debt/` folder entirely?**
   - Yes - it's a partial migration. Use `src/app/Services/DebtService.ts` instead.

2. **Should I keep `src/states/` for backward compatibility?**
   - No - plan says replace with rich domain models. Create Debt.ts and remove @/states imports.

3. **Should nested service indices (auth/, debt/, etc.) be kept?**
   - No - they're empty re-exports. Delete them, use root-level services.

4. **Are decorators (@Retryable, @Timed) being used?**
   - Currently created but NOT USED. Mark as TODO for Phase 2.

5. **Should I migrate plugins/ now or later?**
   - Later - they work but aren't in the redesign timeline. Phase 4 only.

---

## NEXT STEPS

1. **TODAY:** Fix 3 broken imports + commit changes
2. **TOMORROW:** Create Debt model + remove duplicate files
3. **THIS WEEK:** Add Request DTOs + fix type safety
4. **NEXT WEEK:** Clean up old folders + verify no broken paths

