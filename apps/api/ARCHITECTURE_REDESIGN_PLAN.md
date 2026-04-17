# Backend Architecture Redesign Plan

## Executive Summary

**Laravel-inspired structure** + **JS framework familiarity** + **Spring Boot-like DI** (simplified).

This plan merges the best of three worlds:
- **Laravel**: `app/Http/`, `app/Services/`, `app/Repositories/` structure
- **JS frameworks**: `lib/` for utilities (React/Vue/Next.js convention)
- **Spring Boot**: Decorators for DI, transactions, caching, retries

---

## 1. New Folder Structure (Laravel + JS)

```
src/
├── app/                              # Laravel convention - all application code
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.ts     # Was: controllers/auth/auth.controller.ts
│   │   │   ├── DebtController.ts     # Was: controllers/debt/debts.controller.ts
│   │   │   └── UserController.ts
│   │   ├── Middlewares/
│   │   │   ├── AuthMiddleware.ts     # Was: plugins/auth/session-auth.plugin.ts
│   │   │   ├── RateLimitMiddleware.ts
│   │   │   └── CorsMiddleware.ts
│   │   └── Requests/                 # Validation DTOs (Laravel: FormRequest)
│   │       ├── CreateDebtRequest.ts
│   │       └── RegisterRequest.ts
│   │
│   ├── Services/                     # Business logic
│   │   ├── AuthService.ts            # Was: services/auth/auth-core.service.ts
│   │   ├── DebtService.ts            # Was: services/debt/debt.service.ts
│   │   └── EmailService.ts
│   │
│   ├── Repositories/                 # Data access
│   │   ├── Contracts/                # Interfaces (Laravel: Contracts)
│   │   │   ├── UserRepositoryInterface.ts
│   │   │   └── DebtRepositoryInterface.ts
│   │   └── Database/                 # Implementations
│   │       ├── UserRepository.ts     # Was: repositories/adapters/user.drizzle-adapter.ts
│   │       └── DebtRepository.ts
│   │
│   ├── Models/                       # Rich domain entities
│   │   ├── Debt.ts                   # Business logic + state transitions
│   │   ├── User.ts
│   │   └── Enums/
│   │       ├── DebtStatus.ts         # Was: states/ folder
│   │       └── UserRole.ts
│   │
│   ├── Exceptions/                   # Custom errors
│   │   ├── DebtNotFoundException.ts
│   │   └── UnauthorizedException.ts
│   │
│   └── Providers/                    # Laravel: Service Providers
│       ├── AppServiceProvider.ts     # DI registration
│       ├── EventServiceProvider.ts
│       └── RouteServiceProvider.ts
│
├── lib/                              # JS convention - utilities (React/Vue familiar)
│   ├── helpers/                      # Pure helper functions
│   │   ├── array.ts                  # chunk, groupBy, unique
│   │   ├── date.ts                   # formatDate, parseISO
│   │   ├── string.ts                 # slugify, truncate
│   │   └── number.ts                 # formatCurrency, round
│   │
│   ├── security/                     # Security utilities
│   │   ├── password.ts               # Was: utils/password.utils.ts
│   │   ├── crypto.ts                 # Was: utils/crypto.utils.ts
│   │   └── ip/
│   │       ├── extract.ts            # getClientIP
│   │       ├── validate.ts           # isPrivateIP, isTrustedProxy
│   │       └── parse.ts              # normalizeIP
│   │
│   ├── validation/                   # Validation helpers
│   │   ├── phone.ts                  # Was: utils/phone.utils.ts
│   │   └── request.ts
│   │
│   ├── db/                           # Database utilities
│   │   └── circuit-breaker.ts      # DB-specific circuit breaker (connection failures)
│   │
│   ├── http/                         # HTTP client utilities
│   │   └── circuit-breaker.ts      # External API circuit breaker (VietQR, Email)
│   │
│   ├── mappers/                      # Data transformation
│   │   └── user.ts                   # Was: utils/user-mapping.utils.ts
│   │
│   └── result.ts                     # Was: core/error/error-factory.ts
│
├── config/                           # Laravel convention
│   ├── app.ts                        # Was: configs.ts (APP section)
│   ├── auth.ts                       # Was: configs.ts (AUTH section)
│   ├── database.ts
│   ├── cache.ts
│   └── services.ts                   # External API configs
│
├── routes/                           # Laravel convention
│   ├── api.ts                        # All API route definitions
│   └── web.ts                        # Web routes (if any)
│  
├── decorators/                       # Generic decorators for all services
│   ├── retryable.ts                  # @Retryable - exponential backoff
│   ├── timed.ts                      # @Timed - timeout handling
│   ├── transactional.ts              # @Transactional - DB transactions
│   ├── cacheable.ts                  # @Cacheable - Redis caching
│   ├── on-event.ts                   # @OnEvent - event listeners
│   └── circuit-breaker.ts          # @CircuitBreaker - generic for ANY external call
│
├── bootstrap.ts                      # Application bootstrap (Laravel: bootstrap/app.php)
└── main.ts                           # Entry point
```

### Naming Conventions (JS Frameworks Familiar)

| Current (Inconsistent) | New (JS + Laravel) | Reason |
|------------------------|-------------------|--------|
| `controllers/debt/debts.controller.ts` | `app/Http/Controllers/DebtController.ts` | PascalCase, singular |
| `services/debt/debt.service.ts` | `app/Services/DebtService.ts` | PascalCase, no nesting |
| `utils/password.utils.ts` | `lib/security/password.ts` | Category-based |
| `utils/ip.utils.ts` (245 lines) | `lib/security/ip/*.ts` | Split by concern |
| `core/error/error-factory.ts` | `lib/result.ts` | Top-level utility |
| `repositories/adapters/` | `app/Repositories/Database/` | Clearer intent |

---

## 2. DI Container (Spring Boot Simplified)

### 2.1 Installation

```bash
bun add tsyringe reflect-metadata
```

### 2.2 Auto-Registration (No Manual Wiring)

```typescript
// bootstrap.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { glob } from 'glob';
import path from 'path';

// Auto-scan and register all @injectable classes
export async function bootstrap() {
  // Scan Services
  const services = await glob('app/Services/**/*.ts', { cwd: __dirname });
  for (const file of services) {
    const module = await import(path.join(__dirname, file));
    const ServiceClass = Object.values(module).find((v) => 
      typeof v === 'function' && Reflect.getMetadata('design:paramtypes', v)
    );
    if (ServiceClass) {
      container.register(ServiceClass.name, { useClass: ServiceClass });
    }
  }

  // Scan Repositories
  const repositories = await glob('app/Repositories/Database/**/*.ts', { cwd: __dirname });
  for (const file of repositories) {
    const module = await import(path.join(__dirname, file));
    const RepoClass = Object.values(module).find((v) =>
      typeof v === 'function' && v.name.endsWith('Repository')
    );
    if (RepoClass) {
      // Register implementation against interface
      const interfaceName = RepoClass.name.replace('Repository', 'RepositoryInterface');
      container.register(interfaceName, { useClass: RepoClass });
    }
  }
}
```

### 2.3 Service with Auto DI

```typescript
// app/Services/DebtService.ts
import { injectable, inject } from 'tsyringe';
import type { DebtRepositoryInterface } from '../Repositories/Contracts/DebtRepositoryInterface';
import { Debt } from '../Models/Debt';

@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface') private debtRepo: DebtRepositoryInterface,
    @inject('EventBus') private eventBus: EventBus
  ) {}

  async cancelDebt(debtId: string, userId: string): Promise<Result<void>> {
    const debt = await this.debtRepo.findById(debtId);
    if (!debt) return err('DEBT_NOT_FOUND');

    // Rich domain model handles business logic
    if (!debt.canBeCancelledBy(userId)) {
      return err('UNAUTHORIZED');
    }

    const cancelled = debt.cancel();
    await this.debtRepo.save(cancelled);
    await this.eventBus.emit(new DebtCancelledEvent(debtId));

    return ok();
  }
}
```

### 2.4 Controller with DI

```typescript
// app/Http/Controllers/DebtController.ts
import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { DebtService } from '../../Services/DebtService';

@injectable()
export class DebtController {
  constructor(
    @inject(DebtService) private debtService: DebtService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/debts', (router) =>
      router
        .get('/', async ({ user }) => {
          const result = await this.debtService.getDebtsForUser(user.id);
          return { data: result };
        })
        .post('/:id/cancel', async ({ params, user }) => {
          const result = await this.debtService.cancelDebt(params.id, user.id);
          if (result.error) return { error: result.error };
          return { success: true };
        })
    );
  }
}
```

---

## 3. Spring Boot-Like Decorators (Simplified)

Location: `lib/decorators/` - simple, reusable, less complex than Spring.

### 3.1 @Retryable

```typescript
// lib/decorators/retryable.ts
import { logger } from '@repo/logger';

interface RetryableOptions {
  maxAttempts?: number;      // Default: 3
  backoffMs?: number;        // Default: 1000
  maxBackoffMs?: number;       // Default: 10000
  retryableErrors?: string[];  // Default: all errors
}

export function Retryable(options: RetryableOptions = {}) {
  const { maxAttempts = 3, backoffMs = 1000, maxBackoffMs = 10000, retryableErrors } = options;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      const className = target.constructor.name;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          const isRetryable = retryableErrors
            ? retryableErrors.some(e => lastError.message.includes(e))
            : true;

          if (!isRetryable || attempt === maxAttempts) {
            logger.warn(`${className}.${propertyKey} failed after ${attempt} attempts`, {
              error: lastError.message
            });
            throw lastError;
          }

          const backoff = Math.min(backoffMs * Math.pow(2, attempt - 1), maxBackoffMs);
          logger.debug(`${className}.${propertyKey} retry ${attempt}/${maxAttempts} after ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}
```

### 3.2 @Timed

```typescript
// lib/decorators/timed.ts
export function Timed(ms: number, fallback?: () => any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(() => {
            if (fallback) {
              resolve(fallback());
            } else {
              reject(new Error(`${target.constructor.name}.${propertyKey} timeout after ${ms}ms`));
            }
          }, ms)
        )
      ]);
    };

    return descriptor;
  };
}
```

### 3.3 @Transactional

```typescript
// lib/decorators/transactional.ts
import { db } from '@repo/db';

export function Transactional() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return await db.transaction(async (trx) => {
        // Inject transaction as last argument
        return await originalMethod.apply(this, [...args, trx]);
      });
    };

    return descriptor;
  };
}
```

### 3.4 @Cacheable

```typescript
// lib/decorators/cacheable.ts
import { redis } from '../db/redis';

interface CacheableOptions {
  key: string;
  ttl: number;  // seconds
}

export function Cacheable(options: CacheableOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${options.key}:${args.map(a => String(a)).join(':')}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) return JSON.parse(cached);
      
      const result = await originalMethod.apply(this, args);
      await redis.setex(cacheKey, options.ttl, JSON.stringify(result));
      return result;
    };

    return descriptor;
  };
}
```

### 3.5 @OnEvent (Event Listener)

```typescript
// lib/decorators/on-event.ts
import 'reflect-metadata';

export function OnEvent(eventName: string) {
  return function (target: any, propertyKey: string) {
    const existing = Reflect.getMetadata('eventListeners', target.constructor) || [];
    existing.push({ event: eventName, handler: propertyKey });
    Reflect.defineMetadata('eventListeners', existing, target.constructor);
  };
}
```

### 3.6 Decorator Usage Examples

```typescript
// app/Services/EmailService.ts
import { injectable } from 'tsyringe';
import { Retryable } from '@/lib/decorators/retryable';
import { Timed } from '@/lib/decorators/timed';
import { CircuitBreaker } from '@/lib/decorators/circuit-breaker';

@injectable()
export class EmailService {
  @Retryable({ maxAttempts: 3, retryableErrors: ['ECONNRESET', 'ETIMEDOUT'] })
  @Timed(30000)
  @CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000 })
  async sendEmail(message: EmailMessage): Promise<void> {
    // SMTP logic - auto retry, timeout, circuit breaker
  }

  @Retryable({ maxAttempts: 5 })
  @Timed(10000)
  async callVietQRApi(iban: string): Promise<BankInfo> {
    // External API call
  }
}
```

```typescript
// app/Services/NotificationService.ts
import { injectable } from 'tsyringe';
import { OnEvent } from '@/lib/decorators/on-event';

@injectable()
export class NotificationService {
  // Auto-registered event listener via EventServiceProvider
  @OnEvent('debt.cancelled')
  async handleDebtCancelled(event: DebtCancelledEvent): Promise<void> {
    await this.sendPushNotification(event.debtorId, `Debt cancelled by creditor`);
  }

  @OnEvent('user.registered')
  @Retryable({ maxAttempts: 3 })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.sendWelcomeEmail(event.email, event.name);
  }
}
```

---

## 4. Rich Domain Models (Laravel Eloquent Style)

### 4.1 Entity with Business Logic

```typescript
// app/Models/Debt.ts
import type { DebtStatus } from './Enums/DebtStatus';

export class Debt {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly debtorId: string,
    public readonly creditorId: string,
    private _status: DebtStatus,
    public readonly createdAt: Date,
    public readonly description?: string
  ) {}

  get status(): DebtStatus {
    return this._status;
  }

  // Business logic methods
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  canBeConfirmedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new Error('Debt cannot be cancelled');
    }
    return new Debt(
      this.id, this.amount, this.currency,
      this.debtorId, this.creditorId, 'cancelled',
      this.createdAt, this.description
    );
  }

  confirm(): Debt {
    if (this._status !== 'pending') {
      throw new Error('Only pending debts can be confirmed');
    }
    return new Debt(
      this.id, this.amount, this.currency,
      this.debtorId, this.creditorId, 'confirmed',
      this.createdAt, this.description
    );
  }

  // Derived properties
  isOverdue(): boolean {
    const daysSinceCreated = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return this._status === 'pending' && daysSinceCreated > 30;
  }

  getDirectionForUser(userId: string): 'owed' | 'owing' | null {
    if (this.creditorId === userId) return 'owed';
    if (this.debtorId === userId) return 'owing';
    return null;
  }
}
```

### 4.2 Repository Interface (Laravel: Contracts)

```typescript
// app/Repositories/Contracts/DebtRepositoryInterface.ts
import type { Debt } from '../../Models/Debt';

export interface DebtRepositoryInterface {
  findById(id: string): Promise<Debt | null>;
  findByIds(ids: string[]): Promise<Debt[]>;
  findMany(options: DebtFilterOptions): Promise<PaginatedResult<Debt>>;
  save(debt: Debt): Promise<Debt>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<{ total: number; pending: number }>;
}
```

### 4.3 Repository Implementation

```typescript
// app/Repositories/Database/DebtRepository.ts
import { injectable, inject } from 'tsyringe';
import { eq, and } from '@repo/db';
import type { DebtRepositoryInterface } from '../Contracts/DebtRepositoryInterface';
import { Debt } from '../../Models/Debt';

@injectable()
export class DebtRepository implements DebtRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async findById(id: string): Promise<Debt | null> {
    const row = await this.db.query.debts.findFirst({
      where: eq(debts.id, id)
    });
    return row ? this.toDomain(row) : null;
  }

  async save(debt: Debt): Promise<Debt> {
    const row = await this.db.insert(debts)
      .values({
        id: debt.id,
        amount: debt.amount,
        currency: debt.currency,
        debtorId: debt.debtorId,
        creditorId: debt.creditorId,
        status: debt.status,
        createdAt: debt.createdAt
      })
      .onConflictDoUpdate({
        target: debts.id,
        set: { status: debt.status }
      })
      .returning();
    
    return this.toDomain(row);
  }

  private toDomain(row: DebtRow): Debt {
    return new Debt(
      row.id,
      row.amount,
      row.currency,
      row.debtorId,
      row.creditorId,
      row.status,
      row.createdAt,
      row.description
    );
  }
}
```

### 4.4 Integration with Shared Packages

Since `buddy-wallet` has shared packages (`packages/db`, `packages/schemas`), use this pattern:

```typescript
// packages/db/schema/debts.ts
export const debts = pgTable('debts', {
  id: uuid('id').primaryKey(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  debtorId: uuid('debtor_id').notNull(),
  creditorId: uuid('creditor_id').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type DebtRow = typeof debts.$inferSelect;
```

```typescript
// apps/api/app/Models/Debt.ts
import type { DebtRow } from '@repo/db';

export class Debt {
  constructor(private data: DebtRow) {}
  
  // Getters delegate to raw data
  get id() { return this.data.id; }
  get amount() { return this.data.amount; }
  get status() { return this.data.status; }
  
  // Rich domain behavior
  canBeCancelledBy(userId: string): boolean {
    return this.data.creditorId === userId && this.data.status === 'pending';
  }
  
  cancel(): Debt {
    if (!this.canBeCancelledBy(this.data.creditorId)) {
      throw new Error('Debt cannot be cancelled');
    }
    return new Debt({ ...this.data, status: 'cancelled' });
  }
  
  // Factory methods
  static fromRow(row: DebtRow): Debt {
    return new Debt(row);
  }
  
  toRow(): DebtRow {
    return this.data;
  }
}
```

**Package Responsibilities:**

| Package | Contents | API App Usage |
|---------|----------|---------------|
| `packages/db` | Drizzle schema, migrations, types | Import types, use in Repository |
| `packages/schemas` | Zod/Valibot validation | Use in `app/Http/Requests/` |
| `packages/utils` | Shared pure helpers | Use for cross-app concerns |
| `apps/api/app/Models` | Rich domain entities | Business logic + behavior |
| `apps/api/lib` | API-specific utilities | Request handling, security |

---

### 4.5 Local `lib/` vs Shared `packages/utils`

**Decision Matrix:**

| Move to Local `apps/api/lib/` | Keep in Shared `packages/utils` |
|------------------------------|--------------------------------|
| IP extraction, proxy handling | Phone normalization (web+api) |
| Password validation (API auth) | Date formatting (UI+API) |
| Request-specific crypto (JWT) | Array helpers (chunk, groupBy) |
| HTTP layer mappers | Currency formatting |
| API circuit breakers | Generic hashing |

**File Structure:**

```
packages/utils/
  ├── string.ts              # slugify, truncate (shared)
  ├── date.ts                # formatISO, parseDate (shared)
  ├── number.ts              # formatCurrency (shared)
  ├── array.ts               # chunk, groupBy (shared)
  └── phone.ts               # normalizePhoneNumber (shared)

apps/api/lib/
  ├── security/
  │   ├── ip/
  │   │   ├── extract.ts     # API-only: getClientIP
  │   │   ├── validate.ts    # API-only: isTrustedProxy
  │   │   └── parse.ts       # API-only: normalizeIP
  │   ├── password.ts        # API-only: validatePassword
  │   └── crypto.ts          # API-only: JWT, sessions
  ├── validation/
  │   └── request.ts         # API-only: body/params validation
  └── decorators/
      ├── retryable.ts
      ├── timed.ts
      ├── transactional.ts
      └── on-event.ts

apps/api/app/Http/Mappers/
  ├── user.mapper.ts         # User → SafeUser response
  └── debt.mapper.ts         # Debt → DebtResponse
```

**Rule of Thumb:**
- **Multiple apps use it** → `packages/utils/`
- **API-only concern** → `apps/api/lib/`
- **HTTP response formatting** → `apps/api/app/Http/Mappers/`

---

## 5. Service Providers (Laravel Pattern)

```typescript
// app/Providers/AppServiceProvider.ts
import { container } from 'tsyringe';
import { UserRepository } from '../Repositories/Database/UserRepository';
import { UserRepositoryInterface } from '../Repositories/Contracts/UserRepositoryInterface';
import { DebtRepository } from '../Repositories/Database/DebtRepository';
import { DebtRepositoryInterface } from '../Repositories/Contracts/DebtRepositoryInterface';

export class AppServiceProvider {
  register(): void {
    // Bind interfaces to implementations
    container.register(UserRepositoryInterface, { useClass: UserRepository });
    container.register(DebtRepositoryInterface, { useClass: DebtRepository });
    
    // Singleton services
    container.register('EventBus', { useValue: new SimpleEventBus() });
  }

  boot(): void {
    // Boot logic after all registrations
  }
}
```

### 5.2 EventServiceProvider (Auto-Discovery)

```typescript
// app/Providers/EventServiceProvider.ts
import { container } from 'tsyringe';
import { glob } from 'glob';
import 'reflect-metadata';

export class EventServiceProvider {
  async boot(): Promise<void> {
    const eventBus = container.resolve<EventBus>('EventBus');
    
    // Auto-discover @OnEvent handlers from Services
    const serviceFiles = await glob('app/Services/**/*.ts', { cwd: __dirname + '/../..' });
    
    for (const file of serviceFiles) {
      const module = await import(file);
      const ServiceClass = Object.values(module).find(
        (v): v is new (...args: any[]) => any => typeof v === 'function'
      );
      
      if (!ServiceClass) continue;
      
      const listeners = Reflect.getMetadata('eventListeners', ServiceClass) || [];
      const instance = container.resolve(ServiceClass);
      
      for (const { event, handler } of listeners) {
        eventBus.on(event, instance[handler].bind(instance));
      }
    }
  }
}
```

---

## 6. Application Bootstrap

```typescript
// bootstrap.ts
import 'reflect-metadata';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { AppServiceProvider } from './app/Providers/AppServiceProvider';
import { AuthController } from './app/Http/Controllers/AuthController';
import { DebtController } from './app/Http/Controllers/DebtController';

export async function bootstrap() {
  // 1. Register service providers
  const appProvider = new AppServiceProvider();
  appProvider.register();
  appProvider.boot();

  // 2. Create Elysia app
  const app = new Elysia()
    .use(cors())
    .use(helmet())
    .use(rateLimiter())
    .get('/health', healthCheck);

  // 3. Register routes
  const authController = container.resolve(AuthController);
  const debtController = container.resolve(DebtController);

  app.group('/v1', (api) =>
    api
      .use(authController.register)
      .use(debtController.register)
  );

  return app;
}
```

```typescript
// main.ts
import { bootstrap } from './bootstrap';

async function main() {
  const app = await bootstrap();
  
  app.listen(config.APP.PORT, () => {
    console.log(`API running at http://localhost:${config.APP.PORT}`);
  });
}

main();
```

---

## 7. Migration Strategy

### Phase 1: Setup (Week 1)
1. Install `tsyringe` + `reflect-metadata`
2. Create new folder structure (`app/`, `lib/`, `config/`, `routes/`)
3. Create `bootstrap.ts` with auto-registration
4. Implement core decorators (`@Retryable`, `@Timed`, `@Transactional`)
5. Update `tsconfig.json` path aliases:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@app/*": ["src/app/*"],
      "@lib/*": ["src/lib/*"],
      "@config/*": ["src/config/*"]
    }
  }
}
```

### Phase 2: Utils Migration (Week 1-2)
1. Move `utils/password.utils.ts` → `lib/security/password.ts`
2. Move `utils/crypto.utils.ts` → `lib/security/crypto.ts`
3. Split `utils/ip.utils.ts` → `lib/security/ip/*.ts`
4. Move `utils/phone.utils.ts` → `lib/validation/phone.ts`
5. Move `core/error/error-factory.ts` → `lib/result.ts`

### Phase 3: Auth Module (Week 2)
1. Create `app/Repositories/Contracts/UserRepositoryInterface.ts`
2. Move `repositories/adapters/user.drizzle-adapter.ts` → `app/Repositories/Database/UserRepository.ts`
3. Move `services/auth/auth-core.service.ts` → `app/Services/AuthService.ts`
4. Move `controllers/auth/auth.controller.ts` → `app/Http/Controllers/AuthController.ts`
5. Update to use `@injectable()` and auto-DI

### Phase 4: Debt Module (Week 3)
1. Create `app/Models/Debt.ts` with rich domain logic
2. Migrate debt repository, service, controller
3. Replace state machine with entity methods

### Phase 5: Remaining Modules (Week 4)
1. User module
2. Notification module  
3. Import/Export module

### Phase 6: Cleanup (Week 5)
1. Delete old `controllers/`, `services/`, `repositories/`, `utils/`, `states/` folders
2. Run full test suite
3. Update documentation

---

## 8. Architecture Rationale

### Why This Hybrid Structure?

| Pure DDD/Clean Architecture | Laravel | This Hybrid | Benefit |
|----------------------------|---------|-------------|---------|
| 15+ folders per feature | 4 folders per feature | 5 folders per feature | Simplicity |
| Complex DI setup | Service Container | tsyringe auto-DI | Familiar to JS devs |
| Anemic domain models | Rich Eloquent models | Rich TypeScript classes | Testable business logic |
| Separate `utils/` folder | Helper functions | `lib/` (JS convention) | React/Vue devs feel at home |
| EventBus interface | Laravel Events | `@OnEvent` decorator | Simple, type-safe |

**Design Goals:**
1. **Laravel developers** recognize `app/Http/`, `app/Services/`, Service Providers
2. **React/Vue developers** recognize `lib/` folder for utilities
3. **Spring Boot developers** recognize `@Retryable`, `@Transactional`, `@Timed`
4. **ElysiaJS** stays lightweight - no over-engineering
5. **Monorepo-aware** - respects `packages/db`, `packages/utils` boundaries

### CircuitBreaker Clarification

**Three levels of circuit breaking:**

1. **Generic Decorator** (`lib/decorators/circuit-breaker.ts`): For HTTP/API calls (VietQR, Email, etc.)
2. **DB-Specific** (`lib/db/circuit-breaker.ts`): Database connection failures
3. **HTTP-Specific** (`lib/http/circuit-breaker.ts`): External HTTP service monitoring

### CircuitBreaker Implementation

```typescript
// lib/decorators/circuit-breaker.ts (Generic for all external services)
interface CircuitBreakerOptions {
  failureThreshold: number;    // Open after N failures
  resetTimeoutMs: number;    // Try half-open after MS
}

class CircuitBreakerState {
  private failures = 0;
  private lastFailure?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private options: CircuitBreakerOptions) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure! > this.options.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
}

export function CircuitBreaker(options: CircuitBreakerOptions) {
  const breaker = new CircuitBreakerState(options);
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!breaker.canExecute()) {
        throw new Error(`Circuit breaker OPEN for ${target.constructor.name}.${propertyKey}`);
      }
      
      try {
        const result = await original.apply(this, args);
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();
        throw error;
      }
    };
  };
}
```

---

## 9. Testing Strategy (Laravel + JS Style)

### Unit Tests (Services)

```typescript
// tests/Unit/Services/DebtService.test.ts
describe('DebtService', () => {
  let service: DebtService;
  let mockRepo: Mock<DebtRepositoryInterface>;
  let mockEvents: Mock<EventBus>;

  beforeEach(() => {
    mockRepo = createMock<DebtRepositoryInterface>();
    mockEvents = createMock<EventBus>();
    service = new DebtService(mockRepo, mockEvents);
  });

  it('should cancel debt when creditor requests', async () => {
    const debt = new Debt('1', 100, 'USD', 'user2', 'user1', 'pending', new Date());
    mockRepo.findById.mockResolvedValue(debt);

    const result = await service.cancelDebt('1', 'user1');

    expect(result.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should fail when debtor tries to cancel', async () => {
    const debt = new Debt('1', 100, 'USD', 'user2', 'user1', 'pending', new Date());
    mockRepo.findById.mockResolvedValue(debt);

    const result = await service.cancelDebt('1', 'user2');

    expect(result.error).toBe('UNAUTHORIZED');
  });
});
```

### Integration Tests (Repositories)

```typescript
// tests/Integration/Repositories/DebtRepository.test.ts
describe('DebtRepository', () => {
  let repo: DebtRepository;
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new DebtRepository(db);
  });

  it('should persist and retrieve debt', async () => {
    const debt = new Debt('1', 100, 'USD', 'user2', 'user1', 'pending', new Date());
    await repo.save(debt);

    const found = await repo.findById(debt.id);
    expect(found?.amount).toBe(debt.amount);
    expect(found?.status).toBe('pending');
  });
});
```

### Feature Tests (Controllers)

```typescript
// tests/Feature/Http/DebtController.test.ts
describe('Debt API', () => {
  it('should return debts for authenticated user', async () => {
    const response = await request(app)
      .get('/v1/debts')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeArray();
  });
});
```

---

## 9. Benefits Summary

| Current Pain | Laravel + JS Solution | Benefit |
|--------------|----------------------|---------|
| Manual DI wiring (132 lines) | `tsyringe` + `@injectable()` | Automatic, type-safe DI |
| No retry/timeout on external calls | `@Retryable`, `@Timed` decorators | Resilient external APIs |
| 7+ scattered folders | `app/Http/`, `app/Services/`, `lib/` | Laravel familiar structure |
| Mixed utils folder (11 files) | Categorized `lib/helpers/`, `lib/security/` | React/Vue devs feel at home |
| 598-line DebtService | Rich `Debt` entity + focused service | SRP, testable |
| `utils/ip.utils.ts` (245 lines) | Split `lib/security/ip/*.ts` | Single concern per file |
| Empty `modules/` folder | Real `app/` structure with Providers | Complete, working architecture |
| `debts.controller.ts` (plural) | `DebtController.ts` (PascalCase) | JS framework naming conventions |

---

## 10. Microservices Readiness Checklist

| Feature | Status | Implementation |
|---------|--------|----------------|
| Circuit Breaker | ✅ Ready | `@CircuitBreaker` decorator + DB/HTTP specific |
| Retry | ✅ Ready | `@Retryable` decorator |
| Timeout | ✅ Ready | `@Timed` decorator |
| EventBus | ⚠️ Partial | In-memory works, needs queue adapter for microservices |
| DI Container | ✅ Ready | tsyringe with auto-registration |
| Transactions | ✅ Ready | `@Transactional` decorator |
| Health Checks | ⚠️ Partial | Manual endpoints, needs aggregator |
| Distributed Tracing | ❌ Missing | OpenTelemetry needed |
| Service Discovery | ❌ Missing | Consul/etcd client needed |
| Queue-Based Events | ❌ Missing | Redis/SQS adapter needed |

**For full microservices, add:**

```typescript
// lib/events/queue-event-bus.ts
@injectable()
export class QueueEventBus implements EventBus {
  constructor(
    @inject('Redis') private redis: RedisClient
  ) {}
  
  async publish(event: DomainEvent): Promise<void> {
    await this.redis.lpush('events', JSON.stringify(event));
  }
}
```

```typescript
// lib/health/health-aggregator.ts
@injectable()
export class HealthAggregator {
  constructor(
    @inject('Database') private db: DbClient,
    @inject('Redis') private redis: RedisClient,
    @inject(EmailService) private email: EmailService
  ) {}
  
  async check(): Promise<HealthStatus> {
    return {
      db: await this.dbHealth(),
      redis: await this.redisHealth(),
      email: await this.emailHealth(), // Uses circuit breaker state
    };
  }
}
```

---

## 11. Implementation Checklist

### Week 1: Setup
- [ ] Install `tsyringe` + `reflect-metadata`
- [ ] Create `app/`, `lib/`, `config/`, `routes/`, `decorators/` folders
- [ ] Update `tsconfig.json` with `@/*`, `@app/*`, `@lib/*` paths
- [ ] Create `bootstrap.ts` with auto-registration
- [ ] Implement `@Retryable`, `@Timed`, `@Transactional`, `@Cacheable`
- [ ] Implement `@OnEvent` decorator
- [ ] Implement `@CircuitBreaker` decorator (generic)
- [ ] Create `lib/db/circuit-breaker.ts` (DB-specific)
- [ ] Create `lib/http/circuit-breaker.ts` (HTTP-specific)
- [ ] Create `EventServiceProvider` for auto-discovery

### Week 2: Utils Migration
- [ ] `utils/password.utils.ts` → `lib/security/password.ts`
- [ ] `utils/crypto.utils.ts` → `lib/security/crypto.ts`
- [ ] `utils/ip.utils.ts` → `lib/security/ip/extract.ts`, `validate.ts`, `parse.ts`
- [ ] `utils/phone.utils.ts` → `lib/validation/phone.ts`
- [ ] `core/error/error-factory.ts` → `lib/result.ts`

### Week 3: Auth Module
- [ ] Create `app/Repositories/Contracts/UserRepositoryInterface.ts`
- [ ] Move `repositories/adapters/user.drizzle-adapter.ts` → `app/Repositories/Database/UserRepository.ts`
- [ ] Move `services/auth/auth-core.service.ts` → `app/Services/AuthService.ts`
- [ ] Move `controllers/auth/auth.controller.ts` → `app/Http/Controllers/AuthController.ts`
- [ ] Create `app/Models/User.ts` with domain logic

### Week 4: Debt Module
- [ ] Create `app/Repositories/Contracts/DebtRepositoryInterface.ts`
- [ ] Move debt repository → `app/Repositories/Database/DebtRepository.ts`
- [ ] Move debt service → `app/Services/DebtService.ts`
- [ ] Move debt controller → `app/Http/Controllers/DebtController.ts`
- [ ] Create `app/Models/Debt.ts` with rich domain logic (replace state machine)
- [ ] Create `app/Models/Enums/DebtStatus.ts`

### Week 5: Remaining Modules
- [ ] User module
- [ ] Notification module
- [ ] Import/Export module
- [ ] Activity module

### Week 6: Cleanup
- [ ] Delete old `controllers/`, `services/`, `repositories/`, `utils/`, `states/`, `core/`, `domain/`, `plugins/`, `shared/`, `types/` folders
- [ ] Run full test suite
- [ ] Update README with new structure
- [ ] Document DI usage patterns

---

## 11. Tree-Shaking & Bundling Best Practices

### Package Configuration

All packages must declare `sideEffects: false`:

```json
{
  "name": "@repo/utils",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./format": "./src/format.ts",
    "./date": "./src/date.ts"
  }
}
```

**Packages updated:**
- ✅ `@repo/utils` - `sideEffects: false` + subpath exports
- ✅ `@repo/types` - `sideEffects: false` + granular exports
- ✅ `@repo/validation` - `sideEffects: false`
- ✅ `@repo/errors` - `sideEffects: false`
- ✅ `@repo/config` - `sideEffects: false`
- ✅ `@repo/schema` - `sideEffects: false`
- ✅ `@repo/icons` - `sideEffects: false`
- ✅ `@repo/db` - `sideEffects: false` (added)
- ✅ `@repo/logger` - `sideEffects: false` (added)
- ✅ `@repo/ui` - `sideEffects: ["./layout.css"]` (CSS only)

### Explicit Named Exports (No Barrel Exports)

**❌ Bad - Barrel exports prevent tree-shaking:**
```typescript
// index.ts
export * from './format';
export * from './date';
```

**✅ Good - Explicit exports:**
```typescript
// index.ts
export { formatDate, parseISO } from './date';
export { formatCurrency } from './format';
```

### Subpath Imports for Granularity

**❌ Bad - Imports everything:**
```typescript
import { formatDate } from '@repo/utils'; // Gets 12KB
```

**✅ Good - Imports only what's needed:**
```typescript
import { formatDate } from '@repo/utils/date'; // Gets 0.5KB
```

### ESLint Rule for API Type Safety

**Added to `apps/web/eslint.config.js`:**

```javascript
{
  files: ['**/*.ts', '**/*.js', '**/*.svelte.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{
          name: '@repo/api',
          message: 'Runtime imports from @repo/api are forbidden'
        }],
        patterns: [{
          group: ['@repo/api/*'],
          importNamePattern: '^(?!types$).*',
          message: 'Only @repo/api/types is allowed'
        }]
      }
    ]
  }
}
```

### Monorepo Import Rules

| Import From | Allowed In | Reason |
|-------------|------------|--------|
| `@repo/api/types` | `apps/web` | Type-only, safe |
| `@repo/api` | `apps/web` | ❌ BLOCKED - runtime code |
| `@repo/utils/date` | Any | Granular, tree-shakable |
| `@repo/utils` | Any | Okay but less optimal |
| `@repo/db/schema` | `apps/api` | Server-only |
| `@repo/db` | `apps/web` | ❌ BLOCKED - server-only code |

---

## 12. Quick Reference

### Dependency Injection Patterns

```typescript
// Repository: Interface + Implementation
interface UserRepositoryInterface { ... }

@injectable()
class UserRepository implements UserRepositoryInterface {
  constructor(@inject('Database') private db: DbClient) {}
}

// Service: Depends on interfaces
@injectable()
class AuthService {
  constructor(
    @inject(UserRepositoryInterface) private userRepo: UserRepositoryInterface,
    @inject('EventBus') private events: EventBus
  ) {}
}

// Controller: Depends on services
@injectable()
class AuthController {
  constructor(@inject(AuthService) private authService: AuthService) {}
}
```

### Decorator Usage

```typescript
@injectable()
class ExternalApiService {
  @Retryable({ maxAttempts: 3 })
  @Timed(5000)
  async callExternalApi() { }

  @Cacheable({ key: 'vietqr', ttl: 3600 })
  async getBankInfo(iban: string) { }

  @Transactional()
  async createWithTransaction(data: any, trx?: Transaction) { }
}
```
