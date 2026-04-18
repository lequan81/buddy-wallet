# API Architecture Audit Report
**Date:** 2026-04-18  
**Status:** Architectural Inconsistencies Found  
**Priority:** HIGH - Redesign Plan Partially Implemented

---

## Executive Summary

The API is **50% through the architectural redesign**. The new structure (`app/Http/`, `app/Services/`, `app/Models/`) is in place, but:

1. **Duplicate files** from old architecture still exist (old vs. new naming conventions)
2. **Legacy plugin folders** haven't been properly migrated
3. **Missing implementations** in key folders (Models, Exceptions, Mappers)
4. **Inconsistent naming conventions** across similar files
5. **Abandoned Auth services** (3 separate Auth* services with overlapping concerns)

This creates confusion and technical debt. The redesign needs to be **completed** rather than left in this transitional state.

---

## 1. DUPLICATE FILES (Lingering Legacy Code)

### Problem: File Name Convention Mismatch
Files exist in both **new style** (PascalCase) and **old style** (camelCase/snake-case).

#### 1.1 DebtService Duplication

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `app/Services/DebtService.ts` ✅ | 486 | **NEW** | Using `@injectable()`, modern architecture |
| `app/Services/debt/debt.service.ts` ❌ | 612 | **OLD** | Still uses deprecated `debtStateMachine` (line 23) |

**Issue:** Both files exist. The old one is larger and contains legacy patterns.  
**Blocker:** Code consuming `debt/debt.service.ts` still runs, creating inconsistency.

#### 1.2 Storage Service Duplication

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `app/Services/S3StorageService.ts` ✅ | 64 | **NEW** | Uses DI pattern |
| `app/Services/storage.service.ts` ❌ | 23 | **OLD** | Stub/placeholder? |

**Issue:** Unclear which is canonical. Only 23 vs. 64 lines suggests one is incomplete.

#### 1.3 Repository Duplication (PascalCase vs kebab-case)

**Database Folder:** `app/Repositories/Database/` contains **18 files**:

| Entity | New (PascalCase) | Old (kebab-case) | Status |
|--------|-----------------|-----------------|--------|
| Activity | `ActivityRepository.ts` | `activity.repository.ts` | **BOTH** |
| BankAccount | `BankAccountRepository.ts` | `bank-account.repository.ts` | **BOTH** |
| Debt | `DebtRepository.ts` | `debt.repository.ts` | **BOTH** |
| Email Verification | `EmailVerificationRepository.ts` | `email-verification.repository.ts` | **BOTH** |
| File | `FileRepository.ts` | `file.repository.ts` | **BOTH** |
| Import | `ImportRepository.ts` | `import-export.repository.ts` | **BOTH** |
| Notification | `NotificationRepository.ts` | `notification.repository.ts` | **BOTH** |
| Session | `SessionRepository.ts` | `session.repository.ts` | **BOTH** |
| User | `UserRepository.ts` | `user.repository.ts` | **BOTH** |

**Impact:** 9 repository classes duplicated × 2 = **18 files instead of 9**.

**Example:**
```
src/app/Repositories/Database/
├── ActivityRepository.ts          (NEW)
├── activity.repository.ts         (OLD) ← Delete
├── BankAccountRepository.ts       (NEW)
├── bank-account.repository.ts     (OLD) ← Delete
├── ... (8 more duplicate pairs)
```

#### 1.4 Mapper Duplication

| File | Status | Reason |
|------|--------|--------|
| `app/Http/Mappers/debt.mapper.ts` | **NEW** | PascalCase convention |
| `app/Http/Mappers/debt.ts` | **OLD** | Legacy naming |
| `app/Http/Mappers/user.mapper.ts` | **NEW** | PascalCase convention |
| `app/Http/Mappers/user.ts` | **OLD** | Legacy naming |

**Issue:** Which is authoritative? Different naming suggests incomplete refactor.

---

## 2. AUTH SERVICE FRAGMENTATION (3 Services, Overlapping Responsibility)

### Problem: Too Many Auth Services

The `app/Services/` folder has **3 separate Auth-related services**:

```
app/Services/
├── AuthService.ts                  (4,325 bytes)
├── AuthSecurityService.ts          (8,710 bytes) ← Security operations
├── AuthSessionService.ts           (2,948 bytes) ← Session management
```

#### 2.1 Current Fragmentation

| Service | Purpose | Methods | Problem |
|---------|---------|---------|---------|
| **AuthService** | Login, registration, password reset | `login()`, `register()`, `verifyEmail()` | Mixed concerns |
| **AuthSecurityService** | Security checks, lockouts, 2FA logic | `checkAttempts()`, `verifyPassword()`, `enable2FA()` | Violates SRP |
| **AuthSessionService** | Session create/revoke | `createSession()`, `revokeSession()` | Should be in AuthService |

#### 2.2 Better Organization

**Redesign Plan Intent:** Single `AuthService` with delegated services

```typescript
// app/Services/AuthService.ts (main coordinator)
@injectable()
export class AuthService {
  constructor(
    @inject(SessionService) private sessions: SessionService,
    @inject(EmailVerificationService) private email: EmailVerificationService,
    @inject(PasswordResetService) private passwordReset: PasswordResetService
  ) {}

  async login(email: string, password: string) {
    // Validate attempt count (via SessionService or new SecurityService)
    // Verify password
    // Create session
    // Log activity
  }
}
```

**Current issue:** Logic is split across 3 files with unclear call patterns.

---

## 3. MISSING MODELS IMPLEMENTATIONS

### Problem: Models Folder is Sparse

Plan specifies: **Rich domain entities** in `app/Models/`.

#### 3.1 What Exists

```
app/Models/
├── Activity.ts              (1,323 bytes) - Minimal
├── Debt.ts                  (4,828 bytes) - Has some logic
├── Notification.ts          (1,426 bytes) - Minimal
├── Session.ts               (1,603 bytes) - Minimal
├── User.ts                  (1,356 bytes) - Minimal
├── Enums/
│   └── DebtStatus.ts
└── index.ts                 (419 bytes) - Just exports
```

#### 3.2 Expected vs. Actual

| Model | Expected | Actual | Gap |
|-------|----------|--------|-----|
| **User** | Business logic (password validation, role checks, email verification) | Just data wrapper | ❌ Missing |
| **Debt** | State transitions (`cancel()`, `confirm()`, `isOverdue()`, business rules) | Partially implemented | ⚠️ Incomplete |
| **Activity** | Domain events, audit trail construction | Just data | ❌ Missing |
| **Session** | Expiry checks, token validation | Just data | ❌ Missing |

**Example - Expected Debt Model:**
```typescript
export class Debt {
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new DebtCannotBeCancelledException();
    }
    return new Debt(...this.data, { status: 'cancelled' });
  }
}
```

**Actual (Debt.ts):** Mostly data wrappers, no rich behavior.

---

## 4. EXCEPTIONS FOLDER UNDERUTILIZED

### Problem: Single File, No Domain-Specific Exceptions

#### 4.1 Current State

```
app/Exceptions/
├── index.ts              (2,677 bytes)
└── (nothing else)
```

**What's in it:**
- `HttpException` (base class)
- `BadRequestException`, `UnauthorizedException`, `NotFoundException`, etc.
- **9 generic HTTP exceptions**

#### 4.2 What's Missing

**Per-Domain Exception Classes:**

```typescript
// app/Exceptions/Debt/DebtNotFoundException.ts
export class DebtNotFoundException extends NotFoundException {
  constructor(id: string) {
    super('Debt', id);
  }
}

// app/Exceptions/Debt/DebtCannotBeCancelledException.ts
export class DebtCannotBeCancelledException extends ForbiddenException {
  constructor() {
    super('Debt has already been cancelled or confirmed');
  }
}

// app/Exceptions/Auth/InvalidCredentialsException.ts
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Email or password is incorrect');
  }
}

// app/Exceptions/User/UserAlreadyExistsException.ts
export class UserAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
  }
}
```

**Benefit:** Type-safe error handling, self-documenting code.

#### 4.3 Folder Structure Needed

```
app/Exceptions/
├── index.ts                          (Base HTTP exceptions)
├── Debt/
│   ├── DebtNotFoundException.ts
│   ├── DebtCannotBeCancelledException.ts
│   └── index.ts
├── Auth/
│   ├── InvalidCredentialsException.ts
│   ├── AccountLockedException.ts
│   └── index.ts
└── User/
    ├── UserAlreadyExistsException.ts
    ├── EmailNotVerifiedException.ts
    └── index.ts
```

---

## 5. PLUGIN FOLDER MIGRATION INCOMPLETE

### Problem: Plugins Exist in 3 Places

#### 5.1 The Three Plugin Locations

| Location | Purpose | Status |
|----------|---------|--------|
| `src/plugins/` | **OLD** location | Should be deleted |
| `src/lib/plugins/` | **CURRENT** implementation | Active/in-use |
| `src/app/Http/Middlewares/` | **NEW** location per plan | Incomplete |

#### 5.2 Details: What's Where?

**Old Location: `src/plugins/`**
```
plugins/
├── auth/
│   └── session-auth.plugin.ts    (OLD - marked for deletion in git)
└── di/
    └── container.plugin.ts       (OLD - marked for deletion in git)
```

**Current Implementation: `src/lib/plugins/`** (In use)
```
lib/plugins/
├── auth/
│   ├── index.ts
│   ├── jwt.plugin.ts            (Full JWT implementation)
│   └── session-auth.plugin.ts   (Full session + caching logic)
├── guards/
│   ├── access-control.plugin.ts
│   ├── email-verified.guard.ts
│   ├── permission.guard.ts
│   └── index.ts
├── middleware/
│   ├── cors.middleware.ts
│   ├── csrf.middleware.ts
│   ├── pagination.middleware.ts
│   ├── rate-limit.middleware.ts
│   ├── request-logger.middleware.ts
│   ├── security-headers.middleware.ts
│   └── index.ts
└── index.ts
```

**New Location Per Plan: `src/app/Http/Middlewares/`**
```
app/Http/Middlewares/
├── AuthMiddleware.ts            (MINIMAL - just validation)
├── PermissionMiddleware.ts      (STUB)
├── RateLimitMiddleware.ts       (STUB)
├── index.ts
```

#### 5.3 Why This Is a Problem

1. **Duplication of Logic:** `lib/plugins/auth/session-auth.plugin.ts` is **~150 lines**, but `app/Http/Middlewares/AuthMiddleware.ts` is only **~20 lines**. They don't match.

2. **Inconsistent Reference:** `bootstrap.ts` imports from `lib/plugins/`:
   ```typescript
   import {
     corsPlugin,
     csrfPlugin,
     sessionAuthPlugin,  // ← Using lib/plugins, not app/Http/Middlewares
     requestLoggerPlugin,
     redisPlugin,
     securityHeadersPlugin
   } from '@/lib/plugins';
   ```

3. **Plan Says:** Migrate to `app/Http/Middlewares/`, but guards and auth logic are deeper in `lib/plugins/`.

#### 5.4 Which Approach to Follow?

**Per Redesign Plan:**
- Middleware should be in `app/Http/Middlewares/` (Laravel convention)
- Guards should stay in `lib/` (API-specific security logic)

**Current:**
- Everything is in `lib/plugins/`
- Minimal stubs in `app/Http/Middlewares/`

**Action Needed:** Decide to either:
- **Option A (Align with Plan):** Move full middleware implementations to `app/Http/Middlewares/`, keep guards in `lib/security/guards/`
- **Option B (Current State):** Formalize `lib/plugins/` as the plugin hub, remove stubs from `app/Http/Middlewares/`

---

## 6. LIB FOLDER ORGANIZATION ISSUES

### Problem: Unclear Responsibilities Across `lib/` Subdirectories

#### 6.1 Current Structure

```
lib/
├── db/                     (Database utilities)
│   ├── circuit-breaker.ts
├── decorators/             (Spring Boot style decorators)
│   ├── cacheable.ts
│   ├── circuit-breaker.ts
│   ├── on-event.ts
│   ├── retryable.ts
│   ├── timed.ts
│   └── transactional.ts
├── di/                     (Dependency injection)
│   ├── container.plugin.ts (OLD - duplicate)
│   ├── index.ts
│   └── services.plugin.ts
├── health/                 (Health checks)
│   ├── index.ts
│   └── storage-readiness.ts
├── helpers/                (Pure utilities)
│   ├── debt.ts
│   ├── ... (need to check what else)
├── http/                   (HTTP layer utilities)
│   ├── circuit-breaker.ts
│   ├── error-maps/
│   │   ├── auth.ts
│   │   ├── bank.ts
│   │   ├── debt.ts
│   │   └── index.ts
│   ├── idempotency.ts
│   ├── import-status.ts
│   ├── pagination.ts
│   ├── require-auth.ts
│   ├── response.helpers.ts
│   ├── result-helper.ts
│   └── ip.ts
├── mappers/                (HTTP response mapping)
│   └── user.ts
├── plugins/                (Elysia plugins - for middleware/auth)
│   ├── auth/
│   ├── guards/
│   ├── middleware/
│   └── index.ts
├── redis/                  (Redis client & caching)
│   ├── cache.ts
│   ├── caches/
│   │   ├── import.ts
│   │   ├── jwt-blacklist.ts
│   │   ├── permission.ts
│   │   ├── session.ts
│   │   ├── user.ts
│   │   └── index.ts
│   ├── circuit-breaker.ts
│   ├── connection.ts
│   └── index.ts
├── security/               (Security utilities)
│   ├── ip/
│   │   ├── extract.ts
│   │   ├── index.ts
│   │   └── validate.ts
│   └── permissions.ts
├── validation/             (Request/input validation)
│   ├── debt.ts
│   ├── index.ts
│   └── ... (need to check)
├── index.ts
└── result.ts               (Result<T> type for error handling)
```

#### 6.2 Redundancy Issues

| Concern | Files | Problem |
|---------|-------|---------|
| Circuit Breaker | 3 files: `lib/db/`, `lib/http/`, `lib/decorators/` | Unclear when to use which |
| Redis | `lib/redis/circuit-breaker.ts` + other cache logic | Should redis logic be in `lib/cache/`? |
| Plugins | `lib/plugins/` | Is this a permanent location? |
| DI | `lib/di/` | Contains old `container.plugin.ts` (duplicate of `plugins/di/`) |
| Health | `lib/health/` | Only one file; small; could be top-level `lib/health.ts` |

#### 6.3 Questions About `lib/plugins/`, `lib/redis/`, `lib/health/`

**From Architecture Plan:**

> "Reorganize `plugins/` and place remaining in best practice locations like Redesign plan (follow Laravel principle + JS)"

**Current interpretation problems:**

1. **Should `lib/plugins/` exist?**
   - Plan says middlewares go to `app/Http/Middlewares/`
   - Plan says guards go to `lib/security/guards/` (implied)
   - **Current:** Everything is in `lib/plugins/`

2. **Should `lib/redis/` stay?**
   - It's API-specific (caching, circuit breaking)
   - Plan doesn't explicitly mention it
   - **Options:**
     - Keep as `lib/cache/` (rename for clarity)
     - Move to `lib/redis/` with clear boundaries
     - Merge caching logic into respective services

3. **Should `lib/health/` stay?**
   - Only contains `storage-readiness.ts` (1 file)
   - Could be:
     - Expand to full health aggregator (per microservices plan)
     - Delete and inline into controllers
     - Keep as minimal `lib/health.ts`

---

## 7. MISSING IMPLEMENTATIONS IN KEY AREAS

### 7.1 Mappers Inconsistency

Current mappers in `app/Http/Mappers/`:
- ✅ `debt.mapper.ts` (new)
- ✅ `user.mapper.ts` (new)
- ❌ `debt.ts` (old - should be deleted)
- ❌ `user.ts` (old - should be deleted)

**Missing mappers:**
- Activity mapper
- Bank account mapper
- Notification mapper
- etc.

#### 7.2 Repositories Missing Interfaces for Some Entities

Check `app/Repositories/Contracts/`:
- ✅ `DebtRepositoryInterface.ts`
- ✅ `UserRepositoryInterface.ts`
- ⚠️ `StorageServiceInterface.ts` (is this right naming?)
- Missing: Some repository interfaces for newer models

---

## 8. CONTROLLER FOLDER STRUCTURE

### Problem: Old Subdirectories Still Exist

```
app/Http/Controllers/
├── ActivityController.ts           (NEW - PascalCase) ✅
├── activity/                       (OLD - directory) ❌
├── AuthController.ts               (NEW)
├── auth/                           (OLD - directory) ❌
├── BankController.ts               (NEW)
├── bank/                           (OLD - directory) ❌
├── DebtController.ts               (NEW)
├── debt/                           (OLD - directory) ❌
├── ImportController.ts             (NEW)
├── import-export/                  (OLD - directory) ❌
└── ... (pattern repeats)
```

These empty subdirectories serve no purpose and should be deleted.

---

## 9. CONFIGURATION FILES ORGANIZATION

### Problem: Two Config Entry Points

| File | Status | Purpose |
|------|--------|---------|
| `src/configs.ts` | **OLD** | Large monolithic file with all configs |
| `src/config/app.ts`, `auth.ts`, etc. | **NEW** | Modular per-section configs |

**Should:** Use `src/config/` exclusively and delete `src/configs.ts` (or use it as re-export barrel).

---

## 10. HELPERS & VALIDATION

### 10.1 Helper Functions Audit

**lib/helpers/** location (should match plan):
```
lib/helpers/
├── debt.ts                 ✅ Good location
└── ... (need full inventory)
```

**lib/validation/** (request validation):
```
lib/validation/
├── debt.ts                 ✅ Good location
├── index.ts
└── ... (need full inventory)
```

#### Question: Are these all API-specific?
- Per plan: API-specific go to `lib/`, shared go to `packages/utils/`
- Need to verify: `lib/helpers/debt.ts` doesn't duplicate anything in `packages/utils/`

---

## 11. SUMMARY TABLE: What Needs Fixing

| Category | Problem | Count | Priority | Fix |
|----------|---------|-------|----------|-----|
| **Duplicate Files** | Same class, different naming | 13 pairs (26 files) | 🔴 **P0** | Delete old files |
| **Duplicate Dirs** | Empty old subdirectories | 9 directories | 🔴 **P0** | Delete (they're empty) |
| **Auth Fragmentation** | 3 Auth services with overlap | 3 services | 🟠 **P1** | Consolidate to 1 main + delegates |
| **Missing Models** | Models lack rich behavior | 4 models | 🟠 **P1** | Add domain logic methods |
| **Exceptions** | No domain-specific exceptions | 1 folder | 🟡 **P2** | Create domain exception classes |
| **Plugin Migration** | Incomplete middleware migration | 3 locations | 🟡 **P2** | Decide: Keep in lib/plugins OR move to app/Http |
| **Lib Structure** | Unclear role of health/redis/plugins | 3 folders | 🟡 **P2** | Clarify boundaries |
| **Mapper Duplication** | debt.ts + debt.mapper.ts | 2 pairs | 🟠 **P1** | Keep .mapper.ts, delete old |
| **Repository Duplication** | PascalCase + kebab-case | 9 pairs | 🔴 **P0** | Delete kebab-case versions |
| **Config Files** | configs.ts + config/ | 2 | 🟡 **P2** | Consolidate to config/ only |

---

## 12. QUICK WINS (Easy Fixes)

1. **Delete all kebab-case repositories** (9 files)
2. **Delete old snake_case services** (`debt/debt.service.ts`, `storage.service.ts`)
3. **Delete old mapper files** (`debt.ts`, `user.ts`)
4. **Delete empty controller subdirectories** (activity/, auth/, bank/, etc.)
5. **Delete old plugins folder** (`src/plugins/`) - files marked in git as deleted
6. **Clean up lib/di/** - remove duplicate `container.plugin.ts`

---

## 13. STRATEGIC DECISIONS NEEDED

### Decision 1: Auth Service Consolidation

**Current:** 3 services (AuthService, AuthSecurityService, AuthSessionService)

**Options:**
- **A:** Single `AuthService` with delegated services (per plan)
- **B:** Keep 3 but clearly separate responsibilities

**Recommendation:** Option A (follow plan).

---

### Decision 2: Plugin Migration Path

**Current:** Active code in `lib/plugins/`, stubs in `app/Http/Middlewares/`

**Options:**
- **A:** Move full implementations from `lib/plugins/` to `app/Http/Middlewares/` + `lib/security/guards/` (follow plan)
- **B:** Keep everything in `lib/plugins/`, formalize it as final location

**Recommendation:** Option A (consistency with Laravel structure).

---

### Decision 3: Rich Domain Models

**Current:** Minimal data wrappers

**Options:**
- **A:** Add business logic to models (Debt.cancel(), User.verifyEmail(), etc.)
- **B:** Keep models as DTOs, put logic in services

**Recommendation:** Option A (DDD pattern, aligns with plan).

---

### Decision 4: Redis/Health/Plugins Folders

**Current:** Unclear if temporary or final locations

**Action:**
- Clarify whether `lib/redis/`, `lib/health/`, `lib/plugins/` are final destinations
- If yes: Update ARCHITECTURE_REDESIGN_PLAN.md to document them
- If no: Plan migration to cleaner locations

**Recommendation:** Formalize final locations in updated plan.

---

## 14. ESTIMATED EFFORT

| Task | Effort | Notes |
|------|--------|-------|
| Delete duplicate files | 1-2 hours | Mechanical, high impact |
| Consolidate Auth services | 3-4 hours | Logic reorg, testing |
| Add rich model behavior | 4-6 hours | Design + impl per model |
| Create domain exceptions | 2-3 hours | Straightforward refactor |
| Migrate plugins (if doing it) | 6-8 hours | Medium complexity |
| Test entire flow | 4-5 hours | Critical |
| **Total** | **20-28 hours** | ~1 week sprint |

---

## 15. ACTIONABLE NEXT STEPS

1. ✅ **Review this audit** with team
2. ⚠️ **Make strategic decisions** (Decisions 1-4 above)
3. 🎯 **Create cleanup epic** in issue tracker
4. 🔨 **Execute Phase 1:** Delete duplicate files (quick wins)
5. 🔨 **Execute Phase 2:** Consolidate Auth services
6. 🔨 **Execute Phase 3:** Complete plugin migration
7. 📝 **Update documentation** with final structure
8. ✅ **Run full test suite** after each phase

---

## 16. APPENDIX: File-by-File Deletion List

### DELETE (Old Naming Convention)

#### Services (Old Location)
```
app/Services/debt/debt.service.ts              (612 lines - replace with DebtService.ts)
app/Services/storage.service.ts                (23 lines - replace with S3StorageService.ts)
```

#### Repositories (kebab-case)
```
app/Repositories/Database/activity.repository.ts
app/Repositories/Database/bank-account.repository.ts
app/Repositories/Database/debt.repository.ts
app/Repositories/Database/email-verification.repository.ts
app/Repositories/Database/file.repository.ts
app/Repositories/Database/import-export.repository.ts
app/Repositories/Database/notification.repository.ts
app/Repositories/Database/session.repository.ts
app/Repositories/Database/user.repository.ts
```

#### Mappers (Old Naming)
```
app/Http/Mappers/debt.ts
app/Http/Mappers/user.ts
```

#### Controllers (Empty Subdirectories)
```
app/Http/Controllers/activity/
app/Http/Controllers/auth/
app/Http/Controllers/bank/
app/Http/Controllers/debt/
app/Http/Controllers/import-export/
app/Http/Controllers/notification/
app/Http/Controllers/storage/
app/Http/Controllers/system/
app/Http/Controllers/user/
```

#### Old Plugins Location
```
plugins/auth/session-auth.plugin.ts
plugins/di/container.plugin.ts
```

#### DI Duplicates
```
lib/di/container.plugin.ts                     (Duplicate of lib/plugins structure)
```

---

## 17. APPENDIX: File Dependencies (For Safe Deletion)

**Before deleting `app/Services/debt/debt.service.ts`:**
- [ ] Search codebase for imports of this file
- [ ] Verify all code imports from `app/Services/DebtService` instead
- [ ] Update any remaining references

**Before deleting repository kebab-case files:**
- [ ] Verify no files import from them
- [ ] Check all DI registrations use PascalCase versions

---

**End of Audit Report**
