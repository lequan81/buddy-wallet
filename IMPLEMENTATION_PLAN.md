# Backend Architecture Migration - Implementation Plan

**Timeline:** 5 weeks | **Effort:** ~100 hours | **Risk:** Medium (dual codebase period)

---

## Phase 1: Foundation (Week 1 - 16 hours)

### Goal
Establish domain models and request validation framework without breaking existing code.

### 1.1 Create Debt Domain Model

**File:** `apps/api/src/app/Models/Debt.ts`

```typescript
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
    public readonly updatedAt?: Date,
    public readonly description?: string
  ) {}

  // === Getters ===
  get status(): DebtStatus {
    return this._status;
  }

  // === Business Logic ===
  
  /**
   * Check if user can cancel this debt
   * Only creditor can cancel pending debts
   */
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  /**
   * Check if user can confirm this debt
   * Only debtor can confirm pending debts
   */
  canBeConfirmedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  /**
   * Cancel the debt - only creditor can do this
   */
  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new Error('DEBT_CANNOT_BE_CANCELLED');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'cancelled',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Confirm the debt - only debtor can do this
   */
  confirm(): Debt {
    if (!this.canBeConfirmedBy(this.debtorId)) {
      throw new Error('DEBT_CANNOT_BE_CONFIRMED');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'confirmed',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Get direction of debt for user
   */
  getDirectionForUser(userId: string): 'owed' | 'owing' | null {
    if (this.creditorId === userId) return 'owed';
    if (this.debtorId === userId) return 'owing';
    return null;
  }

  /**
   * Check if debt is overdue (30+ days pending)
   */
  isOverdue(): boolean {
    const daysSinceCreated = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return this._status === 'pending' && daysSinceCreated > 30;
  }

  // === Factory Methods ===
  
  static create(
    id: string,
    amount: number,
    currency: string,
    debtorId: string,
    creditorId: string,
    description?: string
  ): Debt {
    return new Debt(id, amount, currency, debtorId, creditorId, 'pending', new Date(), undefined, description);
  }
}
```

**PowerShell Commands:**
```powershell
# Create the file
$path = "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\app\Models\Debt.ts"
$content = @"
# [Content from above]
"@
Set-Content -Path $path -Value $content -Encoding UTF8
```

### 1.2 Create DebtStatus Enum

**File:** `apps/api/src/app/Models/Enums/DebtStatus.ts`

```typescript
export type DebtStatus = 'pending' | 'confirmed' | 'cancelled' | 'disputed';

export const DebtStatuses = {
  PENDING: 'pending' as const,
  CONFIRMED: 'confirmed' as const,
  CANCELLED: 'cancelled' as const,
  DISPUTED: 'disputed' as const,
};

export function isValidDebtStatus(status: string): status is DebtStatus {
  return Object.values(DebtStatuses).includes(status as DebtStatus);
}
```

### 1.3 Create User Domain Model

**File:** `apps/api/src/app/Models/User.ts`

```typescript
export type UserRole = 'user' | 'admin';

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly phoneNumber: string,
    public readonly role: UserRole = 'user',
    public readonly createdAt: Date = new Date(),
    public readonly emailVerified: boolean = false,
    public readonly isActive: boolean = true
  ) {}

  // === Getters ===
  isAdmin(): boolean {
    return this.role === 'admin';
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }

  // === Factory Methods ===
  static create(
    id: string,
    email: string,
    name: string,
    phoneNumber: string,
    role: UserRole = 'user'
  ): User {
    return new User(id, email, name, phoneNumber, role);
  }
}
```

### 1.4 Create Request Validation Schemas (Valibot)

**File:** `apps/api/src/app/Http/Requests/CreateDebtRequest.ts`

```typescript
import { pipe, string, number, minLength, decimal, regex, custom, object } from 'valibot';
import type { Output } from 'valibot';

const PhoneSchema = pipe(
  string('Phone must be a string'),
  minLength(10, 'Phone must be at least 10 digits'),
  regex(/^[0-9+\-\s()]*$/, 'Invalid phone format')
);

const CurrencySchema = pipe(
  string('Currency must be a string'),
  regex(/^[A-Z]{3}$/, 'Currency must be 3 uppercase letters (e.g., USD, VND)')
);

export const CreateDebtRequestSchema = object({
  creditorId: string('Creditor ID is required'),
  amount: pipe(
    number('Amount must be a number'),
    custom(v => v > 0, 'Amount must be greater than 0')
  ),
  currency: CurrencySchema,
  description: string(),
});

export type CreateDebtRequest = Output<typeof CreateDebtRequestSchema>;
```

**File:** `apps/api/src/app/Http/Requests/RegisterRequest.ts`

```typescript
import { pipe, string, minLength, regex, custom, object } from 'valibot';
import type { Output } from 'valibot';

const PasswordSchema = pipe(
  string('Password must be a string'),
  minLength(8, 'Password must be at least 8 characters'),
  custom(v => /[A-Z]/.test(v), 'Must contain at least one uppercase letter'),
  custom(v => /[a-z]/.test(v), 'Must contain at least one lowercase letter'),
  custom(v => /[0-9]/.test(v), 'Must contain at least one number'),
  custom(v => /[!@#$%^&*()_\-+=\[\]{};:'",.<>?\/\\|`~]/.test(v), 'Must contain at least one special character'),
  custom(v => !v.length > 128, 'Password must be less than 128 characters')
);

const PhoneSchema = pipe(
  string('Phone must be a string'),
  minLength(10, 'Phone must be at least 10 digits'),
  regex(/^[0-9+\-\s()]*$/, 'Invalid phone format')
);

export const RegisterRequestSchema = object({
  name: pipe(
    string('Name is required'),
    minLength(2, 'Name must be at least 2 characters')
  ),
  email: pipe(
    string('Email is required'),
    regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')
  ),
  phoneNumber: PhoneSchema,
  password: PasswordSchema,
});

export type RegisterRequest = Output<typeof RegisterRequestSchema>;
```

**File:** `apps/api/src/app/Http/Requests/index.ts`

```typescript
export { RegisterRequestSchema, type RegisterRequest } from './RegisterRequest';
export { CreateDebtRequestSchema, type CreateDebtRequest } from './CreateDebtRequest';
```

### 1.5 Create Request Validation Middleware

**File:** `apps/api/src/app/Http/Middleware/ValidateRequest.ts`

```typescript
import { safeParse } from 'valibot';
import type { GenericSchema } from 'valibot';

export function createRequestValidator<T extends GenericSchema>(schema: T) {
  return async (body: unknown) => {
    const result = safeParse(schema, body);
    
    if (!result.success) {
      const errors = result.issues.map(issue => ({
        path: issue.path?.map(p => p.key).join('.') || 'root',
        message: issue.message
      }));
      
      throw new Error(JSON.stringify({
        code: 'VALIDATION_ERROR',
        details: errors
      }));
    }
    
    return result.output;
  };
}
```

---

## Phase 2: Service Layer Completion (Week 2 - 20 hours)

### Goal
Complete service implementations with decorators, update repositories to return domain models.

### 2.1 Update DebtRepository to Return Debt Models

**File:** `apps/api/src/app/Repositories/Database/DebtRepository.ts`

Replace existing file with:

```typescript
import { injectable, inject } from 'tsyringe';
import { eq, and } from '@repo/db';
import { Debt } from '../../Models/Debt';
import type { DebtRepositoryInterface } from '../Contracts/DebtRepositoryInterface';
import { db } from '@repo/db';

@injectable()
export class DebtRepository implements DebtRepositoryInterface {
  constructor() {}

  async findById(id: string): Promise<Debt | null> {
    const row = await db.query.debts.findFirst({
      where: eq(debts.id, id)
    });
    
    return row ? this.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Debt[]> {
    const rows = await db.query.debts.findMany({
      where: (debts as any).id.inArray(ids)
    });
    
    return rows.map(row => this.toDomain(row));
  }

  async save(debt: Debt): Promise<Debt> {
    const row = await db.insert(debts)
      .values({
        id: debt.id,
        amount: debt.amount,
        currency: debt.currency,
        debtorId: debt.debtorId,
        creditorId: debt.creditorId,
        status: debt.status,
        createdAt: debt.createdAt,
        updatedAt: new Date(),
        description: debt.description
      })
      .onConflictDoUpdate({
        target: debts.id,
        set: {
          status: debt.status,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return this.toDomain(row[0]);
  }

  async delete(id: string): Promise<void> {
    await db.delete(debts).where(eq(debts.id, id));
  }

  private toDomain(row: any): Debt {
    return new Debt(
      row.id,
      row.amount,
      row.currency,
      row.debtorId,
      row.creditorId,
      row.status,
      row.createdAt,
      row.updatedAt,
      row.description
    );
  }
}
```

### 2.2 Update DebtService with Domain Logic

**File:** `apps/api/src/app/Services/DebtService.ts`

```typescript
import { injectable, inject } from 'tsyringe';
import type { DebtRepositoryInterface } from '../Repositories/Contracts/DebtRepositoryInterface';
import { Debt } from '../Models/Debt';
import { Retryable } from '@lib/decorators';
import { CircuitBreaker } from '@lib/decorators';
import { Transactional } from '@lib/decorators';
import { ok, err } from '@lib/result';
import { logger } from '@repo/logger';

@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepository') private debtRepo: DebtRepositoryInterface
  ) {}

  @Retryable({ maxAttempts: 3 })
  async getDebtById(debtId: string) {
    try {
      const debt = await this.debtRepo.findById(debtId);
      if (!debt) {
        return err('DEBT_NOT_FOUND');
      }
      return ok(debt);
    } catch (error) {
      logger.error('Error fetching debt', { debtId, error: String(error) });
      return err('DATABASE_ERROR');
    }
  }

  @Retryable({ maxAttempts: 3 })
  @Transactional()
  async cancelDebt(debtId: string, userId: string) {
    try {
      const debt = await this.debtRepo.findById(debtId);
      if (!debt) {
        return err('DEBT_NOT_FOUND');
      }

      if (!debt.canBeCancelledBy(userId)) {
        return err('UNAUTHORIZED');
      }

      const cancelled = debt.cancel();
      await this.debtRepo.save(cancelled);
      
      // TODO: Emit event for notifications
      logger.info('Debt cancelled', { debtId, creditorId: userId });
      
      return ok(cancelled);
    } catch (error) {
      logger.error('Error cancelling debt', { debtId, error: String(error) });
      return err('OPERATION_FAILED');
    }
  }

  @Retryable({ maxAttempts: 3 })
  @Transactional()
  async confirmDebt(debtId: string, userId: string) {
    try {
      const debt = await this.debtRepo.findById(debtId);
      if (!debt) {
        return err('DEBT_NOT_FOUND');
      }

      if (!debt.canBeConfirmedBy(userId)) {
        return err('UNAUTHORIZED');
      }

      const confirmed = debt.confirm();
      await this.debtRepo.save(confirmed);
      
      logger.info('Debt confirmed', { debtId, debtorId: userId });
      
      return ok(confirmed);
    } catch (error) {
      logger.error('Error confirming debt', { debtId, error: String(error) });
      return err('OPERATION_FAILED');
    }
  }
}
```

### 2.3 Implement @Timed Decorator

**File:** `apps/api/src/lib/decorators/timed.ts`

```typescript
import { logger } from '@repo/logger';

interface TimedOptions {
  ms: number;
  fallback?: () => any;
}

export function Timed(options: TimedOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyKey;
      const startTime = Date.now();

      try {
        const race = Promise.race([
          originalMethod.apply(this, args),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`TIMEOUT: ${className}.${methodName} exceeded ${options.ms}ms`)),
              options.ms
            )
          )
        ]);

        const result = await race;
        const duration = Date.now() - startTime;
        
        if (duration > options.ms * 0.8) {
          logger.warn(`${className}.${methodName} slow execution: ${duration}ms`, {
            timeout: options.ms
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        if ((error as Error)?.message?.includes('TIMEOUT')) {
          logger.error(`${className}.${methodName} timed out after ${options.ms}ms`);
          
          if (options.fallback) {
            logger.info(`Using fallback for ${className}.${methodName}`);
            return options.fallback();
          }
        }
        
        throw error;
      }
    };

    return descriptor;
  };
}
```

### 2.4 Implement @Cacheable Decorator

**File:** `apps/api/src/lib/decorators/cacheable.ts`

```typescript
import { logger } from '@repo/logger';
import type { RedisClient } from '@repo/db';

interface CacheableOptions {
  key: string;
  ttl: number;  // seconds
  condition?: (...args: any[]) => boolean;
}

let redisClient: RedisClient | null = null;

export function setRedisClient(client: RedisClient) {
  redisClient = client;
}

export function Cacheable(options: CacheableOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!redisClient) {
        logger.warn(`Redis not available for ${target.constructor.name}.${propertyKey}, skipping cache`);
        return originalMethod.apply(this, args);
      }

      // Check cache condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      const cacheKey = `${options.key}:${args.map(a => String(a)).join(':')}`;

      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for ${cacheKey}`);
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn(`Cache retrieval error: ${String(error)}`);
        // Continue to compute
      }

      const result = await originalMethod.apply(this, args);

      try {
        await redisClient.setex(cacheKey, options.ttl, JSON.stringify(result));
      } catch (error) {
        logger.warn(`Cache write error: ${String(error)}`);
        // Still return result
      }

      return result;
    };

    return descriptor;
  };
}
```

### 2.5 Implement @Transactional with Proper Handling

**File:** `apps/api/src/lib/decorators/transactional.ts`

```typescript
import { logger } from '@repo/logger';
import { db } from '@repo/db';

export function Transactional() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyKey;

      try {
        logger.debug(`Starting transaction: ${className}.${methodName}`);

        return await db.transaction(async (trx) => {
          // Inject transaction as last parameter
          const result = await originalMethod.apply(this, [...args, trx]);
          logger.debug(`Committing transaction: ${className}.${methodName}`);
          return result;
        });
      } catch (error) {
        logger.error(`Transaction failed: ${className}.${methodName}`, {
          error: String(error)
        });
        throw error;
      }
    };

    return descriptor;
  };
}
```

---

## Phase 3: Controller Layer Migration (Week 3 - 20 hours)

### Goal
Migrate all controllers to use DI, apply request validation, implement proper error handling.

### 3.1 Update AuthController with Validation

**File:** `apps/api/src/app/Http/Controllers/AuthController.ts`

```typescript
import { injectable, inject } from 'tsyringe';
import { Elysia } from 'elysia';
import { AuthService } from '../../Services/AuthService';
import { RegisterRequestSchema, type RegisterRequest } from '../Requests/RegisterRequest';
import { createRequestValidator } from '../Middleware/ValidateRequest';
import { logger } from '@repo/logger';

@injectable()
export class AuthController {
  private validateRegister = createRequestValidator(RegisterRequestSchema);

  constructor(
    @inject(AuthService) private authService: AuthService
  ) {}

  register() {
    return new Elysia({ prefix: '/auth' })
      .post('/register', async ({ body, set }) => {
        try {
          const validated = await this.validateRegister(body);
          const result = await this.authService.register(validated);

          if ('code' in result) {
            set.status = 400;
            return { error: { code: result.code, message: result.message } };
          }

          set.status = 201;
          return {
            data: result.data,
            message: 'Registration successful'
          };
        } catch (error) {
          logger.error('Registration error', { error: String(error), body });
          set.status = 400;
          
          if ((error as Error)?.message?.includes('VALIDATION_ERROR')) {
            return JSON.parse((error as Error).message);
          }
          
          return { error: { code: 'REGISTRATION_FAILED', message: 'Registration failed' } };
        }
      }, {
        // NOTE: Body validation now in middleware
      })
      .post('/login', async ({ body, set }) => {
        try {
          const result = await this.authService.login(body);

          if ('code' in result) {
            set.status = 401;
            return { error: { code: result.code, message: result.message } };
          }

          set.status = 200;
          return {
            data: result.data,
            expiresIn: 86400
          };
        } catch (error) {
          logger.error('Login error', { error: String(error) });
          set.status = 401;
          return { error: { code: 'LOGIN_FAILED', message: 'Login failed' } };
        }
      });
  }
}
```

### 3.2 Update DebtController with Validation & Domain Models

**File:** `apps/api/src/app/Http/Controllers/DebtController.ts`

```typescript
import { injectable, inject } from 'tsyringe';
import { Elysia } from 'elysia';
import { DebtService } from '../../Services/DebtService';
import { CreateDebtRequestSchema, type CreateDebtRequest } from '../Requests/CreateDebtRequest';
import { createRequestValidator } from '../Middleware/ValidateRequest';
import { logger } from '@repo/logger';

@injectable()
export class DebtController {
  private validateCreateDebt = createRequestValidator(CreateDebtRequestSchema);

  constructor(
    @inject(DebtService) private debtService: DebtService
  ) {}

  register() {
    return new Elysia({ prefix: '/debts' })
      .get('/:id', async ({ params, set }) => {
        try {
          const result = await this.debtService.getDebtById(params.id);

          if ('code' in result) {
            set.status = 404;
            return { error: { code: result.code } };
          }

          return { data: result.data };
        } catch (error) {
          logger.error('Get debt error', { id: params.id, error: String(error) });
          set.status = 500;
          return { error: { code: 'INTERNAL_ERROR' } };
        }
      })
      .post('/', async ({ body, set }) => {
        try {
          const validated = await this.validateCreateDebt(body);
          const result = await this.debtService.createDebt(validated);

          if ('code' in result) {
            set.status = 400;
            return { error: { code: result.code } };
          }

          set.status = 201;
          return { data: result.data };
        } catch (error) {
          logger.error('Create debt error', { error: String(error), body });
          set.status = 400;
          return { error: { code: 'DEBT_CREATION_FAILED' } };
        }
      })
      .post('/:id/cancel', async ({ params, set }) => {
        try {
          // TODO: Get userId from auth context
          const userId = ''; // Placeholder
          const result = await this.debtService.cancelDebt(params.id, userId);

          if ('code' in result) {
            set.status = 400;
            return { error: { code: result.code } };
          }

          return { data: result.data };
        } catch (error) {
          logger.error('Cancel debt error', { id: params.id, error: String(error) });
          set.status = 500;
          return { error: { code: 'INTERNAL_ERROR' } };
        }
      })
      .post('/:id/confirm', async ({ params, set }) => {
        try {
          // TODO: Get userId from auth context
          const userId = ''; // Placeholder
          const result = await this.debtService.confirmDebt(params.id, userId);

          if ('code' in result) {
            set.status = 400;
            return { error: { code: result.code } };
          }

          return { data: result.data };
        } catch (error) {
          logger.error('Confirm debt error', { id: params.id, error: String(error) });
          set.status = 500;
          return { error: { code: 'INTERNAL_ERROR' } };
        }
      });
  }
}
```

---

## Phase 4: Infrastructure & Cleanup (Week 4-5 - 24 hours)

### Goal
Integrate decorators, split utilities, migrate middleware, clean up old code.

### 4.1 Apply Decorators to EmailService

**File:** `apps/api/src/app/Services/EmailService.ts`

```typescript
import { injectable } from 'tsyringe';
import { Retryable } from '@lib/decorators';
import { Timed } from '@lib/decorators';
import { CircuitBreaker } from '@lib/decorators';
import { logger } from '@repo/logger';

@injectable()
export class EmailService {
  @Retryable({ maxAttempts: 3, retryableErrors: ['ECONNRESET', 'ETIMEDOUT'] })
  @Timed({ ms: 30000 })
  @CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000 })
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      // SMTP logic here
      logger.info('Email sent', { to, subject });
    } catch (error) {
      logger.error('Email send failed', { to, error: String(error) });
      throw error;
    }
  }

  @Retryable({ maxAttempts: 3 })
  @Timed({ ms: 10000 })
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `<p>Welcome ${name}!</p>`;
    await this.sendEmail(email, 'Welcome', html);
  }
}
```

### 4.2 Create Exception Classes

**File:** `apps/api/src/app/Exceptions/ApiException.ts`

```typescript
export class ApiException extends Error {
  constructor(
    public code: string,
    public statusCode: number = 500,
    message?: string
  ) {
    super(message || code);
    this.name = 'ApiException';
  }
}

export class ValidationException extends ApiException {
  constructor(
    public details: Array<{ path: string; message: string }> = []
  ) {
    super('VALIDATION_ERROR', 400, 'Validation failed');
    this.name = 'ValidationException';
  }
}

export class NotFoundException extends ApiException {
  constructor(resourceType: string = 'Resource') {
    super('NOT_FOUND', 404, `${resourceType} not found`);
    this.name = 'NotFoundException';
  }
}

export class UnauthorizedException extends ApiException {
  constructor() {
    super('UNAUTHORIZED', 401, 'Unauthorized');
    this.name = 'UnauthorizedException';
  }
}

export class ConflictException extends ApiException {
  constructor(resource: string = 'Resource') {
    super('CONFLICT', 409, `${resource} already exists`);
    this.name = 'ConflictException';
  }
}

export class CircuitBreakerOpenException extends ApiException {
  constructor(serviceName: string = 'External Service') {
    super('SERVICE_UNAVAILABLE', 503, `${serviceName} is temporarily unavailable`);
    this.name = 'CircuitBreakerOpenException';
  }
}
```

**File:** `apps/api/src/app/Exceptions/index.ts`

```typescript
export * from './ApiException';
```

### 4.3 Split IP Utilities

**File:** `apps/api/src/lib/security/ip/extract.ts`

```typescript
import type { Context } from 'elysia';

/**
 * Extract client IP from request
 * Handles X-Forwarded-For, CF-Connecting-IP, and standard remote address
 */
export function getClientIP(request: Request, trustedProxies: string[] = []): string | null {
  // Check X-Forwarded-For (typical proxy header)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || null;
  }

  // Check Cloudflare header
  const cfConnecting = request.headers.get('cf-connecting-ip');
  if (cfConnecting) {
    return cfConnecting;
  }

  // Check True-Client-IP (Cloudflare alternative)
  const trueClient = request.headers.get('true-client-ip');
  if (trueClient) {
    return trueClient;
  }

  // Fallback to connection info (less reliable behind proxies)
  // Note: Elysia/Bun doesn't expose socket info directly
  return null;
}
```

**File:** `apps/api/src/lib/security/ip/validate.ts`

```typescript
/**
 * Validate and classify IP addresses
 */

const PRIVATE_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0/12
  /^169\.254\./, // IPv4 link-local
  /^127\./, // Loopback
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 private
  /^fe80:/ // IPv6 link-local
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

export function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  return trustedProxies.includes(ip) || isPrivateIP(ip);
}

export function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number.parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}
```

**File:** `apps/api/src/lib/security/ip/parse.ts`

```typescript
/**
 * Normalize and parse IP addresses
 */

export function normalizeIP(value: string | null | undefined): string | null {
  if (!value) return null;

  let ip = value.trim().replace(/^"|"$/g, '');
  
  if (!ip || ip.toLowerCase() === 'unknown' || ip.startsWith('_')) {
    return null;
  }

  // Handle bracketed IPv6
  if (ip.startsWith('[')) {
    const closingBracket = ip.indexOf(']');
    if (closingBracket > 1) {
      ip = ip.slice(1, closingBracket);
    }
  } else {
    // Handle IPv4-mapped IPv6 and port
    const candidate = ip.replace(/^::ffff:/, '');
    if (candidate.includes('.') && candidate.includes(':')) {
      const parts = candidate.split(':');
      const maybePort = parts[parts.length - 1];
      if (/^\d+$/.test(maybePort)) {
        ip = parts.slice(0, -1).join(':');
      }
    }
  }

  ip = ip.replace(/^::ffff:/, '');
  
  return ip || null;
}

export function extractIPFromForwarded(forwarded: string, index: number = 0): string | null {
  const ips = forwarded.split(',').map(ip => normalizeIP(ip));
  return ips[index] || null;
}
```

**File:** `apps/api/src/lib/security/ip/index.ts`

```typescript
export { getClientIP } from './extract';
export { isPrivateIP, isTrustedProxy, isValidIPv4 } from './validate';
export { normalizeIP, extractIPFromForwarded } from './parse';
```

### 4.4 Improve Password Validation with Valibot

**File:** `apps/api/src/lib/security/password.ts`

```typescript
import { pipe, string, minLength, maxLength, custom } from 'valibot';
import type { BaseSchema, Output } from 'valibot';

const COMMON_PASSWORDS = [
  'password', '123456', 'qwerty', 'abc123', 'letmein', 'welcome',
  'monkey', 'dragon', '1234567', '12345678', '123456789'
];

const PasswordSchema = pipe(
  string('Password must be a string'),
  minLength(8, 'At least 8 characters'),
  maxLength(128, 'Maximum 128 characters'),
  custom(v => /[A-Z]/.test(v), 'At least one uppercase letter'),
  custom(v => /[a-z]/.test(v), 'At least one lowercase letter'),
  custom(v => /[0-9]/.test(v), 'At least one number'),
  custom(
    v => /[!@#$%^&*()_\-+=\[\]{};:'",.<>?\/\\|`~]/.test(v),
    'At least one special character'
  ),
  custom(v => !COMMON_PASSWORDS.includes(v.toLowerCase()), 'Password too common')
) as BaseSchema<string>;

export type Password = Output<typeof PasswordSchema>;

export function validatePassword(password: string) {
  return PasswordSchema satisfies BaseSchema<string>;
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.includes(password.toLowerCase());
}

export async function hashPassword(password: string): Promise<string> {
  // Use Bun's built-in crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const encoded = await hashPassword(password);
  return encoded === hash;
}
```

### 4.5 Update Bootstrap to Merge Both Entry Points

**File:** `apps/api/src/bootstrap.ts`

```typescript
import 'reflect-metadata';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { etag } from '@bogeychan/elysia-etag';
import { cors } from '@elysiajs/cors';
import { logger } from '@repo/logger';

// Import providers
import { AppServiceProvider } from './app/Providers/AppServiceProvider';
import { EventServiceProvider } from './app/Providers/EventServiceProvider';

// Import controllers
import { AuthController } from './app/Http/Controllers/AuthController';
import { DebtController } from './app/Http/Controllers/DebtController';

// Import middleware functions
import { corsPlugin } from './plugins/middleware/cors.middleware';
import { csrfPlugin } from './plugins/middleware/csrf.middleware';
import { securityHeadersPlugin } from './plugins/middleware/security-headers.middleware';
import { requestLoggerPlugin } from './plugins/middleware/request-logger.middleware';
import { telemetry } from './instrumentation';

/**
 * Bootstrap the Elysia application with complete setup
 * Merges production setup (index_legacy.ts) with DI (bootstrap.ts)
 */
export async function bootstrap() {
  // --- 1. REGISTER SERVICE PROVIDERS ---
  logger.info('Registering service providers...');
  
  const appProvider = new AppServiceProvider();
  appProvider.register();
  appProvider.boot();
  
  const eventProvider = new EventServiceProvider();
  await eventProvider.boot();

  // --- 2. CREATE ELYSIA APP WITH SECURITY LAYERS (from index_legacy.ts) ---
  logger.info('Initializing Elysia application...');

  const app = new Elysia()
    // Caching & global security
    .use(etag())
    .use(corsPlugin)
    .use(csrfPlugin)
    .use(securityHeadersPlugin)
    
    // Request observability
    .use(requestLoggerPlugin)
    .use((ctx) => telemetry(ctx))
    
    // Fast-exit health checks
    .get('/health', () => ({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }))
    
    .get('/health/dependencies', async () => {
      // TODO: Import actual health check functions from core/health/
      return {
        status: 'dependencies',
        db: { ready: true },
        cache: { ready: true },
        timestamp: new Date().toISOString()
      };
    });

  // --- 3. REGISTER CONTROLLERS VIA DI ---
  logger.info('Registering controllers...');

  try {
    const authController = container.resolve(AuthController);
    const debtController = container.resolve(DebtController);

    app.group('/v1', (api) =>
      api
        .use(authController.register())
        .use(debtController.register())
    );

    logger.info('Controllers registered successfully');
  } catch (error) {
    logger.error('Controller registration failed', { error: String(error) });
    throw error; // Don't fallback - fail fast
  }

  return app;
}
```

### 4.6 Create Configuration Extraction

**File:** `apps/api/src/config/app.ts`

```typescript
export const appConfig = {
  port: Number.parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  version: '1.2.4',
  apiPrefix: '/v1'
};
```

**File:** `apps/api/src/config/auth.ts`

```typescript
export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiration: Number.parseInt(process.env.JWT_EXPIRATION || '86400'),
  passwordMaxLength: 128,
  passwordMinLength: 8,
  sessionTimeout: Number.parseInt(process.env.SESSION_TIMEOUT || '3600'),
  trustedProxies: (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',')
};
```

**File:** `apps/api/src/config/cache.ts`

```typescript
export const cacheConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultTTL: Number.parseInt(process.env.CACHE_TTL || '3600'),
  enableCache: process.env.ENABLE_CACHE !== 'false'
};
```

**File:** `apps/api/src/config/index.ts`

```typescript
export { appConfig } from './app';
export { authConfig } from './auth';
export { cacheConfig } from './cache';
```

---

## PowerShell Commands for Each Phase

### Phase 1: Create Models & Validation

```powershell
# Create Models directory and files
$modelsPath = "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\app\Models"
$enumsPath = "$modelsPath\Enums"

# Create Enums
New-Item -Path $enumsPath -ItemType Directory -Force | Out-Null

# Create request DTOs
$requestsPath = "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\app\Http\Requests"
New-Item -Path $requestsPath -ItemType Directory -Force | Out-Null

# Verify creation
Get-ChildItem $modelsPath -Recurse | Select-Object FullName
Get-ChildItem $requestsPath -Recurse | Select-Object FullName
```

### Phase 2: Update Services

```powershell
# No new directories needed, just file updates
# Run tests after updates
cd "c:\Users\lequa\Desktop\buddy-wallet\apps\api"
bun test src/app/Services/*.test.ts 2>&1
```

### Phase 3: Migrate Controllers

```powershell
# Check current controllers
$controllerPath = "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\controllers"
Get-ChildItem $controllerPath -Recurse -Filter "*.ts" | ForEach-Object {
  Write-Host "Old controller: $($_.FullName)"
}

# New controllers
$newControllerPath = "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\app\Http\Controllers"
Get-ChildItem $newControllerPath -Recurse -Filter "*.ts"
```

### Phase 4: Cleanup & Integration

```powershell
# After all migrations complete, remove old folders
$oldFolders = @(
  "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\controllers",
  "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\states",
  "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\modules"
)

# Verify before deletion
$oldFolders | ForEach-Object {
  if (Test-Path $_) {
    Write-Host "Will delete: $_"
    Get-ChildItem $_ -Recurse | Measure-Object
  }
}

# Delete (uncomment when ready)
# $oldFolders | ForEach-Object { Remove-Item $_ -Recurse -Force }
```

---

## Testing Checklist

### Unit Tests

```powershell
# Test Debt model
cd "c:\Users\lequa\Desktop\buddy-wallet\apps\api"
bun test src/app/Models/Debt.test.ts

# Test DebtService
bun test src/app/Services/DebtService.test.ts

# Test Decorators
bun test src/lib/decorators/*.test.ts
```

### Integration Tests

```powershell
# Test AuthController
bun test src/app/Http/Controllers/AuthController.test.ts

# Test DebtController
bun test src/app/Http/Controllers/DebtController.test.ts

# Test full app bootstrap
bun test bootstrap.test.ts
```

### Type Checking

```powershell
# User will run this manually
cd "c:\Users\lequa\Desktop\buddy-wallet\apps\api"
bun run type-check

# Or with bun
bun check
```

---

## Rollback Strategy

If issues arise during migration:

```powershell
# Keep old index_legacy.ts as fallback
Copy-Item "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\index.ts" `
          "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\index.backup.ts"

# Swap back if needed
Move-Item "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\index.backup.ts" `
          "c:\Users\lequa\Desktop\buddy-wallet\apps\api\src\index.ts" -Force
```

---

## Success Criteria

- [ ] All 7+ services migrated to `app/Services/`
- [ ] All 11 controllers migrated to `app/Http/Controllers/`
- [ ] Debt & User domain models created with business logic
- [ ] Request DTOs with Valibot validation for all endpoints
- [ ] All 8 decorators implemented and 6+ actively used
- [ ] Repository pattern with interfaces for all resources
- [ ] Bootstrap unified (no dual entry points)
- [ ] Old `controllers/`, `states/`, `modules/` folders deleted
- [ ] IP utilities split into `lib/security/ip/` subfolder
- [ ] Config extracted into `config/app.ts`, `config/auth.ts`, `config/cache.ts`
- [ ] All exceptions in `app/Exceptions/`
- [ ] No type errors, all tests passing
- [ ] Documentation updated

---

## Timeline Summary

| Phase | Duration | Tasks | Checkpoint |
| --- | --- | --- | --- |
| 1 | 3-4 days | Models, Enums, Request DTOs, Validators | Run tests, verify models work |
| 2 | 3-4 days | Service updates, decorators, repository changes | All services have proper decorators |
| 3 | 3-4 days | Controller migration, validation, error handling | All controllers migrated & tested |
| 4 | 4-5 days | Middleware migration, utility split, bootstrap merge, cleanup | Old code deleted, single bootstrap |
| Buffer | 2-3 days | Fixing issues, performance tuning, documentation | Final integration test |

**Total: ~27 days (4 weeks) with buffer**
