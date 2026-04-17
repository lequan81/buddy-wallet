# Architecture Redesign Implementation Gap Analysis Report

**Date:** April 16, 2026  
**Status:** Implementation ~60% complete with critical gaps

---

## Executive Summary

The backend migration is **partially implemented** with the new Laravel+JS structure in place but incomplete:
- ✅ **Done:** Folder structure created, basic DI setup, some decorators, core services scaffolded
- ⚠️ **Half-Done:** Validation (regex vs Valibot), decorators incomplete, boot order issues
- ❌ **Missing:** Models/Enums, Requests DTOs, Middleware layer, full decorator integration, old code cleanup

---

## 1. FOLDER STRUCTURE & FILE PLACEMENT

| Item | Plan | Reality | Status | Gap |
|------|------|---------|--------|-----|
| `app/Http/Controllers/` | Migrate all controllers here | **2/11 controllers migrated** (AuthController, DebtController) | ⚠️ Partial | 9 controllers still in `controllers/` (Activity, Bank, Import, Export, etc.) |
| `app/Services/` | Migrate services here | **7 services created** (UserService, AuthService, DebtService, EmailService, SessionService, ActivityService) | ✅ Done | All moved and using `@injectable()` |
| `app/Repositories/Database/` | Move adapter implementations | **2/? repositories** (UserRepository, DebtRepository) | ⚠️ Partial | Not clear if all migrated, old `repositories/adapters/` may still exist |
| `app/Repositories/Contracts/` | Create interfaces | **Partial** (UserRepositoryInterface, DebtRepositoryInterface) | ⚠️ Partial | Structure exists but not all interfaces defined |
| `app/Models/` | Rich domain entities | **EMPTY** - Only `Enums/` folder created, no models | ❌ Missing | Debt.ts, User.ts, Activity.ts—critical for domain logic |
| `app/Http/Middleware/` | Auth, Rate Limit, CORS | **EMPTY** | ❌ Missing | Still using `plugins/middleware/` and `plugins/auth/` |
| `app/Http/Requests/` | Validation DTOs | **EMPTY** | ❌ Missing | No CreateDebtRequest, RegisterRequest, etc. |
| `app/Providers/` | Service providers | **2 providers** (AppServiceProvider, EventServiceProvider) | ✅ Done | Basic structure in place |
| `app/Exceptions/` | Custom exceptions | **EMPTY** | ❌ Missing | No DebtNotFoundException, UnauthorizedException, etc. |
| `lib/security/password.ts` | Valibot-based validation | **Regex-based** | ⚠️ Partial | Using regex patterns, not Valibot schema |
| `lib/security/ip/` | Split into extract, validate, parse | **EMPTY** (folder exists) | ❌ Missing | All IP logic still in `utils/ip.utils.ts` (245 lines single file) |
| `lib/helpers/` | Pure helper functions | **EMPTY** | ❌ Missing | Helpers still scattered in `utils/` |
| `config/` | App, auth, database configs | **EMPTY** | ❌ Missing | Still using flat `configs.ts` |
| `routes/` | Centralized route definitions | **EMPTY** | ❌ Missing | Routes defined inline in controllers and `index.ts` |

---

## 2. VALIDATION & REQUEST HANDLING

### Current: Regex-Based (❌ Not Following Plan)

```typescript
// lib/security/password.ts - Current Approach
export function validatePasswordComplexity(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (!/[A-Z]/.test(password)) errors.push('uppercase required');
  if (!/[a-z]/.test(password)) errors.push('lowercase required');
  if (!/[0-9]/.test(password)) errors.push('number required');
  // ... more regex validation
}
```

### Plan: Valibot-Based (✅ Should Be)

```typescript
// lib/security/password.ts - Expected
import { pipe, string, minLength, regex, custom } from 'valibot';

export const PasswordSchema = pipe(
  string({ errorMessage: 'Password must be a string' }),
  minLength(8, 'At least 8 characters'),
  regex(/[A-Z]/, 'At least one uppercase'),
  regex(/[a-z]/, 'At least one lowercase'),
  regex(/[0-9]/, 'At least one number'),
  regex(/[!@#$%^&*()_\-+=\[\]{};:'",.<>?\/\\|`~]/, 'At least one special char'),
  custom(v => !isCommonPassword(v), 'Too common password')
);
```

**Status:** ⚠️ **MISALIGNED** - Regex approach works but lacks Valibot integration for:
- Type safety (schema inference)
- Composability with other validations
- Better error messages
- Request-level validation in Controllers

### Missing Request DTOs (❌ Critical)

Plan requires `app/Http/Requests/`:
- `CreateDebtRequest.ts`
- `RegisterRequest.ts`
- `UpdateDebtRequest.ts`
- `ConfirmDebtRequest.ts`
- etc.

**Current:** Uses Elysia `t.Object()` inline in controllers

```typescript
// app/Http/Controllers/AuthController.ts
const RegisterSchema = t.Object({
  name: t.String({ minLength: 2 }),
  phoneNumber: t.String({ minLength: 10 }),
  password: t.String({ minLength: 8 })
});
```

**Problem:** 
- ❌ No central request validation file (like Laravel's FormRequest)
- ❌ No reuse across services
- ❌ No integration with Valibot

---

## 3. BOOTSTRAP & DI CONTAINER ORDER

### Plan Order (index_legacy.ts Structure)

```
1. Validate environment variables
2. Register service providers (AppServiceProvider → repositories, services)
3. Initialize infrastructure (Redis, DB, Telemetry)
4. Create Elysia app with global middleware
5. Register controllers
6. Boot event service provider
7. Attach route handlers
```

### Actual Order (bootstrap.ts)

```
1. Register providers
2. Boot event provider
3. Boot app provider
4. Create Elysia app with CORS only
5. Try to resolve controllers (with error fallback)
```

**Issues:**
- ❌ **Missing in bootstrap.ts:**
  - Telemetry/instrumentation initialization
  - Redis plugin initialization
  - Security headers middleware
  - CSRF protection
  - ETag middleware
  - Request/response logging
  - Health check endpoints
  - Error handling middleware
  - Rate limiting
  
- ❌ **Order mismatch:** bootstrap.ts boots minimal setup; index_legacy.ts shows full production setup

- ⚠️ **Hybrid approach:** Current codebase uses BOTH `bootstrap.ts` AND `index_legacy.ts` (not choosing one)

---

## 4. DECORATORS IMPLEMENTATION STATUS

| Decorator | File | Status | Notes |
|-----------|------|--------|-------|
| `@injectable()` | From tsyringe | ✅ Used | Applied to services correctly |
| `@inject()` | From tsyringe | ✅ Used | Correctly injecting dependencies |
| `@Retryable` | `lib/decorators/retryable.ts` | ✅ Implemented | Used on 15+ methods, works with exponential backoff |
| `@Timed` | `lib/decorators/timed.ts` | ⚠️ Created but not used | File exists, not applied to any service methods |
| `@Transactional` | `lib/decorators/transactional.ts` | ⚠️ Created but not used | File exists, not applied anywhere |
| `@Cacheable` | `lib/decorators/cacheable.ts` | ⚠️ Created but not used | File exists, designed for Redis caching but not integrated |
| `@OnEvent` | `lib/decorators/on-event.ts` | ⚠️ Created but not used | Decorator exists, EventServiceProvider auto-discovery incomplete |
| `@CircuitBreaker` | `lib/decorators/circuit-breaker.ts` | ✅ Implemented | State machine works, but not applied to external API calls |

**Issues:**
- ❌ `@Timed` never applied - no timeout protection on external API calls
- ❌ `@Transactional` never applied - no automatic transaction management
- ❌ `@Cacheable` never applied - no Redis caching integrated
- ❌ `@OnEvent` listener auto-discovery incomplete
- ⚠️ `@CircuitBreaker` not protecting EmailService, VietQR calls, Redis calls

---

## 5. SERVICES NOT ALIGNED WITH OLD STRUCTURE

### Created (app/Services/) - ✅ Present

| Service | Location | Status | Details |
|---------|----------|--------|---------|
| AuthService | `app/Services/AuthService.ts` | ✅ Migrated | Using `@injectable()`, `@Retryable`, `UserRepository` injection |
| UserService | `app/Services/UserService.ts` | ✅ Migrated | Has CRUD methods with `@Retryable` |
| DebtService | `app/Services/DebtService.ts` | ✅ Migrated | Has debt operations with `@Retryable` |
| SessionService | `app/Services/SessionService.ts` | ✅ Migrated | Session management with `@Retryable` |
| EmailService | `app/Services/EmailService.ts` | ✅ Migrated | Missing `@CircuitBreaker` on SMTP calls |
| ActivityService | `app/Services/ActivityService.ts` | ✅ Migrated | Activity tracking |

### Still in Old services/ Folder - ⚠️ Not Migrated

```
services/
├── activity/               ← Not fully migrated
├── auth/
├── bank/                   ← VietQR service - needs @CircuitBreaker
├── debt/
├── email/                  ← Duplicate of EmailService?
├── import-export/          ← Not in app/Services/
├── notification/           ← Not in app/Services/
├── storage/                ← S3/File storage - not migrated
├── system/                 ← System operations - not migrated
└── user/
```

**Issue:** ⚠️ Unclear which are legacy vs new. Have you deleted the old ones?

---

## 6. MODELS & DOMAIN LOGIC (❌ Critical Missing)

### Plan Requires (app/Models/)

```
app/Models/
├── Debt.ts                 # Rich entity with state transitions
├── User.ts                 # User with validation logic
├── Activity.ts
├── Session.ts
└── Enums/
    ├── DebtStatus.ts       # 'pending' | 'confirmed' | 'cancelled'
    ├── UserRole.ts
    └── ActivityType.ts
```

### Reality

```
app/Models/
└── Enums/
    └── (empty or only type definitions)
```

**Example from Plan (MISSING):**

```typescript
// app/Models/Debt.ts - Should exist
export class Debt {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    private _status: DebtStatus,
    public readonly debtorId: string,
    public readonly creditorId: string
  ) {}

  get status(): DebtStatus {
    return this._status;
  }

  // ✅ Business logic - REPLACES complex state machine
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new Error('Cannot cancel');
    }
    return new Debt(
      this.id,
      this.amount,
      'cancelled',  // State change
      this.debtorId,
      this.creditorId
    );
  }
}
```

**Impact:** ⚠️ Currently domain logic scattered in:
- Services (10+ methods)
- State machines (`states/`)
- Utils functions

---

## 7. MIDDLEWARE PLACEMENT MISALIGNMENT

### Plan (app/Http/Middleware/)

```
app/Http/Middleware/
├── AuthMiddleware.ts
├── RateLimitMiddleware.ts
├── CorsMiddleware.ts
├── SecurityHeadersMiddleware.ts
└── ...
```

### Reality (Still in plugins/)

```
plugins/
├── auth/
│   └── session-auth.plugin.ts           ← Should be app/Http/Middleware/AuthMiddleware.ts
├── middleware/
│   ├── cors.middleware.ts               ← Should be app/Http/Middleware/CorsMiddleware.ts
│   ├── csrf.middleware.ts
│   ├── request-logger.middleware.ts
│   ├── security-headers.middleware.ts
│   └── ...
├── guards/
├── di/
└── redis/
```

**Issue:** ❌ No cleanup - plugins folder still exists and is used in `index.ts`

---

## 8. CONFIGURATION FILES (❌ Not Migrated)

### Plan (config/ folder)

```
config/
├── app.ts                  # APP section from configs
├── auth.ts                 # AUTH section
├── database.ts
├── cache.ts
└── services.ts             # External API configs (VietQR, etc.)
```

### Reality

```
configs.ts                  # Single flat file with all configs
config/                     # Empty folder
```

**Status:** ❌ **NOT MIGRATED** - Still using monolithic `configs.ts`

---

## 9. ROUTES ORGANIZATION (❌ Not Refactored)

### Plan (routes/ folder)

```
routes/
├── api.ts                  # All API routes in one place
└── web.ts                  # If needed for non-API
```

### Reality

Routes are inline in:
- `index.ts` - Main routes
- `controllers/` - Each controller defines its routes
- No centralized route definitions

**Status:** ❌ **NOT CENTRALIZED**

---

## 10. EXCEPTIONS (❌ Missing)

### Plan (app/Exceptions/)

```
app/Exceptions/
├── DebtNotFoundException.ts
├── UnauthorizedException.ts
├── ValidationException.ts
├── CircuitBreakerException.ts
└── base/
```

### Reality

**Status:** ❌ **EMPTY** - No custom exceptions created

Currently using:
- Generic errors from `@repo/errors/backend`
- Plain Error throws
- String error codes in result types

**Missing types:**
```typescript
// Should exist but doesn't
class DebtNotFoundException extends ApiException {}
class UserConflictException extends ApiException {}
class CircuitBreakerOpenException extends ApiException {}
class ValidationException extends ApiException {}
```

---

## 11. OLD FOLDER CLEANUP STATUS

| Folder | Still Exists | Status | Action |
|--------|--------------|--------|--------|
| `controllers/` | ✅ Yes | ⚠️ Partial migration | 9/11 controllers not migrated |
| `services/` | ✅ Yes | ⚠️ Unknown (overlap?) | Unclear if duplicate or legacy |
| `plugins/` | ✅ Yes | ⚠️ Still active | Used by `index.ts` |
| `repositories/` | ✅ Yes | ⚠️ Unclear | Old adapters may still be there |
| `utils/` | ✅ Yes | ✅ Partially migrated | IP, password split attempted but incomplete |
| `states/` | ✅ Yes | ❓ Unknown | Could be deleted (replaced by models) |
| `core/` | ✅ Yes | ❓ Unknown | Health checks moved to lib? |
| `domain/` | ✅ Yes | ❓ Unknown | Replaced by app/Models? |
| `modules/` | ✅ Yes | ❓ Unknown | Old module structure, should be deleted |
| `shared/` | ✅ Yes | ⚠️ Unclear | Observability still there? May conflict with `lib/` |

**Status:** ❌ **NO CLEANUP** - Old structure still exists alongside new

---

## 12. BOOTSTRAP ORDER ISSUES

### Problem 1: Missing Global Middleware in bootstrap.ts

**Plan expects (from index_legacy.ts):**
```typescript
.use(etag())                  // Cache efficiency
.use(corsPlugin)              // Security
.use(csrfPlugin)              // Security
.use(securityHeadersPlugin)   // Security
.use(requestLoggerPlugin)     // Observability
.use(sessionAuthPlugin)       // Auth
.use(redisPlugin)             // Infrastructure
.derive(telemetry)            // Tracing
.get('/health', ...)
.get('/health/dependencies', ...)
```

**bootstrap.ts currently has:**
```typescript
.use(cors())
.get('/health', () => ({ status: 'ok' }))
```

**Status:** ❌ Missing 90% of security & observability middleware

### Problem 2: Error Handling Fallback

```typescript
try {
  const authController = container.resolve(AuthController);
  // ...
} catch (error) {
  logger.warn('Controllers not yet migrated, running in legacy mode');
}
```

**Issue:** Silently falls back to legacy controllers if DI fails

### Problem 3: Two Different Entry Points

- `index.ts` - Production-grade setup (used in deployed app)
- `bootstrap.ts` - DI bootstrapper (not integrated)

**Status:** ⚠️ Duplicate responsibility - Need to merge

---

## 13. IP UTILITIES MIGRATION STATUS

### Plan

```
lib/security/ip/
├── extract.ts              # getClientIP()
├── validate.ts             # isPrivateIP(), isTrustedProxy()
└── parse.ts                # normalizeIP()
```

### Reality

- `lib/security/ip/` folder exists but **EMPTY**
- `utils/ip.utils.ts` still has all 245 lines of code

**Status:** ❌ **NOT SPLIT** - Folder created but code not migrated

---

## 14. REPOSITORY PATTERN ALIGNMENT

### Plan

```typescript
// Interface (Contract)
interface DebtRepositoryInterface {
  findById(id: string): Promise<Debt>;
  findMany(options: FilterOptions): Promise<PaginatedResult<Debt>>;
  save(debt: Debt): Promise<Debt>;
}

// Implementation
@injectable()
class DebtRepository implements DebtRepositoryInterface {
  constructor(@inject('Database') private db: DbClient) {}
  // ...
}
```

### Reality

**Status:** ✅ **Pattern implemented**

```
app/Repositories/
├── Contracts/
│   ├── UserRepositoryInterface.ts
│   └── DebtRepositoryInterface.ts
└── Database/
    ├── UserRepository.ts    ✅ @injectable()
    └── DebtRepository.ts    ✅ @injectable()
```

**Good:** DI injection works. **Bad:** Only 2 repositories migrated, unclear if BankRepository, ActivityRepository exist.

---

## 15. VALIDATION IN SERVICES

### AuthService - Current Implementation

```typescript
@injectable()
export class AuthService {
  @Retryable({ maxAttempts: 3 })
  async register(input: RegisterInput) {
    // ✅ Uses lib/security/password for complexity
    const passwordValidation = validatePasswordComplexity(password);
    
    // ❌ Uses regex, not Valibot
    // ❌ No central request schema
    // ❌ Phone parser returns early, not validated with schema
  }
}
```

**Issues:**
- ⚠️ Each method does own validation with ad-hoc checks
- ❌ No Request DTO with Valibot schema
- ❌ No automatic input validation at controller level

---

## SUMMARY TABLE: COMPLETION STATUS

| Component | Plan | Status | Completion | Gap |
|-----------|------|--------|------------|-----|
| Folder Structure | 15 folders | Created but not populated | 40% | 9 folders empty |
| DI Container | tsyringe | Implemented | 80% | Auto-registration incomplete |
| Services | 7+ core services | Created & decorated | 85% | Missing EmailService features |
| Repositories | Interface+Implementation | 2 done | 20% | Only User & Debt, others unclear |
| Models & Enums | Rich domain entities | Empty folder | 0% | Debt.ts, User.ts, etc. critical |
| Decorators | 8 decorators | 2 used, 6 not | 25% | Only @Retryable actively used |
| Middleware | 5+ middleware | Still in plugins/ | 0% | No app/Http/Middleware/ |
| Request DTOs | Validation DTOs | Empty folder | 0% | No CreateDebtRequest, etc. |
| Validation | Valibot schemas | Regex-based | 0% | Should use Valibot |
| Exceptions | Custom exceptions | Empty | 0% | No DebtNotFound, etc. |
| Config | Split config folder | Monolithic | 0% | Still single configs.ts |
| Routes | Centralized api.ts | Inline | 0% | Routes scattered |
| Bootstrap | Comprehensive order | Minimal | 30% | Missing security, telemetry, health |
| Cleanup | Remove old folders | Not done | 0% | Old structure still exists |

**Overall:** ~30% complete, ~40% partial, ~30% missing

---

## RECOMMENDATIONS (Priority Order)

### Critical (Do First)

1. **Create Domain Models** (2-3 hours)
   - `app/Models/Debt.ts` with canBeCancelledBy(), cancel() logic
   - `app/Models/User.ts` with related logic
   - `app/Models/Enums/DebtStatus.ts` enum
   - Replaces complex state machine logic

2. **Create Request DTOs with Valibot** (3-4 hours)
   - `app/Http/Requests/CreateDebtRequest.ts`
   - `app/Http/Requests/RegisterRequest.ts`
   - Use `@repo/validation` package for schema definitions
   - Apply auto-validation in controller methods

3. **Migrate Remaining Controllers** (4-5 hours)
   - Move all 9 controllers from `controllers/` → `app/Http/Controllers/`
   - Apply `@injectable()` decorator
   - Update to use DI container

4. **Apply Unused Decorators** (2-3 hours)
   - `@Timed` on external API calls (EmailService, VietQR)
   - `@Transactional` on write operations
   - `@Cacheable` on read operations with Redis
   - `@CircuitBreaker` on all HTTP clients

5. **Fix Bootstrap Order** (2-3 hours)
   - Merge `bootstrap.ts` and `index.ts` logic
   - Proper middleware ordering: etag → CORS → CSRF → Security → Auth → Business
   - Add health checks, telemetry, logging
   - Single entry point

### High Priority (Do Second)

6. **Migrate Middleware to app/Http/Middleware/** (3-4 hours)
   - Move `plugins/middleware/` → `app/Http/Middleware/`
   - Move `plugins/auth/` → `app/Http/Middleware/`
   - Update imports in bootstrap

7. **Split lib/utils** (2-3 hours)
   - `lib/security/ip/extract.ts`, `validate.ts`, `parse.ts`
   - `lib/helpers/` for pure functions
   - `lib/validation/` for validation logic

8. **Create Custom Exceptions** (2-3 hours)
   - `app/Exceptions/DebtNotFoundException.ts`
   - `app/Exceptions/ValidationException.ts`
   - `app/Exceptions/CircuitBreakerException.ts`
   - Unit-level error handling

9. **Extract Config into config/ folder** (2-3 hours)
   - `config/app.ts`, `config/auth.ts`, `config/database.ts`
   - Split `configs.ts` into separate concerns
   - Export as modules for injection

### Medium Priority (Do Third)

10. **Centralize Routes in routes/ folder** (2-3 hours)
    - `routes/api.ts` with all API routes
    - Grouped by resource
    - Keep controllers for logic only

11. **Complete EventServiceProvider Auto-Discovery** (2-3 hours)
    - Scan `app/Services/` for `@OnEvent` decorator
    - Auto-register listeners in EventBus
    - Test with debt.cancelled → send notification

12. **Cleanup Old Folders** (1-2 hours)
    - Delete `controllers/` (after migration)
    - Delete `states/` (replaced by models)
    - Delete `domain/` if unused
    - Delete `modules/` (old structure)
    - Leave `plugins/`, `core/`, `shared/` for now (may have non-migrated logic)

13. **Update tsconfig.json Paths** (0.5 hours)
    - Add `@app/*` → `src/app/*`
    - Add `@config/*` → `src/config/*`
    - Add `@routes/*` → `src/routes/*`
    - Remove `@plugins/*` if unused

---

## File Placement Checklist

### Completed ✅
- [x] DI Container (tsyringe + container)
- [x] Core Services with @injectable()
- [x] Decorator implementations (Retryable, etc.)
- [x] Repository interfaces
- [x] Service Providers

### Partial ⚠️
- [ ] Controllers (2/11 migrated)
- [ ] Decorator usage (1/8 active)
- [ ] Validation (regex, not Valibot)
-[ ] Old folder cleanup
- [ ] Bootstrap order

### Missing ❌
- [ ] Domain Models (Debt.ts, User.ts)
- [ ] Request DTOs
- [ ] Middleware folder
- [ ] Custom Exceptions
- [ ] Config folder extraction
- [ ] Routes centralization
- [ ] IP utilities split
- [ ] 9 Controllers migration
- [ ] Production bootstrap
- [ ] Old structure deletion

---

## Next Steps

1. **Triage & Plan Sprint:**
   - Confirm which old folders can be deleted
   - Assign critical items to developers
   - Pair critical items (Models + Requests go together)

2. **Create Master Issue:**
   - Link all migration tasks
   - Track blockers (e.g., if old services still referenced)

3. **Establish Definition of Done:**
   - All old `controllers/`, `services/`, `plugins/` deleted
   - All new `app/Http/Controllers/`, `app/Services/` in use
   - Bootstrap unified and production-ready
   - All decorators properly applied
   - Test coverage for new structure

---

**Report Generated:** April 16, 2026  
**Prepared for:** Architecture Migration Review
