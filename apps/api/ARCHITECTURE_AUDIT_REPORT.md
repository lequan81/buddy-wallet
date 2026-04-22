# Backend Architecture Audit Report

**Project:** buddy-wallet/apps/api  
**Audit Date:** April 18, 2026  
**Auditor:** Cascade AI  

---

## Executive Summary

This audit identifies **critical gaps and inconsistencies** in the backend architecture redesign implementation. While the Laravel-inspired structure with DI container is in place, several key services, middlewares, and proper architectural patterns are missing or misimplemented.

### Severity Distribution
- **Critical:** 8 issues
- **High:** 12 issues
- **Medium:** 15 issues
- **Low:** 6 issues

---

## 1. Missing Critical Services (CRITICAL)

### 1.1 Missing NotificationService with @OnEvent Decorators
**Location:** `app/Services/NotificationService.ts` (DOES NOT EXIST)  
**Expected per Architecture Plan:** Yes  
**Current Status:** Events defined in EventServiceProvider but no service to handle them

**Problem:**
The architecture plan specifies a NotificationService that uses `@OnEvent` decorators to handle domain events:
- `debt.cancelled` → send notification to debtor
- `user.registered` → send welcome email
- `debt.created` → notify counterparty

**Current State:**
```typescript
// EventServiceProvider.ts - Events are defined but NO listeners registered
export class DebtCreatedEvent implements DomainEvent {
  type = 'debt.created';  // No handler registered
  // ...
}
```

**Impact:** High - Events are emitted but never handled, breaking the event-driven architecture.

**Recommendation:** Create `NotificationService.ts` with proper `@OnEvent` decorators and register it in AppServiceProvider.

---

### 1.2 Missing CachingService for @Cacheable Decorator Integration
**Location:** N/A  
**Expected:** Cache management service for Redis operations  

**Problem:**
The `@Cacheable` decorator exists at `lib/decorators/cacheable.ts` but:
1. No centralized service to manage cache keys
2. No cache invalidation strategy
3. Cache key collisions possible across different entity types
4. Redis client is injected globally via `setRedisClient()` - not via DI

**Current Implementation Issues:**
```typescript
// cacheable.ts - Global state anti-pattern
let redisClient: any = null;  // NOT via DI container
export function setRedisClient(client: any) {  // Any type - no type safety
  redisClient = client;
}
```

**Impact:** Medium - Caching works but is not maintainable or testable.

---

### 1.3 Missing CircuitBreakerService for External API Calls
**Location:** `lib/decorators/circuit-breaker.ts` and `lib/http/circuit-breaker.ts`  

**Problem:**
Circuit breaker decorator exists but:
1. State is per-decorator-instance (not shared across instances)
2. No persistence of circuit state
3. No metrics/logging of circuit breaker events
4. Missing from VietQR service integration

**Current Implementation:**
```typescript
// circuit-breaker.ts - State not shared
class CircuitBreakerState {
  private failures = 0;  // Reset on each service instance
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  // Each service instance has its own state - NOT distributed
}
```

**Impact:** Critical - Circuit breakers don't work correctly across multiple service instances.

---

## 2. Path Import Mismatches from Legacy Code (HIGH)

### 2.1 Broken Path Alias: @configs
**Location:** `tests/auth.test.ts:2`  
**Expected:** `@/config` or `@config/*` per new architecture  
**Actual:** `@configs` (points to non-existent `src/configs/`)

```typescript
// WRONG - tests/auth.test.ts
import { configs } from '@configs';  // Points to src/configs/ which doesn't exist

// CORRECT should be:
import { configs } from '@/config';  // or @config/app
```

**TsConfig Entry:**
```json
"@configs": ["./src/configs"],  // Directory doesn't exist!
```

**Impact:** High - Test files will fail to compile.

---

### 2.2 Broken Path Alias in Tests: @services/email
**Location:** `tests/services/email-verification.service.test.ts:7`  

```typescript
import { EmailVerificationService } from '@services/email';  // WRONG
```

**Expected:** `@services/EmailVerificationService` or `@/app/Services/EmailVerificationService`

**Impact:** High - Test file will fail to compile.

---

### 2.3 Inconsistent @utils Usage
**Location:** Multiple files  

The `@utils` alias points to `src/lib/` but creates semantic confusion:
```json
"@utils": ["./src/lib"],  // @utils points to lib?
```

**Usage Confusion:**
```typescript
// SystemController.ts uses both:
import { traceStore } from '@utils/trace-store';  // Points to lib/trace-store (doesn't exist)
import { configs } from '@/config';  // Correct
```

**Impact:** Medium - Code is confusing; some imports may resolve to non-existent files.

---

### 2.4 Test File Using Wrong Service Import Path
**Location:** `tests/email.test.ts:10`  

```typescript
import { EmailService as EmailServiceClass } from '@services/EmailService';  // WRONG
```

Should be:
```typescript
import { EmailService } from '@/app/Services/EmailService';
```

---

## 3. Type Definition Mismatches (HIGH)

### 3.1 INotificationRepository Interface Not Implemented
**Location:** `src/types/repositories/index.d.ts`  

```typescript
export * from './notification.repo';  // File exists
```

But looking at `PushService.ts:10`:
```typescript
import type { INotificationRepository } from '@/types/repositories';
```

**Problem:** The repository interface is defined in types but:
1. No actual implementation in `app/Repositories/Database/`
2. No contract in `app/Repositories/Contracts/`
3. PushService expects it but AppServiceProvider doesn't register it

**Impact:** Critical - PushService cannot be instantiated via DI.

---

### 3.2 Result<T> Type Inconsistency Between @repo/types and api
**Location:** Multiple services  

`@repo/types` defines:
```typescript
type Result<T> = { data: T } | { code: string; error?: string };
```

But `lib/result.ts` (from architecture plan) was supposed to provide:
```typescript
export function ok<T>(data: T): { data: T };
export function err(code: string, message?: string): { code: string; error: string };
```

**Current State:** `lib/result.ts` exists but only exports error helpers, not the Result type utilities.

**Impact:** Medium - Type consistency issues across the codebase.

---

### 3.3 DebtStatus Type Mismatch
**Location:** `app/Models/Debt.ts`  

```typescript
import type { DebtStatus } from '@repo/config';  // Should be @repo/types
```

**Problem:** DebtStatus is defined in both places with potentially different values.

---

### 3.4 Missing Type Exports in Repository Interfaces
**Location:** `app/Repositories/Contracts/*`  

**Issue:** Interfaces reference types from `@repo/db` but don't re-export them:
```typescript
// DebtRepositoryInterface.ts
import type { Debt as DebtEntity } from '@repo/db';  // Not re-exported
```

This forces consumers to import from both `@repo/db` and the interface.

---

## 4. Scaffold-Only Folders (MEDIUM)

### 4.1 lib/decorators/ - Partial Implementation
**Status:** 6 decorators exist but most are unused

| Decorator | Status | Used In |
|-----------|--------|---------|
| @Retryable | ✅ Implemented | Not used in any service |
| @Timed | ✅ Implemented | Not used in any service |
| @Transactional | ✅ Implemented | Not used in any service |
| @Cacheable | ✅ Implemented | Not used in any service |
| @OnEvent | ⚠️ Stub only | No event listeners implemented |
| @CircuitBreaker | ✅ Implemented | Not used in VietQR service |

**Impact:** Medium - Decorators exist but aren't being used, indicating incomplete migration.

---

### 4.2 lib/security/ip/ - Split but Not Fully Integrated
**Location:** `lib/security/ip/`  

Architecture plan shows this as split from old `utils/ip.utils.ts`:
```
lib/security/ip/
  ├── extract.ts    # getClientIP
  ├── validate.ts   # isPrivateIP, isTrustedProxy
  └── parse.ts      # normalizeIP
```

**Current State:**
- `extract.ts` exists and is used
- `validate.ts` and `parse.ts` exist but may not be fully utilized
- Old `utils/ip.utils.ts` reference still in some files

---

### 4.3 app/Http/Mappers/ - Only UserMapper Exists
**Location:** `app/Http/Mappers/`  

**Expected per Architecture Plan:**
```
app/Http/Mappers/
  ├── user.mapper.ts         # ✅ Exists
  └── debt.mapper.ts         # ❌ Missing
```

**Problem:** DebtController manually maps debts inline instead of using a mapper:
```typescript
// DebtController.ts - Manual mapping instead of using DebtMapper
const recentDebts = result.items.map((debt: any) => ({
  id: debt.id,
  description: debt.description,
  amount: debt.amount.toString(),
  // ...
}));
```

---

### 4.4 app/Models/Enums/ - Only DebtStatus.ts
**Location:** `app/Models/Enums/`  

**Expected:**
```
app/Models/Enums/
  ├── DebtStatus.ts    # ✅ Exists
  └── UserRole.ts      # ❌ Missing
```

UserRole is likely still being imported from elsewhere or used as string literals.

---

## 5. Validation Issues (HIGH)

### 5.1 Mixed Validation Libraries (Zod + Valibot)
**Location:** `app/Http/Requests/` vs `lib/validation/`  

**Inconsistent Usage:**
```typescript
// Requests use Zod (CreateDebtRequest.ts)
import { z } from 'zod';
export const CreateDebtRequest = z.object({...});

// Validation uses Valibot (debt.ts)
import * as v from 'valibot';
const result = v.safeParse(amountSchema, amount);
```

**Impact:** High - Two different validation libraries in use, creating confusion and inconsistency.

**Recommendation:** Standardize on one library (Valibot per architecture plan).

---

### 5.2 Missing @repo/validation Integration
**Location:** `lib/validation/debt.ts`  

Architecture plan specifies using `@repo/validation` for shared schemas:
```typescript
// Current code imports from @repo/validation
import { amountSchema, CreateDebtInputSchema, phoneSchema } from '@repo/validation';
```

But then wraps them in local validation functions instead of using them directly in services.

---

### 5.3 Validation Return Types Inconsistent
**Location:** `lib/validation/debt.ts:14-22`  

```typescript
export function validateAmount(amount: number): ErrorResult | null {
  const result = v.safeParse(amountSchema, amount);
  if (!result.success) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: result.issues[0].message  // Direct access to issues[0] - unsafe
    };
  }
  return null;
}
```

**Issues:**
1. Returns `null` for success instead of Result type
2. Direct access to `issues[0]` without checking if issues array exists
3. Inconsistent with other validation functions that return `Result<T>`

---

## 6. Test File Issues (HIGH)

### 6.1 Excessive Mocking Instead of DI (CRITICAL)
**Location:** `tests/services/auth.service.test.ts`  

```typescript
// BAD: Creating manual mocks instead of using DI container
function createMockDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => undefined
        })
      })
    })
  };
}

// Tests manually construct service with mocks
authService = new AuthService(
  mockDb as unknown as ConstructorParameters<typeof AuthService>[0],
  mockDebtRepo,
  mockEmailService,
  mockVerificationService
);
```

**Problems:**
1. Mock database structure may not match real Drizzle interface
2. Type assertions (`as unknown as`) bypass type safety
3. Not testing the actual DI container wiring
4. Tests will break when service constructor changes

**Recommendation:** Use DI container with test doubles registered, or use a test database.

---

### 6.2 Email Test Using Incorrect Import Path
**Location:** `tests/email.test.ts:10`  

```typescript
import { EmailService as EmailServiceClass } from '@services/EmailService';
// Should be: '@/app/Services/EmailService'
```

---

### 6.3 Missing UX-Focused Backend Tests
**Expected Tests (per architecture plan):**
- Debt cancellation flow (creditor cancels → debtor notified)
- Import processing with partial failures
- Rate limiting behavior under load
- Cache hit/miss scenarios
- Circuit breaker state transitions

**Current Test Coverage:**
- Basic auth validation ✅
- Email sending (integration) ✅
- DB connectivity ✅
- Redis connectivity ✅
- Pagination middleware ✅

**Missing:** Scenario-based tests that verify user workflows.

---

## 7. Architecture Misbehaviors (CRITICAL)

### 7.1 PushService Not Using @injectable()
**Location:** `app/Services/PushService.ts:15`  

```typescript
// Missing @injectable() decorator!
export class PushService {
  constructor(private notificationRepo: INotificationRepository) {
    // This service cannot be instantiated by DI container
  }
}
```

**Impact:** Critical - PushService is used by DebtService but cannot be resolved by container.

---

### 7.2 DebtService Has Missing DI Registration
**Location:** `app/Services/DebtService.ts:32-38`  

```typescript
@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    private readonly pushService: PushService,  // ❌ Not @inject-ed!
    private readonly activityService: ActivityService  // ❌ Not @inject-ed!
  ) {}
```

**Problems:**
1. `pushService` and `activityService` are not marked with `@inject()`
2. They will be `undefined` when resolved from container
3. AppServiceProvider registers services but doesn't specify dependencies

---

### 7.3 S3StorageService Registered Twice
**Location:** `app/Providers/AppServiceProvider.ts:90-104`  

```typescript
// Registered as implementation
container.register(HealthService, { useClass: HealthService });

// Also registered as named instance
container.register('UploadStorage', {
  useValue: new S3StorageService(globalS3Client, 'uploads', ...)
});
```

S3StorageService is instantiated inline AND could be resolved as class. Inconsistent pattern.

---

### 7.4 EventServiceProvider Boot Method Does Nothing
**Location:** `app/Providers/EventServiceProvider.ts:95-103`  

```typescript
async boot(): Promise<void> {
  const eventBus = container.resolve<EventBus>('EventBus');

  // Listeners will be registered when services are instantiated
  // via the @OnEvent decorator and resolved by the container
  // TODO: Implement auto-discovery
}
```

**Problem:** The boot method has a TODO but no implementation. No services actually use `@OnEvent`.

---

## 8. Redis Implementation Issues (MEDIUM)

### 8.1 RedisMiddleware Using Wrong Import Case
**Location:** `app/Http/Middlewares/Redis/RedisMiddleware.ts:8-9`  

```typescript
import { initRedis, closeRedis, getClient } from '@/lib/redis/Connection';  // Wrong case!
import { cache } from '@/lib/redis/cache';  // Wrong case!
```

Actual file names:
- `connection.ts` (lowercase)
- `cache.ts` (lowercase)

This will fail on case-sensitive file systems (Linux).

---

### 8.2 CircuitBreaker State Not Shared Across Instances
**Location:** `lib/redis/circuit-breaker.ts`  

Same issue as the HTTP circuit breaker - state is local to each instance.

---

## 9. Configuration Issues (MEDIUM)

### 9.1 Unused Path Aliases in tsconfig.json
```json
// These aliases have no corresponding directories:
"@configs": ["./src/configs"]  // Should be "./src/config"
"@domain": ["./src/domain"]   // Doesn't exist
"@shared": ["./src/shared"]   // Doesn't exist
"@modules": ["./src/modules"] // Doesn't exist
```

---

### 9.2 Mixed Import Patterns for Config
**Location:** Various files  

Some files use:
```typescript
import { configs } from '@/config';  // Aggregate import
```

Others use:
```typescript
import { appConfig } from '@/config';  // Specific import (but doesn't exist)
import { STORAGE_CONFIG } from '@repo/config';  // From shared package
```

The `src/config/index.ts` exports `configs` aggregate, but architecture plan suggests splitting into:
- `config/app.ts`
- `config/auth.ts`
- `config/database.ts`
- etc.

---

## 10. Detailed File-by-File Issues

### 10.1 Critical Files with Issues

| File | Issues |
|------|--------|
| `app/Services/PushService.ts` | Missing @injectable, uses `configs` instead of injected config |
| `app/Services/DebtService.ts` | Missing @inject on pushService and activityService |
| `app/Providers/AppServiceProvider.ts` | S3StorageService double registration |
| `app/Providers/EventServiceProvider.ts` | Boot method not implemented |
| `lib/decorators/on-event.ts` | Stub only - no real functionality |
| `tests/auth.test.ts` | Wrong import path `@configs` |
| `tests/services/email-verification.service.test.ts` | Wrong import path `@services/email` |
| `tests/email.test.ts` | Wrong import path `@services/EmailService` |

---

## 11. Recommendations Summary

### Immediate Actions (Critical)
1. Fix PushService - Add @injectable and proper DI
2. Fix DebtService dependencies - Add @inject decorators
3. Create NotificationService with @OnEvent handlers
4. Fix all broken test import paths
5. Remove or fix unused tsconfig path aliases

### Short Term (High Priority)
6. Standardize on single validation library (Valibot)
7. Implement DebtMapper for consistent mapping
8. Add INotificationRepository implementation
9. Fix RedisMiddleware import case sensitivity
10. Write scenario-based tests for UX flows

### Medium Term
11. Implement proper cache service with DI
12. Fix circuit breaker state sharing
13. Complete @OnEvent decorator auto-discovery
14. Add UserRole enum to Models/Enums/
15. Remove or implement remaining scaffold folders

---

## Appendix A: File Structure vs Architecture Plan

### ✅ Implemented Correctly
```
src/
├── app/
│   ├── Http/
│   │   ├── Controllers/     ✅ All controllers migrated
│   │   ├── Middlewares/     ✅ Rate limiting, auth, security
│   │   └── Requests/        ✅ Zod schemas (though should be Valibot)
│   ├── Services/            ✅ All services exist
│   ├── Repositories/        ✅ Contracts + Database structure
│   ├── Models/              ✅ Debt, User, Session, Activity
│   ├── Exceptions/          ✅ All exception classes
│   └── Providers/           ✅ AppServiceProvider + EventServiceProvider
├── lib/
│   ├── decorators/          ✅ All 6 decorators implemented
│   ├── redis/               ✅ Connection + caches
│   ├── validation/          ✅ Debt, import, phone validators
│   └── security/            ✅ Password, crypto, IP, permissions
└── config/                  ✅ app, auth, cache, database, services
```

### ❌ Not Implemented or Incomplete
```
src/
├── app/
│   ├── Http/
│   │   └── Mappers/         ❌ Only UserMapper, missing DebtMapper
│   ├── Models/
│   │   └── Enums/           ❌ Missing UserRole.ts
│   ├── Services/
│   │   └── NotificationService.ts  ❌ Missing entirely
│   └── Providers/
│       └── EventServiceProvider    ⚠️ Boot method not implemented
└── lib/
    └── decorators/
        └── on-event.ts      ⚠️ Stub only
```

---

## Appendix B: Import Path Reference

| Wrong (Legacy/Current) | Correct (New Architecture) |
|------------------------|---------------------------|
| `from '@configs'` | `from '@/config'` |
| `from '@services/email'` | `from '@/app/Services/EmailVerificationService'` |
| `from '@services/EmailService'` | `from '@/app/Services/EmailService'` |
| `from '@utils/trace-store'` | `from '@/lib/trace-store'` (if exists) |
| `from '@/lib/redis/Connection'` | `from '@/lib/redis/connection'` (lowercase) |

---

**End of Report**
