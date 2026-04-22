# Critical Issues Detail Report

**Priority:** Immediate Action Required  
**Total Issues:** 8 Critical, 12 High Priority

---

## 1. Dependency Injection Failures

### 1.1 PushService Not Injectable (CRITICAL)
**File:** `src/app/Services/PushService.ts`  
**Line:** 15

```typescript
// CURRENT (BROKEN):
export class PushService {  // ❌ Missing @injectable()
  constructor(private notificationRepo: INotificationRepository) {
    // notificationRepo will be undefined when resolved from container
  }
}
```

**Why It Fails:**
1. DebtService requires PushService
2. PushService is instantiated by constructor call, not by container
3. The `notificationRepo` parameter has no `@inject()` decorator
4. When DebtService is resolved, PushService gets undefined dependencies

**Fix:**
```typescript
import { injectable, inject } from 'tsyringe';
import type { INotificationRepository } from '@/types/repositories';

@injectable()
export class PushService {
  constructor(
    @inject('NotificationRepositoryInterface') 
    private notificationRepo: INotificationRepository
  ) {}
}
```

**Affected Usage:**
- `DebtService.ts` line 25: `private readonly pushService: PushService`
- Any future service trying to use PushService via DI

---

### 1.2 DebtService Partial DI Registration (CRITICAL)
**File:** `src/app/Services/DebtService.ts`  
**Lines:** 32-38

```typescript
@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface') 
    private readonly debtRepo: DebtRepositoryInterface,  // ✅ OK
    
    private readonly pushService: PushService,  // ❌ Missing @inject()
    
    private readonly activityService: ActivityService  // ❌ Missing @inject()
  ) {}
}
```

**Problem:**
- Only `debtRepo` has `@inject()` decorator
- `pushService` and `activityService` will be `undefined`
- AppServiceProvider registers DebtService but doesn't declare dependencies

**Fix:**
```typescript
@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface')
    private readonly debtRepo: DebtRepositoryInterface,
    
    @inject(PushService)  // Add decorator
    private readonly pushService: PushService,
    
    @inject(ActivityService)  // Add decorator
    private readonly activityService: ActivityService
  ) {}
}
```

**Also Required in AppServiceProvider:**
```typescript
// Register the interface
container.register('NotificationRepositoryInterface', {
  useClass: NotificationRepository  // Need to create this
});
```

---

### 1.3 INotificationRepository Not Implemented (CRITICAL)
**Missing Files:**
- `src/app/Repositories/Contracts/NotificationRepositoryInterface.ts`
- `src/app/Repositories/Database/NotificationRepository.ts`

**Current State:**
```typescript
// PushService.ts line 10
import type { INotificationRepository } from '@/types/repositories';
// This type exists in types/repositories/notification.repo.d.ts
// But no actual implementation exists!
```

**Required Implementation:**
```typescript
// Contracts/NotificationRepositoryInterface.ts
export interface NotificationRepositoryInterface {
  findByUserId(userId: string): Promise<Notification[]>;
  create(notification: NewNotification): Promise<Notification>;
  markAsRead(id: string): Promise<void>;
  // ...
}

// Database/NotificationRepository.ts
@injectable()
export class NotificationRepository implements NotificationRepositoryInterface {
  constructor(@inject('Database') private db: DbClient) {}
  // Implementation...
}
```

---

## 2. Missing Critical Services

### 2.1 NotificationService (Event Listeners)
**Missing File:** `src/app/Services/NotificationService.ts`

**Architecture Plan Requirement:**
```typescript
@injectable()
export class NotificationService {
  @OnEvent('debt.cancelled')
  async handleDebtCancelled(event: DebtCancelledEvent): Promise<void> {
    await this.sendPushNotification(event.debtorId, 'Debt cancelled');
  }

  @OnEvent('user.registered')
  @Retryable({ maxAttempts: 3 })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.sendWelcomeEmail(event.email, event.name);
  }
}
```

**Current State:** Events are defined but never handled:
- `DebtCreatedEvent` - no handler
- `DebtConfirmedEvent` - no handler
- `DebtPaidEvent` - no handler
- `DebtCancelledEvent` - no handler
- `UserRegisteredEvent` - no handler

**Impact:** Event-driven architecture is broken; events are emitted but never processed.

---

### 2.2 Cache Service for @Cacheable
**Problem:** `@Cacheable` decorator uses global state:

```typescript
// lib/decorators/cacheable.ts line 24
let redisClient: any = null;  // Global mutable state

export function setRedisClient(client: any) {  // Untyped
  redisClient = client;
}
```

**Issues:**
1. `any` type - no type safety
2. Global state - not testable
3. No cache invalidation service
4. Cache keys can collide between different entity types

**Required:**
```typescript
@injectable()
export class CacheService {
  constructor(
    @inject('RedisClient') private redis: RedisClient,
    @inject('Logger') private logger: Logger
  ) {}

  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttl: number): Promise<void>;
  async invalidate(pattern: string): Promise<void>;
  generateKey(entity: string, id: string): string;
}
```

---

## 3. Import Path Failures

### 3.1 @configs Path Alias (CRITICAL - Test Failures)
**File:** `tests/auth.test.ts` line 2

```typescript
import { configs } from '@configs';  // ❌ WRONG
```

**TsConfig:**
```json
"@configs": ["./src/configs"]  // Directory doesn't exist!
```

**Correct:**
```typescript
import { configs } from '@/config';  // ✅ Points to src/config/
// OR
import { configs } from '@config/index';  // ✅
```

---

### 3.2 @services Path Alias (CRITICAL - Test Failures)
**Files:**
- `tests/services/email-verification.service.test.ts:7`
- `tests/email.test.ts:10`

```typescript
// WRONG:
import { EmailVerificationService } from '@services/email';
import { EmailService as EmailServiceClass } from '@services/EmailService';
```

**Correct:**
```typescript
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { EmailService } from '@/app/Services/EmailService';
```

**Note:** `@services` is defined in tsconfig but should NOT be used in tests as it doesn't match the architecture pattern.

---

## 4. Circuit Breaker Failures

### 4.1 State Not Shared Across Service Instances
**File:** `lib/decorators/circuit-breaker.ts`

```typescript
export function CircuitBreaker(options: CircuitBreakerOptions) {
  const breaker = new CircuitBreakerState(options);  // ❌ New instance per decoration!
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Each decorated method gets its own CircuitBreakerState
    // This means state is NOT shared across service instances
  };
}
```

**Problem:**
- If `VietQRService` has 3 methods with `@CircuitBreaker`
- Each method gets its own CircuitBreakerState
- One method can be OPEN while another is CLOSED
- Same service instance doesn't share circuit state

**Required Fix:**
```typescript
// Use a singleton state manager
const circuitStates = new Map<string, CircuitBreakerState>();

export function CircuitBreaker(options: CircuitBreakerOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const key = `${target.constructor.name}.${propertyKey}`;
    if (!circuitStates.has(key)) {
      circuitStates.set(key, new CircuitBreakerState(options));
    }
    const breaker = circuitStates.get(key)!;
    // ... use breaker
  };
}
```

---

## 5. Case Sensitivity Issues (Linux Deployment Risk)

### 5.1 RedisMiddleware Import Case
**File:** `app/Http/Middlewares/Redis/RedisMiddleware.ts` lines 8-9

```typescript
// WRONG (Windows-friendly, Linux-broken):
import { initRedis } from '@/lib/redis/Connection';  // 'Connection' != 'connection'
import { cache } from '@/lib/redis/cache';           // 'cache' == 'cache' ✓
```

**Actual File Names (lowercase):**
- `src/lib/redis/connection.ts`
- `src/lib/redis/cache.ts`

**Fix:**
```typescript
import { initRedis } from '@/lib/redis/connection';  // lowercase
```

---

## Immediate Action Checklist

- [ ] Fix PushService - Add @injectable and @inject decorators
- [ ] Fix DebtService - Add @inject to pushService and activityService
- [ ] Create NotificationRepository and NotificationRepositoryInterface
- [ ] Register NotificationRepository in AppServiceProvider
- [ ] Create NotificationService with @OnEvent handlers
- [ ] Fix tests/auth.test.ts - Change @configs to @/config
- [ ] Fix tests/services/email-verification.service.test.ts - Correct import path
- [ ] Fix tests/email.test.ts - Correct import path
- [ ] Fix RedisMiddleware import case
- [ ] Fix CircuitBreaker state sharing
- [ ] Add @injectable() to all services that are injected

---

**Estimated Fix Time:** 4-6 hours for critical issues only
