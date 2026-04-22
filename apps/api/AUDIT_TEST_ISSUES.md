# Test Issues Detail Report

**Category:** Testing Strategy and Implementation  
**Total Test Files:** 8  
**Issues Found:** 12 Major, 8 Minor

---

## Executive Summary

The test suite has **significant gaps** in:
1. **Dependency Injection testing** - Tests mock instead of using DI container
2. **UX scenario coverage** - Missing end-to-end user workflows
3. **Integration testing** - Most tests are isolated unit tests
4. **Broken imports** - Test files use incorrect path aliases

Per the architecture plan, tests should leverage the DI container for realistic service testing.

---

## 1. Excessive Mocking vs DI Usage (CRITICAL)

### 1.1 AuthService Test - Manual Mock Anti-Pattern
**File:** `tests/services/auth.service.test.ts` (Lines 12-48)

```typescript
// ANTI-PATTERN: Manual mock creation
function createMockDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => undefined
        })
      })
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: 'new-user-id', email: null, role: 'user' }]
      })
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve()
      })
    })
  };
}

// ANTI-PATTERN: Direct constructor injection with mocks
beforeEach(() => {
  mockDb = createMockDb();
  const mockDebtRepo = { linkDebtsToUser: async () => undefined } as unknown as ConstructorParameters<typeof AuthService>[1];
  const mockEmailService = {} as unknown as ConstructorParameters<typeof AuthService>[2];
  const mockVerificationService = {} as unknown as ConstructorParameters<typeof AuthService>[3];
  
  authService = new AuthService(
    mockDb as unknown as ConstructorParameters<typeof AuthService>[0],
    mockDebtRepo,
    mockEmailService,
    mockVerificationService
  );
});
```

**Problems:**

1. **Mock doesn't match real interface:**
   ```typescript
   // Mock has chainable methods but real Drizzle uses different pattern
   db.select().from().where().get()  // Mock
   db.query.users.findFirst({...})     // Real Drizzle
   ```

2. **Type assertions bypass safety:**
   ```typescript
   mockDb as unknown as ConstructorParameters<typeof AuthService>[0]
   // 'unknown' cast means no type checking!
   ```

3. **Not testing actual DI wiring:**
   - Tests bypass the DI container entirely
   - Won't catch registration errors
   - Won't catch missing @inject decorators

4. **Fragile to constructor changes:**
   - Hard-coded parameter positions
   - Changing constructor signature breaks all tests

**Architecture Plan Says:**
> Unit Tests (Services) - Demonstrates testing with dependency injection using mocked database

**Should Be:**
```typescript
// Using DI container with test doubles
import { container } from 'tsyringe';
import { AuthService } from '@/app/Services/AuthService';

describe('AuthService', () => {
  beforeEach(() => {
    // Clear container and register test doubles
    container.clearInstances();
    
    // Register mock database
    container.register('Database', {
      useValue: createTestDb()  // Returns test double matching interface
    });
    
    // Register other mocks
    container.register('DebtRepositoryInterface', {
      useClass: MockDebtRepository  // Proper class implementing interface
    });
  });

  it('should register user', async () => {
    const authService = container.resolve(AuthService);  // Full DI test
    const result = await authService.register({...});
    expect(result).toHaveProperty('data');
  });
});
```

---

### 1.2 EmailVerificationService Test - Same Pattern
**File:** `tests/services/email-verification.service.test.ts` (Lines 9-71)

```typescript
// Manual mock repository with inline data
function createMockRepos() {
  const emailVerifications: Record<string, unknown>[] = [];
  
  const emailVerificationRepo = {
    invalidateExisting: async (userId: string, email: string) => { ... },
    create: async (data: Record<string, unknown>) => { ... },
    // ... more inline implementations
  };
  
  return { emailVerificationRepo, ... };
}

// Direct service construction
service = new EmailVerificationService(
  mockRepos.emailVerificationRepo as unknown as ConstructorParameters<typeof EmailVerificationService>[0],
  mockRepos.userRepo as unknown as ConstructorParameters<typeof EmailVerificationService>[1]
);
```

**Same issues as AuthService test.**

---

## 2. Import Path Failures (HIGH)

### 2.1 @configs Import (BROKEN)
**File:** `tests/auth.test.ts` (Line 2)

```typescript
import { configs } from '@configs';  // ❌ BROKEN
```

**Error:** Module not found - `@configs` points to `src/configs/` which doesn't exist.

**Fix:**
```typescript
import { configs } from '@/config';  // ✅
```

---

### 2.2 @services/email Import (BROKEN)
**File:** `tests/services/email-verification.service.test.ts` (Line 7)

```typescript
import { EmailVerificationService } from '@services/email';  // ❌ BROKEN
```

**Problem:** `@services/email` doesn't exist. The service is at `@services/EmailVerificationService`.

**Fix:**
```typescript
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
```

---

### 2.3 @services/EmailService Import (BROKEN)
**File:** `tests/email.test.ts` (Line 10)

```typescript
import { EmailService as EmailServiceClass } from '@services/EmailService';  // ❌
```

**Fix:**
```typescript
import { EmailService } from '@/app/Services/EmailService';
```

---

## 3. Missing UX Scenario Tests (CRITICAL)

### 3.1 What Should Be Tested (Per Architecture Plan)

The architecture redesign plan specifies these test scenarios:

```typescript
// From ARCHITECTURE_REDESIGN_PLAN.md Section 9:

// 1. Debt cancellation flow
describe('Debt Cancellation Flow', () => {
  it('should cancel debt and notify debtor', async () => {
    // Creditor cancels debt
    // Debtor receives notification
    // Activity log updated
    // Cache invalidated
  });
});

// 2. Import processing with partial failures
describe('Import Processing', () => {
  it('should handle partial import failures gracefully', async () => {
    // Some rows valid, some invalid
    // Valid rows committed
    // Invalid rows logged with errors
    // Progress tracking accurate
  });
});

// 3. Rate limiting under load
describe('Rate Limiting', () => {
  it('should throttle excessive requests', async () => {
    // Rapid requests from same IP
    // 429 returned after limit
    // Reset after window
  });
});

// 4. Cache scenarios
describe('Caching', () => {
  it('should cache and invalidate correctly', async () => {
    // First request hits database
    // Second request hits cache
    // After update, cache invalidated
    // Next request hits database again
  });
});
```

### 3.2 Current Test Coverage

| Scenario | Covered | Test File |
|----------|---------|-----------|
| Auth input validation | ✅ | `auth.service.test.ts` |
| Email sending | ✅ | `email.test.ts` |
| DB connectivity | ✅ | `db.test.ts` |
| Redis connectivity | ✅ | `redis.test.ts` |
| Pagination | ✅ | `pagination.middleware.test.ts` |
| Health check | ✅ | `health.test.ts` |
| Debt cancellation | ❌ | MISSING |
| Import processing | ❌ | MISSING |
| Rate limiting | ❌ | MISSING |
| Cache scenarios | ❌ | MISSING |
| Circuit breaker | ❌ | MISSING |
| Event handling | ❌ | MISSING |

---

## 4. Test Structure Issues

### 4.1 Missing Test Utilities
**Expected:** `tests/utils/` or `tests/helpers/`

```typescript
// tests/utils/di-helpers.ts - DOES NOT EXIST
export function createTestContainer() {
  const testContainer = container.createChildContainer();
  // Setup test doubles
  return testContainer;
}

export function mockRepository<T>(interface: new () => T): T {
  // Create mock implementing interface
}
```

**Current State:** Each test file creates its own mocks inline.

---

### 4.2 Missing Integration Test Setup
**Expected:** `tests/integration/`

Integration tests should:
- Start actual server
- Use test database
- Test full request/response cycles
- Verify side effects (emails sent, notifications pushed)

**Current State:** No integration test folder exists.

---

### 4.3 Missing E2E Test Setup
**Expected:** `tests/e2e/` or `tests/scenarios/`

E2E tests should cover:
1. User registration → email verification → login
2. Create debt → counterparty notification → confirmation
3. Import file → preview → process → verify debts created
4. Push notification subscription → trigger → receive

---

## 5. Mock Quality Issues

### 5.1 Mock Database Doesn't Match Drizzle Interface
**Current Mock:**
```typescript
function createMockDb() {
  return {
    select: () => ({ from: () => ({ where: () => ({ get: () => ... }) }) })
  };
}
```

**Real Drizzle Interface:**
```typescript
// Drizzle uses different patterns:
const result = await db.query.users.findFirst({
  where: eq(users.id, userId)
});

// Or:
const result = await db.select().from(users).where(eq(users.id, userId)).get();
```

**Recommendation:** Use actual test database or proper Drizzle test utilities.

---

### 5.2 Type Assertions Mask Interface Drift
```typescript
// When interface changes, test still passes but real code breaks
mockDb as unknown as ConstructorParameters<typeof AuthService>[0]
```

**Better:**
```typescript
// Explicit interface implementation
class MockDb implements DbClient {
  // Must implement all methods
  // Type errors if interface changes
}
```

---

## 6. Test Naming and Organization

### 6.1 Inconsistent Naming
- `auth.test.ts` - Good
- `email.test.ts` - Good
- `db.test.ts` - Good
- `services/auth.service.test.ts` - Good
- `services/email-verification.service.test.ts` - Good
- `pagination.middleware.test.ts` - Good
- `opentelemetry.test.ts` - Inconsistent (should match middleware pattern)

### 6.2 Missing Test Categories

Recommended structure:
```
tests/
├── unit/                      # Unit tests (with DI)
│   ├── services/
│   ├── repositories/
│   └── models/
├── integration/               # API integration tests
│   ├── auth.integration.test.ts
│   ├── debt.integration.test.ts
│   └── import.integration.test.ts
├── scenarios/                 # UX scenario tests
│   ├── debt-lifecycle.test.ts
│   ├── import-workflow.test.ts
│   └── notification-flows.test.ts
├── e2e/                       # End-to-end tests
│   └── user-journeys.test.ts
└── utils/                     # Test utilities
    ├── di-helpers.ts
    ├── mock-factories.ts
    └── database-setup.ts
```

---

## 7. Specific Test Recommendations

### 7.1 Test the DI Container

```typescript
// tests/unit/di-container.test.ts
import { container } from 'tsyringe';
import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';

describe('DI Container', () => {
  beforeEach(() => {
    container.clearInstances();
    const provider = new AppServiceProvider();
    provider.register();
  });

  it('should resolve all services', () => {
    const services = [
      'AuthService',
      'DebtService',
      'UserService',
      // ... all services
    ];
    
    services.forEach(serviceName => {
      expect(() => container.resolve(serviceName)).not.toThrow();
    });
  });

  it('should inject dependencies correctly', () => {
    const debtService = container.resolve(DebtService);
    expect(debtService['debtRepo']).toBeDefined();  // Private access for testing
    expect(debtService['pushService']).toBeDefined();
    expect(debtService['activityService']).toBeDefined();
  });
});
```

### 7.2 Test Decorators

```typescript
// tests/unit/decorators.test.ts
import { Retryable } from '@/lib/decorators/retryable';
import { Cacheable } from '@/lib/decorators/cacheable';

describe('@Retryable', () => {
  it('should retry on failure', async () => {
    let attempts = 0;
    
    class TestService {
      @Retryable({ maxAttempts: 3, backoffMs: 10 })
      async flakyMethod() {
        attempts++;
        if (attempts < 3) throw new Error('Temporary error');
        return 'success';
      }
    }
    
    const service = new TestService();
    const result = await service.flakyMethod();
    
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### 7.3 Test Event System

```typescript
// tests/unit/events.test.ts
import { EventBus, EventServiceProvider } from '@/app/Providers/EventServiceProvider';

describe('Event System', () => {
  it('should emit and receive events', async () => {
    const bus = new EventBus();
    const received: string[] = [];
    
    bus.on('test.event', async (event) => {
      received.push(event.data);
    });
    
    await bus.emit({ type: 'test.event', data: 'payload', timestamp: new Date() });
    
    expect(received).toContain('payload');
  });
});
```

---

## 8. Fix Checklist

### Immediate (Blocking Tests)
- [ ] Fix `tests/auth.test.ts` - Change `@configs` to `@/config`
- [ ] Fix `tests/services/email-verification.service.test.ts` - Correct service import
- [ ] Fix `tests/email.test.ts` - Correct service import

### Short Term (Improve Quality)
- [ ] Create `tests/utils/di-helpers.ts` for test container setup
- [ ] Refactor `tests/services/auth.service.test.ts` to use DI container
- [ ] Refactor `tests/services/email-verification.service.test.ts` to use DI container
- [ ] Add `tests/integration/` folder with basic API tests

### Medium Term (Complete Coverage)
- [ ] Add debt lifecycle scenario tests
- [ ] Add import workflow tests
- [ ] Add notification flow tests
- [ ] Add cache behavior tests
- [ ] Add circuit breaker tests
- [ ] Add rate limiting tests

---

## Summary Table

| Issue | Severity | Files | Effort |
|-------|----------|-------|--------|
| Import path failures | Critical | 3 test files | 30 min |
| Manual mocking | High | 2 service tests | 4 hours |
| Missing DI container testing | High | All services | 6 hours |
| Missing scenario tests | Medium | New files | 12 hours |
| Missing integration tests | Medium | New folder | 8 hours |
| No test utilities | Medium | New files | 2 hours |

---

**End of Test Issues Report**
