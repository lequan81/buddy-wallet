# ElysiaJS Functional Programming Migration Guide

## Overview

This document describes the migration from Laravel-inspired OOP architecture to ElysiaJS functional programming (FP) architecture. The codebase now follows ElysiaJS best practices: **Functional Programming**, **Composition-over-Inheritance**, **Schema-First & Type-Driven Development**, and **Data-Oriented Programming (DOP)**.

## Key Changes

### 1. Directory Structure

#### Old Structure (Laravel + JS OOP)
```
src/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middlewares/
│   │   └── Requests/
│   ├── Services/
│   ├── Repositories/
│   │   ├── Contracts/
│   │   └── Database/
│   ├── Models/
│   ├── Exceptions/
│   └── Providers/
├── lib/
│   ├── helpers/
│   ├── security/
│   ├── decorators/
│   └── di/
├── config/
└── routes/
```

#### New Structure (ElysiaJS FP)
```
src/
├── index.ts               # Entry point (Bun.serve)
├── app.ts                 # Main global config of Elysia (Global Middleware)
├── commons/               # Shared functions (Utils, Constants)
│   ├── helpers/           # array, date, string, number
│   ├── security/          # password, ip, permissions
│   └── validation/        # phone, request
├── providers/             # Connection services infrastructure
│   ├── db.ts              # Drizzle-orm instance
│   ├── storage.ts         # Storage instance (S3 bucket)
│   ├── redis.ts           # Redis instance
│   └── mailer.ts          # Mailer instance
├── modules/               # Main logic business
│   ├── auth/              # Auth module
│   │   ├── index.ts       # Barrel file sub-plugins
│   │   ├── routes.ts      # Define endpoint & validation (Schema)
│   │   ├── handlers/      # Logic handler (glue code)
│   │   ├── services/      # Heavy logic business (pure functions)
│   │   └── schema.ts      # TypeBox definitions
│   └── debts/             # Debts module
│       ├── index.ts
│       ├── routes.ts
│       ├── handlers/
│       ├── services/
│       └── schema.ts
├── config/                # Configuration files
├── routes/                # Web routes
└── types/                 # Shared types
```

### 2. Architecture Principles

#### SOLID Principles Applied
Only these SOLID principles apply in ElysiaJS FP:
- **S** - Single Responsibility: Each function/module has one clear purpose
- **O** - Open/Closed: Extensible through composition, not inheritance
- **D** - Dependency Inversion: Depend on abstractions (functions), not implementations

**NOT APPLIED:**
- **L** - Liskov Substitution: No inheritance in FP
- **I** - Interface Segregation: No interfaces, use function signatures

### 3. Service Layer: Pure Functions

#### Old (OOP with DI)
```typescript
@injectable()
export class AuthService {
  constructor(
    @inject('UserRepositoryInterface') private userRepo: UserRepositoryInterface,
    @inject('EmailService') private emailService: EmailService
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    // Business logic with DI
  }
}
```

#### New (Pure Functions)
```typescript
// modules/auth/services/auth.service.ts
export function validateUserPassword(password: string): Result<void> {
  const validation = validatePasswordComplexity(password);
  if (!validation.isValid) {
    return {
      code: BE_ERRORS.AUTH_WEAK_PASSWORD.code,
      error: validation.errors.join('. ')
    };
  }
  return { data: undefined };
}

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, authConfig.ARGON2_OPTIONS);
}
```

**Key Changes:**
- No DI container (`tsyringe`)
- No `@injectable()` decorators
- No class constructors
- Pure functions: Input → Process → Output
- No Elysia context in services
- Database operations passed as parameters

### 4. Handler Layer: Glue Code

#### Old (Controller with DI)
```typescript
@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  register(app: Elysia): Elysia {
    return app.post('/register', async ({ body, set }) => {
      const result = await this.authService.register(body);
      if (result.error) {
        set.status = 400;
        return result;
      }
      return { data: result };
    });
  }
}
```

#### New (Handler Function)
```typescript
// modules/auth/handlers/auth.handler.ts
export const registerHandler = async ({ body, set }: any) => {
  const { email, phone, password, fullName } = body;

  // Validate password
  const passwordValidation = validateUserPassword(password);
  if (passwordValidation.error) {
    set.status = 400;
    return passwordValidation;
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user (direct repository call)
  const newUser = await userRepo.create({
    name: fullName,
    email: email || null,
    phoneNumber: normalizedPhone,
    password: hashedPassword,
    permissions: [],
    temporaryPasswordUsed: false
  });

  return { data: { user: toSafeUser(newUser), ...tokens } };
};
```

**Key Changes:**
- No classes, just functions
- Direct repository instantiation (no DI)
- Flow: Get data → Call service → Return or throw error
- Minimal logic in handlers (glue code only)

### 5. Routes: Schema-First

#### Old (Separate validation)
```typescript
// In controller
app.post('/register', registerHandler, {
  body: t.Object({
    email: t.String(),
    password: t.String()
  })
});
```

#### New (Schema as Single Source of Truth)
```typescript
// modules/auth/schema.ts
export const RegisterSchema = t.Object({
  email: t.String({
    format: 'email',
    error: 'Invalid email address'
  }),
  phone: t.String({
    minLength: 10,
    maxLength: 15,
    error: 'Invalid phone number'
  }),
  password: t.String({
    minLength: 8,
    error: 'Password must be at least 8 characters'
  }),
  fullName: t.String({
    minLength: 2,
    error: 'Full name must be at least 2 characters'
  })
});

// modules/auth/routes.ts
export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/register', registerHandler, {
    body: RegisterSchema,
    detail: {
      tags: ['auth'],
      description: 'Register a new user'
    }
  });
```

**Key Changes:**
- Schema defined in separate `schema.ts` file
- Schema is Single Source of Truth
- TypeBox for validation
- OpenAPI documentation via `detail` property

### 6. Module Composition

#### Old (Service Provider)
```typescript
// AppServiceProvider
container.register(AuthService, { useClass: AuthService });
container.register(AuthController, { useClass: AuthController });

// In bootstrap
const authController = container.resolve(AuthController);
app.use(authController.register);
```

#### New (Elysia Plugin Composition)
```typescript
// modules/auth/index.ts
import { Elysia } from 'elysia';
import { authRoutes } from './routes';

export const authModule = new Elysia()
  .use(authRoutes);

// In index.ts
import { authModule } from './modules/auth';
import { debtsModule } from './modules/debts';

export const app = createApp()
  .use(authModule)
  .use(debtsModule);
```

**Key Changes:**
- No DI container
- Elysia plugin composition
- Nested group option for organization
- Barrel file (`index.ts`) for module exports

### 7. Providers: Direct Exports

#### Old (DI Container)
```typescript
// AppServiceProvider
container.register('Database', { useValue: db });
container.register('UploadStorage', { useValue: uploadStorage });

// In service
constructor(@inject('Database') private db: DbClient)
```

#### New (Direct Imports)
```typescript
// providers/db.ts
import { db } from '@repo/db';
export { db };

// In handler
import { db } from '@/providers/db';
const userRepo = new UserRepository(db);
```

**Key Changes:**
- Direct exports from `providers/`
- No DI container
- Direct instantiation in handlers
- Simpler, more explicit

### 8. Removed Dependencies

#### Removed from package.json
```json
{
  "dependencies": {
-   "reflect-metadata": "^0.2.2",
-   "tsyringe": "^4.10.0"
  }
}
```

#### Removed from bootstrap.ts
```typescript
- import 'reflect-metadata';
- import { AppServiceProvider } from '@/app/Providers/AppServiceProvider';
- const appProvider = new AppServiceProvider();
- appProvider.register();
- appProvider.boot();
```

### 9. Build Configuration

#### Old
```json
"build": "bun build src/index.ts --outdir=dist --target=bun --packages external --sourcemap --minify"
```

#### New (with --external flags)
```json
"build": "bun build src/index.ts --outdir=dist --target=bun --external @repo/* --external @elysiajs/* --external @bogeychan/* --external @opentelemetry/* --external @minilibs/* --external @upyo/* --sourcemap --minify"
```

**Benefits:**
- Smaller bundle size
- Faster builds
- Better performance

## Migration Checklist

### Phase 1: Setup ✅
- [x] Create new directory structure (`commons/`, `providers/`, `modules/`)
- [x] Create `app.ts` for global Elysia configuration
- [x] Migrate providers to `providers/` (db, storage, redis, mailer)
- [x] Migrate utilities to `commons/`
- [x] Remove OOP dependencies (tsyringe, reflect-metadata)
- [x] Update build script with `--external` flags

### Phase 2: Auth Module ✅
- [x] Create auth module structure
- [x] Convert AuthService to pure functions
- [x] Convert AuthController to handler functions
- [x] Create schema definitions
- [x] Create routes with schema validation
- [x] Create module barrel file

### Phase 3: Debts Module ✅
- [x] Create debts module structure
- [x] Convert DebtService to pure functions
- [x] Convert DebtController to handler functions
- [x] Create schema definitions
- [x] Create routes with schema validation
- [x] Create module barrel file

### Phase 4: Remaining Modules (TODO)
- [ ] Migrate User module
- [ ] Migrate Notification module
- [ ] Migrate File/Storage module
- [ ] Migrate Import/Export module
- [ ] Migrate Bank module
- [ ] Migrate System/Health module

### Phase 5: Cleanup (TODO)
- [ ] Delete old `app/` folder (after all modules migrated)
- [ ] Delete old `lib/` folder (after migration complete)
- [ ] Delete `bootstrap.ts` (if not needed)
- [ ] Update ARCHITECTURE.md
- [ ] Update ARCHITECTURE_REDESIGN_PLAN.md (mark as deprecated)

## Best Practices

### 1. Service Functions
- **Pure functions only**: No side effects
- **No Elysia context**: Don't use `set`, `request`, etc.
- **Input → Output**: Receive parameters, return results
- **Throw errors**: Don't handle errors in services

```typescript
// ✅ Good
export function validateAmount(amount: number): Result<void> {
  if (amount <= 0) {
    return { code: 'INVALID_AMOUNT', error: 'Amount must be positive' };
  }
  return { data: undefined };
}

// ❌ Bad
export function validateAmount(amount: number, set: any) {
  if (amount <= 0) {
    set.status = 400; // Don't use Elysia context
  }
}
```

### 2. Handler Functions
- **Glue code only**: Get data, call service, return
- **Handle Elysia context**: Use `set.status`, `request`, etc.
- **Minimal logic**: Business logic in services
- **Direct repository calls**: No DI

```typescript
// ✅ Good
export const createDebtHandler = async ({ body, user, set }: any) => {
  const validation = validateDebtAmount(body.amount);
  if (validation.error) {
    set.status = 400;
    return validation;
  }
  
  const debt = await debtRepo.create({ ...body, creditorId: user.id });
  return { data: debt };
};

// ❌ Bad
export const createDebtHandler = async ({ body, user, set }: any) => {
  // Business logic should be in service
  if (body.amount <= 0) {
    set.status = 400;
    return { error: 'Invalid amount' };
  }
  // ...
};
```

### 3. Schema Definitions
- **Single Source of Truth**: Schema defines validation
- **TypeBox**: Use `t.Object`, `t.String`, etc.
- **Error messages**: Custom error messages in schema
- **Reusable**: Export schemas for reuse

```typescript
// ✅ Good
export const CreateDebtSchema = t.Object({
  amount: t.Number({
    minimum: 1,
    error: 'Amount must be greater than 0'
  }),
  currency: t.String({
    minLength: 3,
    maxLength: 3,
    error: 'Invalid currency code (e.g., USD, VND)'
  })
});
```

### 4. Module Organization
- **Barrel file**: `index.ts` exports module
- **Nested groups**: Use Elysia `.group()` or `.use()`
- **Prefix**: Set prefix in module routes
- **Composition**: Compose modules in `index.ts`

```typescript
// ✅ Good
export const authModule = new Elysia()
  .use(authRoutes);

// In index.ts
export const app = createApp()
  .use(authModule)
  .use(debtsModule);
```

## Testing Strategy

### Unit Tests
- Test service functions (pure functions, easy to test)
- Mock repositories in handler tests
- Test schema validation

### Integration Tests
- Test full request flow
- Test module composition
- Test error handling

## Rollback Plan

If issues arise:
1. Keep old `app/` structure until migration is complete
2. Can run both structures in parallel during transition
3. Gradually migrate module by module
4. Delete old structure only after all modules migrated

## Resources

- [ElysiaJS Documentation](https://elysiajs.com/)
- [TypeBox Documentation](https://sinclairzx81.github.io/typebox/)
- [Functional Programming Principles](https://github.com/fantasyland/fantasy-land)
