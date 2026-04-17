# Backend API Migration Fixing Plan

## Executive Summary

This plan addresses the inconsistencies and missing pieces from the current architecture migration. The codebase has **dual implementations** (old + new) running in parallel with **inconsistent patterns** for responses, errors, and service architecture.

### Migration Safety Strategy

**CRITICAL PRINCIPLE: DO NOT DELETE LEGACY CODE until the corresponding new implementation is 100% complete and tested.**

**Migration Approach:**
1. **Parallel Development** - Keep legacy code operational while building new structure
2. **Incremental Replacement** - Replace one component at a time, verify, then proceed
3. **Feature Flags** (if needed) - Route traffic to new/old implementations for A/B testing
4. **Verification Gates** - Each phase has exit criteria before proceeding
5. **Legacy Deletion** - ONLY in Phase 6 (Final Cleanup) after all verification passes

**Dependency Chain:**
```
lib/validation (valibot) → lib/helpers → app/Models → app/Services → app/Http/Controllers → Routes → Cleanup
```

**Rollback Strategy:**
- Each phase creates new files (does not overwrite)
- Legacy code remains untouched until Phase 6
- If issues found, can revert routing to legacy controllers
- Database schema remains compatible throughout

### Current Scale of Migration

| Layer | Count | Status |
|-------|-------|--------|
| **Controllers** | 13 files | ✅ Created in `app/Http/Controllers/` |
| **Services** | 39 files | ⚠️ Mix of new DI-based + legacy folder duplicates |
| **Repositories** | 27 files | ⚠️ Mix of PascalCase new + kebab-case old |
| **Middleware** | 0 files | ❌ Still in `src/plugins/`, needs migration |
| **Models** | 0 files | ❌ Not yet created per architecture plan |
| **Exceptions** | 0 files | ❌ Not yet created per architecture plan |

### Current `app/` Structure vs Target (Per Architecture Plan)

**Target Structure from `ARCHITECTURE_REDESIGN_PLAN.md`:**
```
app/
├── Http/
│   ├── Controllers/     ✅ Present (13 controllers)
│   ├── Middleware/      ❌ Missing - migrate from src/plugins/
│   └── Requests/        ❌ Missing - organize validation DTOs
│
├── Models/              ❌ Missing - Rich domain entities (Debt.ts, User.ts, Enums/)
├── Exceptions/          ❌ Missing - Custom exceptions (DebtNotFoundException.ts, etc.)
├── Services/            ⚠️ Partial - 39 files but duplicates exist
├── Repositories/        ⚠️ Partial - 27 files but duplicates exist
└── Providers/           ✅ AppServiceProvider.ts exists
```

### Current `lib/` Structure vs Target

**Target Structure:**
```
lib/
├── helpers/             ⚠️ Partial - 2 files, needs more
├── security/            ✅ password.ts, crypto.ts exist
│   └── ip/              ❌ Missing - extract.ts, validate.ts, parse.ts
├── validation/          ⚠️ Uses regex - should migrate to valibot
├── db/                  ✅ circuit-breaker.ts exists
├── http/                ✅ circuit-breaker.ts exists
├── mappers/             ❌ Empty - should contain data transformations
└── result.ts            ✅ Exists
```

---

## Phase 1: Foundation Layer (Week 1)
**Dependencies:** None - Foundation for all other phases  
**Exit Criteria:** All new utility files created and tested

### 1.1 Complete lib/ Structure (Foundation)

**Create missing lib/ folders WITHOUT deleting anything:**

```
lib/
├── helpers/              ⚠️ ADD: array.ts, date.ts, string.ts, number.ts
├── security/             ✅ Keep existing
│   └── ip/               ❌ CREATE: extract.ts, validate.ts, parse.ts
├── validation/           ⚠️ CREATE new valibot files alongside existing
├── mappers/              ❌ CREATE: user.ts, debt.ts
└── result.ts             ✅ Keep existing
```

**Action Items:**
1. **Create `lib/helpers/` files** (NEW files, do not touch existing)
   - `lib/helpers/array.ts` - chunk, groupBy, unique
   - `lib/helpers/date.ts` - formatDate, parseISO
   - `lib/helpers/string.ts` - slugify, truncate
   - `lib/helpers/number.ts` - formatCurrency, round
   - Update `lib/helpers/index.ts` to re-export

2. **Create `lib/security/ip/` folder** (NEW)
   - `extract.ts` - getClientIP from request headers
   - `validate.ts` - isPrivateIP, isTrustedProxy
   - `parse.ts` - normalizeIP
   - Source: Look for IP functions in `src/utils/` or `src/plugins/`

3. **Create `lib/mappers/` folder** (NEW)
   - `user.ts` - toUserDTO, toSafeUser (move from password.ts line 98-102)
   - `debt.ts` - toDebtDTO, toDebtDetails
   - Update imports in services to use new location

### Checkpoint 1.1 Exit Criteria:
- [ ] All new lib/ files created
- [ ] `lib/helpers/index.ts` exports all helpers
- [ ] No errors in new files
- [ ] Legacy files remain untouched

### 1.2 Migrate Validation to Valibot (Parallel to Existing)

**Strategy:** Create NEW valibot-based validation files alongside existing regex-based ones. Do NOT delete old files yet.

**Create new files:**
```
lib/validation/
├── debt.ts                 ✅ Keep existing (regex-based)
├── debt.valibot.ts         ❌ CREATE NEW (valibot-based)
├── phone.ts                ✅ Keep existing
├── phone.valibot.ts        ❌ CREATE NEW
└── index.ts                ⚠️ Update to export both versions
```

**Implementation:**
```typescript
// lib/validation/debt.valibot.ts (NEW FILE)
import * as v from 'valibot';
import { SHARED_CONSTANTS } from '@repo/config';

export const AmountSchema = v.pipe(
  v.number(),
  v.minValue(SHARED_CONSTANTS.DEBT.MIN_AMOUNT),
  v.maxValue(SHARED_CONSTANTS.DEBT.MAX_AMOUNT)
);

export function validateAmountValibot(amount: number): Result<void> | null {
  const result = v.safeParse(AmountSchema, amount);
  if (!result.success) {
    return { code: GEN_ERRORS.INVALID_INPUT.code, error: result.issues[0].message };
  }
  return null;
}
```

### Checkpoint 1.2 Exit Criteria:
- [ ] New valibot validation files created
- [ ] Both old and new versions coexist
- [ ] Services can optionally import from new location
- [ ] No breaking changes to existing code

### 1.3 Fix Hardcoded Password List (Configuration Fix)

**File:** `lib/security/password.ts` (lines 65-72)

**Action:** Extract hardcoded list to `@repo/config` - this is a configuration change, not structural.

```typescript
// BEFORE (hardcoded in password.ts)
const COMMON_PASSWORDS = new Set(['password', 'password123', ...]);

// AFTER (import from config)
import { SHARED_CONSTANTS } from '@repo/config';
const COMMON_PASSWORDS = new Set(SHARED_CONSTANTS.SECURITY.COMMON_PASSWORDS);
```

**Files to Update:**
- `packages/config/src/index.ts` - Add SECURITY constants
- `lib/security/password.ts` - Use imported list (single line change)

### Checkpoint 1.3 Exit Criteria:
- [ ] Password list moved to `@repo/config`
- [ ] `lib/security/password.ts` uses imported list
- [ ] Tests still pass

---

## Phase 2: Response Pattern Fixes (Week 1-2)
**Dependencies:** Phase 1 complete  
**Exit Criteria:** All new controllers use consistent patterns, legacy controllers untouched

### 2.1 Fix New Controller Response Patterns

**Scope:** ONLY files in `app/Http/Controllers/` (new structure)

| File | Action | Lines |
|------|--------|-------|
| `ActivityController.ts` | Change `apiResponse()` → `apiSuccess()` | 42, 70 |
| `TracesController.ts` | Change `apiResponse()` → `apiSuccess()`/`apiError()` | 73, 79, 89, 96 |
| `ImportController.ts` | Fix validators - remove response wrapping | Validators |

**Action:**
```typescript
// BEFORE (ActivityController.ts line 42)
return apiResponse({ ok: true, data: { ... } });

// AFTER
return apiSuccess({ ... });
```

### Checkpoint 2.1 Exit Criteria:
- [ ] All new controllers use `apiSuccess()`/`apiError()`
- [ ] No `apiResponse({ok:...})` calls in new controllers
- [ ] Legacy controllers in `src/controllers/` untouched
- [ ] All tests pass

### 2.2 Standardize Error Codes in New Services

**Scope:** ONLY files in `app/Services/` (new DI-based structure)

**Files to Update:**
| File | Line | Current | Fix |
|------|------|---------|-----|
| `UserService.ts` | 54, 75, 116 | `{code: 'USER_NOT_FOUND', ...}` | Use `BE_ERRORS.USER_NOT_FOUND` |
| `SessionService.ts` | 27, 35, 40, 45 | `{code: 'MISSING_TOKEN', ...}` | Use `BE_ERRORS.AUTH_NO_SESSION` |

**Action:**
```typescript
// BEFORE
return { code: 'USER_NOT_FOUND', error: 'User not found' };

// AFTER
return { code: BE_ERRORS.USER_NOT_FOUND.code };
```

### Checkpoint 2.2 Exit Criteria:
- [ ] No hardcoded error codes in new services
- [ ] All errors use `BE_ERRORS` or `GEN_ERRORS`
- [ ] Legacy services untouched
- [ ] Tests pass

---

## Phase 3: Domain Layer Creation (Week 2)
**Dependencies:** Phase 1, Phase 2 complete  
**Exit Criteria:** Domain models created, no breaking changes to existing services

### 3.1 Create Domain Models (NEW Files)

**Create `app/Models/` structure:**
```
app/Models/                 ❌ CREATE FOLDER
├── Debt.ts                 ❌ CREATE - Rich domain entity
├── User.ts                 ❌ CREATE - Rich domain entity
└── Enums/                  ❌ CREATE FOLDER
    ├── DebtStatus.ts       ❌ CREATE - State machine
    └── UserRole.ts         ❌ CREATE - Role definitions
```

**Strategy:** 
- Create NEW files, do not move from `src/states/` yet
- Copy logic from `src/states/` into new domain model format
- Keep `src/states/` operational

**Example:**
```typescript
// app/Models/Debt.ts (NEW)
export class Debt {
  // Rich domain methods
  canTransitionTo(status: DebtStatus): boolean { ... }
  transitionTo(status: DebtStatus): void { ... }
}

export enum DebtStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  // ...
}
```

### Checkpoint 3.1 Exit Criteria:
- [ ] `app/Models/` folder created with all files
- [ ] Domain logic copied from `src/states/`
- [ ] `src/states/` still exists and functional
- [ ] No breaking changes

### 3.2 Create Exception Classes (NEW Files)

**Create `app/Exceptions/`:**
```
app/Exceptions/             ❌ CREATE FOLDER
├── BaseException.ts        ❌ CREATE - Base class
├── DebtNotFoundException.ts ❌ CREATE
├── UnauthorizedException.ts ❌ CREATE
├── ValidationException.ts  ❌ CREATE
└── RateLimitException.ts   ❌ CREATE
```

**Example:**
```typescript
// app/Exceptions/BaseException.ts
export class BaseException extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// app/Exceptions/DebtNotFoundException.ts
export class DebtNotFoundException extends BaseException {
  constructor() {
    super(BE_ERRORS.DEBT_NOT_FOUND.code, BE_ERRORS.DEBT_NOT_FOUND.message);
  }
}
```

### Checkpoint 3.2 Exit Criteria:
- [ ] All exception classes created
- [ ] Can be imported by services
- [ ] No breaking changes to existing code

---

## Phase 4: HTTP Layer Completion (Week 3)
**Dependencies:** Phase 1, 2, 3 complete  
**Exit Criteria:** Middleware and Requests folders created, Controllers can use them

### 4.1 Create Middleware Folder (NEW)

**Create `app/Http/Middleware/`:**
```
app/Http/Middleware/        ❌ CREATE FOLDER
├── AuthMiddleware.ts       ❌ CREATE (from src/plugins/auth/)
├── RateLimitMiddleware.ts  ❌ CREATE (from src/plugins/middleware/)
├── CorsMiddleware.ts       ❌ CREATE (from src/plugins/middleware/)
├── PermissionMiddleware.ts ❌ CREATE (from src/plugins/permission/)
└── AccessControlMiddleware.ts ❌ CREATE (from src/plugins/access-control/)
```

**Strategy:**
- Create NEW middleware classes with `@injectable()`
- Convert plugins to class-based middleware
- Keep `src/plugins/` operational

**Example:**
```typescript
// app/Http/Middleware/AuthMiddleware.ts (NEW)
@injectable()
export class AuthMiddleware {
  constructor(@inject(SessionService) private sessionService: SessionService) {}
  
  register(app: Elysia): Elysia {
    return app.onBeforeHandle(async (ctx) => { ... });
  }
}
```

### Checkpoint 4.1 Exit Criteria:
- [ ] All middleware files created
- [ ] Controllers can import from new location
- [ ] `src/plugins/` still operational
- [ ] No breaking changes

### 4.2 Create Requests Folder (NEW)

**Create `app/Http/Requests/`:**
```
app/Http/Requests/          ❌ CREATE FOLDER
├── AuthRequests.ts         ❌ CREATE - LoginRequest, RegisterRequest
├── DebtRequests.ts         ❌ CREATE - CreateDebtRequest
├── UserRequests.ts         ❌ CREATE - UpdateProfileRequest
└── index.ts                ❌ CREATE - Re-exports
```

**Strategy:**
- Organize existing schemas from `@repo/validation` if they are request-specific
- Or create new request DTOs
- Controllers can import from new location

### Checkpoint 4.2 Exit Criteria:
- [ ] `app/Http/Requests/` folder created
- [ ] All request DTOs organized
- [ ] Controllers can use new imports
- [ ] No breaking changes

---

## Phase 5: Service & Repository Consolidation (Week 3-4)
**Dependencies:** Phase 1-4 complete  
**Exit Criteria:** Duplicates identified, new versions verified, routing ready

### 5.1 Verify New Service Completeness

**Checklist for each new service in `app/Services/`:**
- [ ] Has `@injectable()` decorator
- [ ] All dependencies have `@inject()`
- [ ] Uses `BE_ERRORS`/`GEN_ERRORS` (not hardcoded)
- [ ] Has all methods from legacy equivalent
- [ ] Unit tests pass

**Services requiring verification (39 total):**
- Priority 1: DebtService, UserService, AuthService (core)
- Priority 2: ActivityService, SessionService, PushService
- Priority 3: All remaining services

### 5.2 Verify New Repository Completeness

**Checklist for each new repository in `app/Repositories/Database/`:**
- [ ] Has `@injectable()` decorator
- [ ] Implements interface
- [ ] Has all methods from legacy equivalent
- [ ] SQL optimized (no N+1 issues)

**Action:**
```typescript
// Create mapping document:
| Legacy File | New File | Status | Notes |
|-------------|----------|--------|-------|
| debt.repository.ts | DebtRepository.ts | ✅ Ready | All methods migrated |
| user.repository.ts | UserRepository.ts | ⚠️ Check | Missing softDelete |
```

### 5.3 Routing Switch Preparation

**Create `src/routes/api.ts` (NEW):**
```typescript
// NEW routing file that uses new controllers
import { DebtController } from '@app/Http/Controllers';

export function registerApiRoutes(app: Elysia) {
  const debtController = container.resolve(DebtController);
  debtController.register(app);
  // ... other controllers
}
```

**Keep old routing operational:**
```typescript
// src/index.ts - can switch between old and new
const USE_NEW_CONTROLLERS = process.env.USE_NEW_CONTROLLERS === 'true';

if (USE_NEW_CONTROLLERS) {
  registerApiRoutes(app);  // NEW
} else {
  app.use(legacyRoutes);     // OLD - keep operational
}
```

### Checkpoint 5.3 Exit Criteria:
- [ ] All new services verified complete
- [ ] All new repositories verified complete
- [ ] New routing file created
- [ ] Can switch between old/new via feature flag
- [ ] No breaking changes when using old routes

---

## Phase 6: Final Cleanup & Legacy Removal (Week 5)
**Dependencies:** ALL previous phases complete AND verified in production  
**Exit Criteria:** Legacy code safely removed, only new structure remains

### ⚠️ CRITICAL: Only proceed if:
- [ ] New controllers running in production for 1+ weeks without issues
- [ ] All tests passing on new implementation
- [ ] Feature flag `USE_NEW_CONTROLLERS` has been `true` for 1+ weeks
- [ ] Rollback plan tested and ready

### 6.1 Remove Legacy Folders (FINAL STEP)

**DELETE only after verification:**
```
src/controllers/           ✅ DELETE - All migrated to app/Http/Controllers/
src/services/              ✅ DELETE - All migrated to app/Services/
src/repositories/          ✅ DELETE - All migrated to app/Repositories/
src/routes/                ✅ DELETE - Replaced by new routing
src/app/Services/debt/     ✅ DELETE - Legacy duplicate
src/app/Services/activity/ ✅ DELETE - Legacy duplicate
src/app/Services/user/     ✅ DELETE - Legacy duplicate
src/app/Repositories/Database/*.repository.ts ✅ DELETE - Old kebab-case files
src/states/                ✅ DELETE - Moved to app/Models/
src/plugins/               ✅ DELETE - Moved to app/Http/Middleware/
```

### 6.2 Remove Legacy Imports

**Update `src/index.ts`:**
- Remove legacy controller imports
- Remove feature flag (USE_NEW_CONTROLLERS)
- Keep only new implementation

### 6.3 Consolidate Validation (Final)

**After verification, remove old validation:**
```
lib/validation/
├── debt.ts                 ✅ DELETE (keep debt.valibot.ts)
├── debt.valibot.ts         ✅ RENAME to debt.ts
├── phone.ts                ✅ DELETE (keep phone.valibot.ts)
└── phone.valibot.ts        ✅ RENAME to phone.ts
```

### Checkpoint 6.3 Exit Criteria:
- [ ] All legacy folders deleted
- [ ] Application runs with only new code
- [ ] All tests pass
- [ ] No references to deleted files
- [ ] Clean git history showing deletions

---

## Summary Timeline (6 Phases with Safety Gates)

| Phase | Week | Dependencies | Exit Criteria | Key Deliverables |
|-------|------|--------------|---------------|------------------|
| **1** | Week 1 | None | ✅ Checkpoints 1.1-1.3 | Foundation: lib/helpers, lib/security/ip, lib/mappers, valibot validation (parallel), password list fix |
| **2** | Week 1-2 | Phase 1 | ✅ Checkpoints 2.1-2.2 | Response patterns: Fix new controllers (Activity, Traces, Import), standardize error codes in new services |
| **3** | Week 2 | Phase 1, 2 | ✅ Checkpoints 3.1-3.2 | Domain layer: Create app/Models/, app/Exceptions/ (NEW files, src/states/ untouched) |
| **4** | Week 3 | Phase 1-3 | ✅ Checkpoints 4.1-4.2 | HTTP layer: Create app/Http/Middleware/, app/Http/Requests/ (src/plugins/ untouched) |
| **5** | Week 3-4 | Phase 1-4 | ✅ Checkpoints 5.1-5.3 | Verification: Service/repository completeness audit, routing switch prep (feature flag) |
| **6** | Week 5 | All above + Production verification | ✅ Checkpoint 6.3 | **FINAL: Delete legacy code ONLY after 1+ weeks production testing** |

### Phase Gate Rules:
1. **NO phase advancement** until all checkpoints of current phase are complete
2. **NO legacy deletion** until Phase 6
3. **Production verification required** before Phase 6 (1+ weeks with `USE_NEW_CONTROLLERS=true`)
4. **Rollback ready** at every phase - keep legacy code operational

### File Scale Summary:
| Category | Current | Target | Action |
|----------|---------|--------|--------|
| **Services** | 39 files (mix) | 25-30 clean DI-based | Audit all, identify duplicates |
| **Repositories** | 27 files (mix) | 15-17 clean | Remove kebab-case duplicates in Phase 6 only |
| **Controllers** | 13 new + legacy | 13 clean | Fix ~4-5 patterns in Phase 2 |
| **lib/helpers** | 2 files | 6 files (array, date, string, number, index) | Create in Phase 1 |
| **lib/security/ip** | 0 files | 3 files | Create in Phase 1 |
| **lib/mappers** | 0 files | 2-3 files (user, debt) | Create in Phase 1 |
| **app/Models** | 0 files | 4-5 files | Create in Phase 3 |
| **app/Exceptions** | 0 files | 5-6 files | Create in Phase 3 |
| **app/Http/Middleware** | 0 files | 5 files | Create in Phase 4 |
| **app/Http/Requests** | 0 files | 4-5 files | Create in Phase 4 |

### Legacy Deletion Schedule (Phase 6 ONLY):
```
✅ DELETE: src/controllers/           (after new verified)
✅ DELETE: src/services/              (after new verified)
✅ DELETE: src/repositories/            (after new verified)
✅ DELETE: src/routes/                  (after new routing works)
✅ DELETE: src/states/                  (after app/Models/ verified)
✅ DELETE: src/plugins/                 (after app/Http/Middleware/ verified)
✅ DELETE: src/app/Services/*/          (legacy duplicates)
✅ DELETE: src/app/Repositories/*.repository.ts (kebab-case old)
✅ DELETE: lib/validation/*.ts          (regex-based, keep valibot)
✅ RENAME: lib/validation/*.valibot.ts → *.ts

| Folder | Status | Contents | Action Required |
|--------|--------|----------|-----------------|
| `Controllers/` | ✅ Exists | 13 controllers created | Fix response patterns |
| `Middleware/` | ❌ Missing | - | Migrate from `src/plugins/` |
| `Requests/` | ❌ Missing | - | Create validation DTOs |

### app/ Domain Layer Completion

| Folder | Status | Contents | Action Required |
|--------|--------|----------|-----------------|
| `Models/` | ❌ Missing | - | Create Debt.ts, User.ts, Enums/ |
| `Exceptions/` | ❌ Missing | - | Create custom exception classes |
| `Services/` | ⚠️ Partial | 39 files | Remove duplicates, fix DI |
| `Repositories/` | ⚠️ Partial | 27 files | Remove kebab-case duplicates |

### lib/ Structure Completion

| Folder | Status | Contents | Action Required |
|--------|--------|----------|-----------------|
| `helpers/` | ⚠️ Partial | 2 files | Add array.ts, date.ts, string.ts, number.ts |
| `security/` | ✅ Exists | password.ts, crypto.ts | Fix hardcoded passwords, add valibot |
| `security/ip/` | ❌ Missing | - | Create extract.ts, validate.ts, parse.ts |
| `validation/` | ⚠️ Regex | debt.ts | Migrate to valibot |
| `db/` | ✅ Exists | circuit-breaker.ts | ✓ Good |
| `http/` | ✅ Exists | circuit-breaker.ts | ✓ Good |
| `mappers/` | ❌ Empty | - | Create user.ts, debt.ts |
| `result.ts` | ✅ Exists | - | ✓ Good |

### Controllers (app/Http/Controllers/)

| File | apiResponse | apiSuccess/apiError | DI | Notes |
|------|-------------|---------------------|-----|-------|
| ActivityController.ts | ✗ Used | ✓ | ✓ | Fix lines 42, 70 |
| AuthController.ts | - | ✓ | ✓ | ✓ Good |
| BankController.ts | ? | ? | ? | Check implementation |
| DebtController.ts | - | ✓ | ✓ | ✓ Good |
| ExportController.ts | ? | ? | ? | Check implementation |
| ImportController.ts | ✗ In validators | ? | ? | Fix validators |
| PublicController.ts | ? | ? | ? | Check implementation |
| PushController.ts | - | ✓ | ✓ | ✓ Good |
| StorageController.ts | - | ✓ | ✓ | ✓ Good |
| SystemController.ts | ? | ? | ? | Check implementation |
| TracesController.ts | ✗ Used | ✗ | - | Fix all responses |
| UserController.ts | - | ✓ | ✓ | ✓ Good |

### Services (app/Services/)

| File | @injectable | All @inject | Error Codes | Notes |
|------|-------------|-------------|-------------|-------|
| ActivityService.ts | ✓ | ✓ | N/A | ✓ Good |
| AuthSecurityService.ts | ? | ? | ? | Verify |
| AuthService.ts | ? | ? | ? | Verify |
| AuthSessionService.ts | ? | ? | ? | Verify |
| BankAccountService.ts | ? | ? | ? | Verify |
| DebtService.ts | ✓ | ✗ (2 missing) | Mixed | Fix injections |
| EmailService.ts | ? | ? | ? | Verify |
| ... | | | | |

### Repositories (app/Repositories/Database/)

| File | @injectable | @inject | Complete | Notes |
|------|-------------|---------|----------|-------|
| DebtRepository.ts | ✓ | ✓ | ? | Verify all methods |
| UserRepository.ts | ✓ | ✓ | ? | Verify all methods |
| ... | | | | |

---

## Appendix B: Error Code Mapping Reference

### Service Error → Controller Response

| Service Returns | Controller Should |
|-----------------|-------------------|
| `{ code: 'USER_NOT_FOUND' }` | `apiError(BE_ERRORS.USER_NOT_FOUND)` |
| `{ code: 'DEBT_NOT_FOUND' }` | `apiError(BE_ERRORS.DEBT_NOT_FOUND)` |
| `{ code: 'AUTH_NO_SESSION' }` | `apiError(BE_ERRORS.AUTH_NO_SESSION)` |
| `{ code: 'INVALID_INPUT', error: 'custom' }` | `apiError(GEN_ERRORS.INVALID_INPUT, 'custom')` |
| `{ data: value }` | `apiSuccess({ data: value })` |

---

## Appendix C: Quick Reference - Response Patterns

### Success Response
```typescript
// CORRECT
return apiSuccess({ user: safeUser });
return apiSuccess({ debt: debtDetails, message: 'Created' });
return apiSuccess(result); // if result is already wrapped

// INCORRECT
return { ok: true, data: user };  // Legacy
return apiResponse({ ok: true, data: user });  // Legacy wrapper
```

### Error Response
```typescript
// CORRECT
return apiError(BE_ERRORS.DEBT_NOT_FOUND);
return apiError(GEN_ERRORS.INVALID_INPUT, 'Custom detail');

// INCORRECT
return { ok: false, error: { code: 'X', message: 'Y' } };  // Legacy
return apiResponse({ ok: false, error: {...} });  // Legacy wrapper
return { code: 'CUSTOM', message: '...' };  // Wrong shape
```

---

## Appendix D: Valibot Migration Patterns

### Phone Validation
```typescript
// CURRENT - lib/validation/phone.ts
const PHONE_REGEX = /^[0-9]{10,11}$/;
if (!PHONE_REGEX.test(phone)) return { error: 'Invalid phone' };

// TARGET - using valibot + @repo/validation
import * as v from 'valibot';
import { PhoneSchema } from '@repo/validation';

const result = v.safeParse(PhoneSchema, phone);
if (!result.success) {
  return { code: GEN_ERRORS.INVALID_PHONE.code, error: result.issues[0].message };
}
```

### Password Validation
```typescript
// CURRENT - lib/security/password.ts (lines 36-54)
if (!/[A-Z]/.test(password)) errors.push('...');
if (!/[a-z]/.test(password)) errors.push('...');

// TARGET - valibot schema
import * as v from 'valibot';

const PasswordSchema = v.pipe(
  v.string(),
  v.minLength(8),
  v.maxLength(128),
  v.regex(/[A-Z]/, 'Must contain uppercase'),
  v.regex(/[a-z]/, 'Must contain lowercase'),
  v.regex(/[0-9]/, 'Must contain number'),
  v.regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain special char')
);

export function validatePasswordComplexity(password: string) {
  const result = v.safeParse(PasswordSchema, password);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.issues.map(i => i.message)
  };
}
```

### Debt Amount Validation
```typescript
// CURRENT - lib/validation/debt.ts (lines 13-24)
if (amount < MIN || amount > MAX) return { error: '...' };

// TARGET - valibot
const AmountSchema = v.pipe(
  v.number(),
  v.minValue(SHARED_CONSTANTS.DEBT.MIN_AMOUNT),
  v.maxValue(SHARED_CONSTANTS.DEBT.MAX_AMOUNT)
);
```

---

*Generated based on analysis of: ARCHITECTURE_REDESIGN_PLAN.md, MIGRATION_STATUS.md, and current codebase state.*
