# Backend Implementation Plan
## Consolidated Refactor: Clean Laravel/Spring MVC Architecture

**Document Version:** 2.0  
**Based on:** REFACTOR_CODEBASE.md + Deep Tech-Debt Analysis  
**Goal:** Eliminate 95 Actions, consolidate to rich Domain Models + thin Services

---

## Executive Summary

### Why REFACTOR_CODEBASE.md Is Insufficient

The original plan preserves 95 Actions and adds Orchestrators. This creates:
- **Controller → Orchestrator → Actions → Services → Repositories** (5 layers)
- Duplicate business logic between Actions and Services
- 114 DI registrations (Actions + Services + Repos)
- Deep call chains: Action calls Action calls Service

### New Target Architecture

```
Controller → Service → Domain Model → Repository
     ↓           ↓           ↓            ↓
   HTTP      Use Case    Business     Data Access
   Layer     Orchestrate   Logic       Persistence
```

**Layer Count:** 4 (was 5)  
**DI Registrations:** ~20 (was 114)  
**Business Logic Location:** Single source in Domain Models

---

## 1. Logic Classification (JSDoc Tags)

Every class/file must declare its logic type:

### `@logicType http`
HTTP layer concerns only. No business rules.
```typescript
/**
 * @logicType http
 * @description Handles HTTP request/response, validation, routing
 * @rules
 * - Parse request body/params/query
 * - Call appropriate Service method
 * - Map result to HTTP response
 * - Handle HTTP-specific errors (400, 401, 403, 404, 500)
 * - MUST NOT contain business logic
 */
```

### `@logicType backend`
Use case orchestration. Coordinates domain operations.
```typescript
/**
 * @logicType backend
 * @description Orchestrates use cases, manages transactions, triggers side effects
 * @rules
 * - Delegate all business decisions to Domain Models
 * - Coordinate multiple repositories if needed
 * - Emit domain events for side effects
 * - Handle persistence concerns (caching, transactions)
 * - MUST NOT embed business rules (use Model methods)
 */
```

### `@logicType business`
True domain logic. Business rules, state transitions, invariants.
```typescript
/**
 * @logicType business
 * @description Encapsulates business rules and domain invariants
 * @rules
 * - Contains ALL business logic for the domain
 * - Immutable state transitions (return new instances)
 * - Validation of business rules (not input format)
 * - State machine transitions
 * - MUST NOT depend on infrastructure (DB, HTTP, external APIs)
 * - MUST be testable without mocks
 */
```

### `@logicType infrastructure`
Data access, external APIs, storage.
```typescript
/**
 * @logicType infrastructure
 * @description Provides data persistence and external integration
 * @rules
 * - Implement repository interfaces
 - Map between Domain Models and DB rows
 * - Handle connection errors, retries
 * - MUST NOT contain business logic
 * - MUST be swappable (interface-based)
 */
```

---

## 2. Current vs Target Comparison

### Current State (Problematic)

```
DebtController (http)
  ↓ injects
CreateDebtAction (backend? business?)
  ↓ calls
FindPotentialDuplicatesAction (backend? business?)
  ↓ calls
DebtRepository.findByPhone() (infrastructure)
  ↓
LogAction.execute() (backend)
SendDebtCreatedNotificationAction (backend)
  ↓ calls
PushService (infrastructure)
```

**Problems:**
- `CreateDebtAction` mixes validation (backend), duplicate detection (business), and side effects (backend)
- Business rules scattered across 16 Debt-related Actions
- Same validation exists in `DebtCommandService` (duplication)
- Testing requires mocking 4+ injected Actions

### Target State (Clean)

```
DebtController (http)
  ↓ injects
DebtCommandService (backend)
  ↓ delegates to
Debt.create() (business) ← Domain Model factory
  ↓ returns
Debt instance (business)
  ↓
DebtCommandService.save() (backend)
  ↓ calls
DebtRepository.save() (infrastructure)
  ↓ emits
DebtCreatedEvent (business)
  ↓ handled by
EventBus → NotificationHandler (backend)
```

**Benefits:**
- Single `Debt.create()` contains all creation business logic
- `DebtCommandService` only orchestrates (no business rules)
- Testing `Debt.create()` requires zero mocks
- Adding a feature = adding Model method, not new Action

---

## 3. Detailed Migration Plan

### Phase 1: Domain Model Enrichment (Week 1)

**Goal:** Move all business logic from Actions to Domain Models

#### 3.1.1 Debt Model Enhancement

```typescript
// app/Models/Debt.ts
/**
 * @logicType business
 * Domain entity for debt management. Contains all business rules
 * for creation, validation, and state transitions.
 */
export class Debt {
  // Existing state transitions (confirm, cancel, dispute, markAsPaid)
  
  /**
   * @logicType business
   * Factory method for creating new debts. Encapsulates all creation logic:
   * - Input validation
   * - Pending limit check
   * - Duplicate detection rules
   * - Phone normalization
   */
  static create(
    input: CreateDebtInput,
    user: User,
    dependencies: {
      pendingCount: number;
      potentialDuplicates: Debt[];
    }
  ): Result<Debt> {
    // All validation from CreateDebtAction moves here
    if (dependencies.pendingCount >= MAX_PENDING_DEBTS) {
      return err('DEBT_PENDING_LIMIT');
    }
    
    if (dependencies.potentialDuplicates.length > 0) {
      return err('DEBT_DUPLICATE_WARNING', { duplicates: dependencies.potentialDuplicates });
    }
    
    // ... rest of creation logic
    return ok(new Debt({ ... }));
  }
  
  /**
   * @logicType business
   * Validates if a state transition is allowed for the given user.
   * Centralizes all authorization + state machine logic.
   */
  canTransitionTo(status: DebtStatus, userId: string): boolean {
    const transitions: Record<DebtStatus, { check: (uid: string) => boolean; target: DebtStatus }[]> = {
      pending: [
        { check: (uid) => this.debtorId === uid, target: 'confirmed' },
        { check: (uid) => this.debtorId === uid, target: 'disputed' },
        { check: (uid) => this.creditorId === uid, target: 'cancelled' }
      ],
      confirmed: [
        { check: (uid) => this.debtorId === uid, target: 'paid' }
      ],
      // ...
    };
    
    return transitions[this.status]?.some(t => t.check(userId) && t.target === status) ?? false;
  }
}
```

#### 3.1.2 Other Models to Enrich

| Model | Missing Business Logic |
|-------|----------------------|
| `User.ts` | Registration validation, password policies, status transitions |
| `Session.ts` | Expiration rules, refresh token logic, device validation |
| `BankAccount.ts` | **Doesn't exist** - create from scratch |
| `File.ts` | **Doesn't exist** - create from scratch |
| `Import.ts` | **Doesn't exist** - create from scratch |

**Files to Create:**
```
app/Models/
├── BankAccount.ts      # Rich domain: validate account numbers, bank codes
├── File.ts             # Rich domain: size limits, type validation
├── Import.ts           # Rich domain: validation, progress tracking
├── Enums/
│   ├── DebtStatus.ts   # ✅ Exists
│   ├── UserRole.ts     # ❌ Create
│   ├── ImportStatus.ts # ❌ Create
│   └── FileType.ts     # ❌ Create
└── DomainEvents/       # ❌ Create folder
    ├── DebtCreatedEvent.ts
    ├── DebtStatusChangedEvent.ts
    ├── UserRegisteredEvent.ts
    └── index.ts
```

#### 3.1.3 Domain Events Infrastructure

```typescript
// app/Models/DomainEvents/DebtCreatedEvent.ts
/**
 * @logicType business
 * Event emitted when a debt is created. Contains all data needed
 * for downstream handlers (notifications, analytics, etc.)
 */
export class DebtCreatedEvent implements DomainEvent {
  readonly type = 'debt.created';
  readonly occurredAt: Date;
  
  constructor(
    readonly debtId: string,
    readonly creditorId: string,
    readonly debtorId: string | null,
    readonly amount: number,
    readonly currency: string
  ) {
    this.occurredAt = new Date();
  }
}
```

**Implementation Tasks:**

- [ ] Add `Debt.create()` factory method (Owner: Domain Architect, Est: 4h)
- [ ] Add `Debt.canTransitionTo()` method (Owner: Domain Architect, Est: 2h)
- [ ] Create `BankAccount.ts` Model (Owner: Backend Engineer, Est: 3h)
- [ ] Create `File.ts` Model (Owner: Backend Engineer, Est: 2h)
- [ ] Create `Import.ts` Model (Owner: Backend Engineer, Est: 3h)
- [ ] Create Domain Events framework (Owner: Platform Engineer, Est: 4h)
- [ ] Add all missing Enums (Owner: Backend Engineer, Est: 2h)
- [ ] Write unit tests for all Model business logic (Owner: QA Engineer, Est: 8h)

**Deliverable:** Rich Domain Models with all business logic centralized

---

### Phase 2: Service Consolidation (Week 2)

**Goal:** Merge 95 Actions into existing Services. Services become thin orchestrators.

#### 3.2.1 Service Consolidation Strategy

**Current:**
```
Services/ (27 files)
├── DebtCommandService.ts     # Has createDebt() - but so does CreateDebtAction
├── DebtQueryService.ts
├── DebtStatusService.ts
└── ...

Actions/ (95 files)
├── Debt/
│   ├── CreateDebtAction.ts   # Duplicates DebtCommandService.createDebt()
│   ├── UpdateDebtAction.ts   # Duplicates DebtCommandService.updateDebt()
│   ├── DeleteDebtAction.ts   # Duplicates DebtCommandService.deleteDebt()
│   └── ... (12 more)
```

**Target:**
```
Services/ (15 files - consolidated)
├── DebtService.ts            # Merge: DebtCommand + DebtQuery + DebtStatus
├── AuthService.ts            # Merge: All Auth Actions + existing AuthService
├── UserService.ts            # Merge: User Actions + existing UserService
├── BankService.ts            # Merge: Bank Actions + existing BankAccountService
├── StorageService.ts         # Merge: Storage Actions + existing FileService + S3Storage
├── ImportService.ts          # Merge: Data Import Actions + existing Import services
├── NotificationService.ts    # Merge: System notification Actions + existing
├── ExportService.ts          # Keep existing
├── EmailService.ts           # Keep existing
├── PushService.ts            # Keep existing
├── ActivityService.ts        # Keep existing
├── JobsService.ts            # Keep existing
├── HealthService.ts          # Keep existing
├── RateLimitService.ts       # Keep existing
└── SystemService.ts          # Merge: System Actions (logs, cleanup, etc.)

Actions/ (0 files - DELETED)
```

#### 3.2.2 Service Template (Post-Consolidation)

```typescript
// app/Services/DebtService.ts
/**
 * @logicType backend
 * Orchestrates all debt-related use cases.
 * 
 * Responsibilities:
 * - Query operations (list, get by id, search)
 * - Command operations (create, update, delete)
 * - Status transitions (confirm, cancel, dispute, pay)
 * - Side effect coordination (events, notifications, logging)
 * 
 * Business Rules:
 * - All business logic delegated to Debt Model
 * - No embedded business rules (check via Model methods)
 * - Persistence via Repository interfaces
 * - Async side effects via Domain Events
 */
@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject('EventBus') private readonly eventBus: EventBus,
    @inject('Logger') private readonly logger: Logger
  ) {}

  // ==================== QUERIES ====================
  
  /**
   * @logicType backend
   * Find debts for user with pagination.
   * No business logic - pure query delegation.
   */
  async findForUser(userId: string, options: QueryOptions): Promise<PaginatedResult<DebtSummary>> {
    return this.debtRepo.findByUserId(userId, options);
  }

  /**
   * @logicType backend
   * Get single debt by ID with permission check.
   */
  async getById(debtId: string, userId: string): Promise<Result<DebtDetails>> {
    const debt = await this.debtRepo.findById(debtId);
    if (!debt) return err('DEBT_NOT_FOUND');
    
    if (!this.isAuthorized(debt, userId)) {
      return err('DEBT_PERMISSION_DENIED');
    }
    
    return ok(toDebtDetails(debt));
  }

  // ==================== COMMANDS ====================

  /**
   * @logicType backend
   * Create new debt with full business rule validation.
   * 
   * Flow:
   * 1. Gather dependencies (pending count, duplicates)
   * 2. Delegate to Debt.create() for business validation
   * 3. Persist via Repository
   * 4. Emit Domain Event for side effects
   */
  async createDebt(
    input: CreateDebtInput,
    user: User
  ): Promise<Result<{ debt: DebtDetails }>> {
    // Gather data for business logic
    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(user.id);
    const duplicates = await this.findPotentialDuplicates(input, user);
    
    // Delegate ALL business logic to Domain Model
    const createResult = Debt.create(input, user, {
      pendingCount,
      potentialDuplicates: duplicates
    });
    
    if (createResult.error) return createResult;
    
    // Persistence (infrastructure concern)
    const saved = await this.debtRepo.save(createResult.data);
    
    // Emit event for side effects (notifications, logging)
    await this.eventBus.emit(new DebtCreatedEvent(
      saved.id,
      saved.creditorId,
      saved.debtorId,
      saved.amount,
      saved.currency
    ));
    
    return ok({ debt: toDebtDetails(saved) });
  }

  /**
   * @logicType backend
   * Update debt status with full state machine validation.
   * 
   * Flow:
   * 1. Load debt
   * 2. Delegate transition validation to Model
   * 3. Apply transition
   * 4. Persist
   * 5. Emit event
   */
  async updateStatus(
    debtId: string,
    newStatus: DebtStatus,
    userId: string
  ): Promise<Result<{ debt: DebtDetails; previousStatus: DebtStatus }>> {
    const debtRow = await this.debtRepo.findById(debtId);
    if (!debtRow) return err('DEBT_NOT_FOUND');
    
    // Hydrate Domain Model
    const debt = Debt.fromRow(debtRow);
    const previousStatus = debt.status;
    
    // Delegate authorization + state machine to Model
    if (!debt.canTransitionTo(newStatus, userId)) {
      return err('DEBT_INVALID_TRANSITION');
    }
    
    // Apply transition (returns new immutable instance)
    let updated: Debt;
    switch (newStatus) {
      case 'confirmed': updated = debt.confirm(userId); break;
      case 'cancelled': updated = debt.cancel(userId); break;
      case 'disputed': updated = debt.dispute(userId); break;
      case 'paid': updated = debt.markAsPaid(userId); break;
      default: return err('DEBT_INVALID_STATUS');
    }
    
    // Persist
    const saved = await this.debtRepo.save(updated);
    
    // Emit event
    await this.eventBus.emit(new DebtStatusChangedEvent(
      saved.id,
      previousStatus,
      newStatus,
      userId
    ));
    
    return ok({ debt: toDebtDetails(saved), previousStatus });
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * @logicType backend
   * Check if user can access debt (ownership or admin)
   */
  private isAuthorized(debt: DebtRow, userId: string): boolean {
    return debt.creditorId === userId || debt.debtorId === userId;
  }
}
```

#### 3.2.3 Consolidation Mapping

| Actions to Delete | Logic Moves To | Notes |
|-------------------|----------------|-------|
| `CreateDebtAction` | `DebtService.createDebt()` | Use `Debt.create()` Model method |
| `UpdateDebtAction` | `DebtService.updateDebt()` | Delegate to Model validation |
| `DeleteDebtAction` | `DebtService.deleteDebt()` | Soft delete via Repository |
| `ConfirmDebtAction` | `DebtService.updateStatus()` | Use `debt.confirm()` |
| `UpdateDebtStatusAction` | `DebtService.updateStatus()` | Unified status transitions |
| `FindByIdAction` | `DebtService.getById()` | Direct query |
| `GetDebtsAction` | `DebtService.findForUser()` | Query delegation |
| `FindPotentialDuplicatesAction` | `DebtService.findPotentialDuplicates()` | Private helper |
| `SendDebtCreatedNotificationAction` | Event Handler | `@OnEvent('debt.created')` |
| `SendDebtConfirmedNotificationAction` | Event Handler | `@OnEvent('debt.status_changed')` |
| `LogAction` | Event Handler | `@OnEvent('*')` for all events |
| `UploadFileAction`, `DeleteFileAction`, etc. | `StorageService` (merge FileService + S3Storage) | Interface-based: `StorageServiceInterface` |

**Implementation Tasks:**

- [ ] Merge `DebtCommandService` + `DebtQueryService` + `DebtStatusService` → `DebtService` (Owner: Backend Architect, Est: 8h)
- [ ] Merge all 18 Auth Actions → `AuthService` (Owner: Backend Engineer, Est: 10h)
- [ ] Merge all 12 User Actions → `UserService` (Owner: Backend Engineer, Est: 8h)
- [ ] Merge all 7 Bank Actions → `BankService` (Owner: Backend Engineer, Est: 6h)
- [ ] Merge all 10 Storage Actions → `StorageService` (Owner: Backend Engineer, Est: 8h)
- [ ] Merge all 10 Data Actions → `ImportService` + `ExportService` (Owner: Backend Engineer, Est: 8h)
- [ ] Merge all 25 System Actions → `NotificationService`, `JobsService`, `SystemService` (Owner: Backend Engineer, Est: 12h)
- [ ] Create Event Handlers for side effects (Owner: Backend Engineer, Est: 6h)
- [ ] Delete `app/Actions/` folder (Owner: Platform Engineer, Est: 1h)
- [ ] Update all tests (Owner: QA Engineer, Est: 16h)

**Deliverable:** 15 consolidated Services, zero Actions

---

### Phase 3: Controller Simplification (Week 3)

**Goal:** Thin controllers that only handle HTTP concerns

#### 3.3.1 Controller Before (Current)

```typescript
// Current AuthController: 399 lines, 9 injected Actions
@injectable()
export class AuthController {
  constructor(
    @inject(RegisterAction) private registerAction: RegisterAction,
    @inject(LoginAction) private loginAction: LoginAction,
    @inject(LogoutAction) private logoutAction: LogoutAction,
    // ... 6 more Actions
  ) {}

  register(app: Elysia) {
    return app.group('/auth', (group) =>
      group
        .post('/register', async (ctx) => {
          const result = await this.registerAction.execute(ctx.body);
          // Manual error handling for each endpoint
          if (isFailureResult(result)) {
            if (result.code === 'DATABASE_ERROR') {
              set.status = 503;
              return apiError(BE_ERRORS.DB_CONNECTION);
            }
            // ... more error cases
          }
          return apiSuccess({ user: toUserResponse(result.data.user) });
        }, { body: RegisterSchema })
        // ... 15 more routes
    );
  }
}
```

#### 3.3.2 Controller After (Target)

```typescript
// Target AuthController: ~100 lines, 1 injected Service
/**
 * @logicType http
 * HTTP API endpoints for authentication.
 * 
 * Responsibilities:
 * - Parse HTTP requests
 * - Delegate to AuthService
 * - Return HTTP responses
 * - Apply rate limiting middleware
 * 
 * Business Logic:
 * - NONE. All business logic in AuthService.
 */
@injectable()
export class AuthController {
  constructor(
    @inject(AuthService) private readonly authService: AuthService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/auth', (group) =>
      group
        // Apply rate limiting at group level
        .use(authRateLimiter)
        
        // Registration
        .post('/register', async ({ body, set }) => {
          const result = await this.authService.register(body);
          return mapResultToResponse(result, set, { 
            successStatus: 201,
            mapper: (data) => ({ user: toUserResponse(data.user) })
          });
        }, { body: RegisterRequest })
        
        // Login
        .post('/login', async ({ body, set, cookie, jwt }) => {
          const result = await this.authService.login(body, { jwt, cookie });
          return mapResultToResponse(result, set);
        }, { body: LoginRequest })
        
        // Logout
        .post('/logout', async ({ cookie, set }) => {
          const result = await this.authService.logout({ cookie });
          return mapResultToResponse(result, set);
        })
        
        // ... remaining routes, all following same pattern
    );
  }
}
```

#### 3.3.3 Controller Simplification Metrics

| Controller | Current Lines | Current Dependencies | Target Lines | Target Dependencies |
|------------|--------------|---------------------|--------------|-------------------|
| AuthController | 399 | 9 Actions | ~100 | 1 Service |
| DebtController | ~300 | 8 Actions | ~80 | 1 Service |
| UserController | ~250 | 6 Actions | ~70 | 1 Service |
| StorageController | ~400 | 11 Actions | ~100 | 1 Service |
| BankController | ~200 | 5 Actions | ~60 | 1 Service |
| DataController | ~350 | 8 Actions | ~90 | 2 Services |
| SystemController | ~300 | 7 Actions | ~80 | 2 Services |

**Implementation Tasks:**

- [ ] Create `ErrorCodeMapper.ts` in `app/Http/Mappers/` (Owner: Platform Engineer, Est: 2h)
- [ ] Refactor `AuthController` to use `mapResultToResponse` (Owner: API Engineer, Est: 6h)
- [ ] Refactor `DebtController` to use `mapResultToResponse` (Owner: API Engineer, Est: 5h)
- [ ] Refactor `UserController` to use `mapResultToResponse` (Owner: API Engineer, Est: 4h)
- [ ] Refactor `StorageController` to use `mapResultToResponse` (Owner: API Engineer, Est: 6h)
- [ ] Refactor `BankController` to use `mapResultToResponse` (Owner: API Engineer, Est: 3h)
- [ ] Refactor `DataController` to use `mapResultToResponse` (Owner: API Engineer, Est: 5h)
- [ ] Refactor `SystemController` to use `mapResultToResponse` (Owner: API Engineer, Est: 5h)
- [ ] Update `lib/http/response.ts` to export ErrorCodeMapper utilities (Owner: Platform Engineer, Est: 1h)

**Deliverable:** 7 thin controllers using centralized error mapping, max 2 dependencies each

---

### Phase 4: DI Container Cleanup (Week 4)

**Goal:** Auto-registration + manual only for infrastructure

#### 3.4.1 Current DI (114 registrations)

```typescript
// app/Providers/AppServiceProvider.ts (lines 130-277)
// Every Action manually registered
container.register(CreateDebtAction, { useClass: CreateDebtAction });
container.register(UpdateDebtAction, { useClass: UpdateDebtAction });
// ... 93 more Action registrations

// Services manually registered
container.register(DebtCommandService, { useClass: DebtCommandService });
// ... 26 more Service registrations

// Repositories manually registered
container.register('DebtRepositoryInterface', { useClass: DebtRepository });
// ... 9 more Repository registrations
```

#### 3.4.2 Target DI (~20 registrations)

```typescript
// app/Providers/AppServiceProvider.ts

/**
 * @logicType infrastructure
 * Dependency Injection container configuration.
 * 
 * Strategy:
 * - Auto-register Services and Repositories by convention
 * - Manual registration only for infrastructure (DB, Logger, EventBus)
 * - Storage uses interface-based injection for swappable implementations
 */
export class AppServiceProvider {
  async register(): Promise<void> {
    // 1. Infrastructure (manual - required)
    container.register('Database', { useValue: db });
    container.register('Logger', { useValue: logger });
    container.register('EventBus', { useValue: new EventBus() });
    container.register('Redis', { useValue: redisClient });
    
    // 2. External Services (manual - configuration required)
    container.register('EmailService', { 
      useValue: new EmailService(configs.EMAIL) 
    });
    container.register('PushService', { 
      useValue: new PushService(configs.PUSH) 
    });
    
    // 3. Storage Service (interface-based for swappability)
    // S3StorageService implements StorageServiceInterface
    // To swap: Change useClass to GCSStorageService, AzureStorageService, etc.
    container.register('StorageServiceInterface', {
      useClass: S3StorageService  // Or GCSStorageService, AzureStorageService, etc.
    });
    // Named instances for different storage buckets/prefixes
    container.register('UploadStorage', {
      useFactory: () => new S3StorageService(s3Client, 'uploads', configs.STORAGE)
    });
    container.register('ProofStorage', {
      useFactory: () => new S3StorageService(s3Client, 'proofs', configs.STORAGE)
    });
    
    // 4. Auto-register by convention (Services)
    await this.autoRegister('app/Services/**/*.ts', (cls) => {
      // All @injectable() classes in Services folder
      container.register(cls, { useClass: cls });
    });
    
    // 5. Auto-register Repositories with interface binding
    await this.autoRegister('app/Repositories/Database/**/*.ts', (cls) => {
      const interfaceName = cls.name.replace('Repository', 'RepositoryInterface');
      container.register(interfaceName, { useClass: cls });
    });
    
    // Total manual registrations: ~12
    // Total auto-registered: ~25 (15 Services + 10 Repositories)
  }
  
  private async autoRegister(
    globPattern: string,
    registerFn: (cls: any) => void
  ): Promise<void> {
    const files = await glob(globPattern, { cwd: __dirname });
    for (const file of files) {
      const module = await import(file);
      const Class = Object.values(module).find(
        (v) => typeof v === 'function' && Reflect.getMetadata('injectable', v)
      );
      if (Class) registerFn(Class);
    }
  }
}
```

#### 3.4.3 Auto-Registration Implementation

```typescript
// lib/di/auto-register.ts
/**
 * @logicType infrastructure
 * Auto-registration utilities for DI container.
 */

import { glob } from 'glob';
import { container } from 'tsyringe';
import 'reflect-metadata';

interface AutoRegisterOptions {
  cwd?: string;
  pattern: string;
  transform?: (className: string) => string;
  lifetime?: 'singleton' | 'transient' | 'scoped';
}

export async function autoRegisterServices(
  options: AutoRegisterOptions
): Promise<number> {
  const files = await glob(options.pattern, { cwd: options.cwd || process.cwd() });
  let registered = 0;
  
  for (const file of files) {
    const module = await import(file);
    const ServiceClass = Object.values(module).find(
      (v): v is new (...args: any[]) => any => 
        typeof v === 'function' && 
        Reflect.getMetadata('design:paramtypes', v) &&
        Reflect.getMetadata('injectable', v)
    );
    
    if (ServiceClass) {
      const token = options.transform?.(ServiceClass.name) || ServiceClass.name;
      container.register(token, { 
        useClass: ServiceClass,
        options: { lifecycle: options.lifetime || 'transient' }
      });
      registered++;
    }
  }
  
  return registered;
}

// Usage in AppServiceProvider
await autoRegisterServices({
  pattern: 'app/Services/*.ts',
  lifetime: 'singleton'  // Services are typically singletons
});

await autoRegisterServices({
  pattern: 'app/Repositories/Database/*.ts',
  transform: (name) => name.replace('Repository', 'RepositoryInterface'),
  lifetime: 'singleton'
});
```

**Implementation Tasks:**

- [ ] Create `lib/di/auto-register.ts` utility (Owner: Platform Engineer, Est: 4h)
- [ ] Refactor `AppServiceProvider` to use auto-registration (Owner: Platform Engineer, Est: 3h)
- [ ] Add DI validation on startup (smoke test all registrations) (Owner: Platform Engineer, Est: 3h)
- [ ] Remove all 95 Action registrations (Owner: Platform Engineer, Est: 2h)
- [ ] Test container resolution for all Services (Owner: QA Engineer, Est: 4h)

**Deliverable:** ~20 manual registrations, auto-discovery for Services/Repos

---

### Phase 5: Request Layer Completion (Week 4-5)

**Goal:** All controllers use `app/Http/Requests` exclusively

#### 3.5.1 Current Gap Analysis

| Controller | Has Request DTO | Uses Inline Schema | Status |
|------------|-----------------|-------------------|--------|
| AuthController | Partial | Uses `@repo/schema` directly | ⚠️ Incomplete |
| DebtController | Partial | Inline Elysia schemas | ⚠️ Incomplete |
| UserController | Minimal | Mostly inline | ❌ Missing |
| StorageController | Partial | Mixed | ⚠️ Incomplete |
| BankController | Missing | Inline | ❌ Missing |
| DataController | Partial | Inline for import | ⚠️ Incomplete |
| SystemController | Minimal | Inline | ❌ Missing |

#### 3.5.2 Request DTO Structure

```typescript
// app/Http/Requests/DebtRequest.ts
/**
 * @logicType http
 * HTTP Request DTOs for Debt endpoints.
 * 
 * These wrap shared schemas from @repo/validation with
 * HTTP-specific validation (headers, query params, etc.)
 */

import * as v from 'valibot';
import { 
  createDebtSchema, 
  updateDebtSchema,
  debtQuerySchema,
  debtStatusSchema 
} from '@repo/validation';

// Re-export shared schemas for controller use
export const CreateDebtRequest = createDebtSchema;
export const UpdateDebtRequest = updateDebtSchema;
export const DebtStatusRequest = debtStatusSchema;

// HTTP-specific extensions
export const DebtQueryRequest = v.object({
  ...debtQuerySchema.entries,
  // Add HTTP-specific query params
  page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
  limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
  sort: v.optional(v.string())
});

// Type exports
export type CreateDebtRequest = v.InferInput<typeof CreateDebtRequest>;
export type UpdateDebtRequest = v.InferInput<typeof UpdateDebtRequest>;
```

#### 3.5.3 Missing Request Files to Create

```
app/Http/Requests/
├── AuthRequest.ts          # Expand: add all auth endpoints
├── BankRequest.ts          # CREATE: Bank account CRUD
├── DebtRequest.ts          # EXPAND: Add missing schemas
├── ExportRequest.ts        # CREATE: Data export
├── ImportRequest.ts        # EXPAND: Add preview, status
├── NotificationRequest.ts  # CREATE: Push subscriptions
├── PaginationRequest.ts    # CREATE: Shared pagination params
├── StorageRequest.ts       # EXPAND: Add proof uploads
├── SystemRequest.ts      # CREATE: Jobs, health, logs
└── UserRequest.ts          # EXPAND: Profile, preferences
```

**Implementation Tasks:**

- [ ] Expand `AuthRequest.ts` with all auth schemas (Owner: API Engineer, Est: 2h)
- [ ] Expand `DebtRequest.ts` with all debt schemas (Owner: API Engineer, Est: 2h)
- [ ] Create `BankRequest.ts` (Owner: API Engineer, Est: 2h)
- [ ] Expand `UserRequest.ts` (Owner: API Engineer, Est: 2h)
- [ ] Expand `StorageRequest.ts` (Owner: API Engineer, Est: 2h)
- [ ] Expand `ImportRequest.ts` (Owner: API Engineer, Est: 2h)
- [ ] Create `SystemRequest.ts` (Owner: API Engineer, Est: 2h)
- [ ] Create `PaginationRequest.ts` (shared) (Owner: API Engineer, Est: 1h)
- [ ] Migrate all controllers to use Request DTOs (Owner: API Engineer, Est: 8h)
- [ ] Add lint rule preventing inline controller schemas (Owner: Platform Engineer, Est: 3h)

**Deliverable:** Complete Request DTO layer, no inline controller validation

---

### Phase 6: Exception & Error Handling (Week 5)

**Goal:** Unified error handling with proper layer separation

#### 3.6.1 Current Exception Chaos

```
app/
├── Exceptions/           # 32 items (domain exceptions)
└── Http/
    └── Exceptions/       # 1 item (HTTP exceptions)
```

**Problem:** Controllers throw both domain and HTTP exceptions. No clear mapping.

#### 3.6.2 Target Exception Structure

```
app/
├── Exceptions/           # Domain exceptions (business logic errors)
│   ├── DomainException.ts
│   ├── DebtException.ts    # DebtNotFound, InvalidTransition, etc.
│   ├── AuthException.ts    # InvalidCredentials, AccountLocked, etc.
│   └── index.ts
│
└── Http/
    ├── Exceptions/       # HTTP transport exceptions
    │   ├── HttpException.ts
    │   └── index.ts
    │
    └── Mappers/          # ✅ EXISTING - Add ErrorCodeMapper
        ├── UserMapper.ts
        ├── DebtMapper.ts
        ├── ActivityMapper.ts
        └── ErrorCodeMapper.ts  # NEW: Centralized error-to-status mapping

lib/
└── http/
    └── response.ts       # Keep existing, use ErrorCodeMapper
```

#### 3.6.3 ErrorCodeMapper (Centralized Mapping)

```typescript
// app/Http/Mappers/ErrorCodeMapper.ts
/**
 * @logicType http
 * Centralized error code to HTTP status mapping.
 * 
 * All controllers use this to maintain consistent status codes
 * across the API. Add new mappings here when adding new error codes.
 * 
 * Pattern: Error codes are grouped by domain (AUTH_*, DEBT_*, USER_*)
 * for easy maintenance and discovery.
 */

export const ErrorCodeToHttpStatus: Record<string, number> = {
  // Authentication errors
  'AUTH_INVALID_CREDENTIALS': 401,
  'AUTH_ACCOUNT_LOCKED': 423,
  'AUTH_ACCOUNT_DISABLED': 403,
  'AUTH_SESSION_EXPIRED': 401,
  'AUTH_TOKEN_INVALID': 401,
  'AUTH_TOKEN_EXPIRED': 401,
  'AUTH_MFA_REQUIRED': 403,
  'AUTH_MFA_INVALID': 400,
  'AUTH_RATE_LIMITED': 429,
  
  // User errors
  'USER_EXISTS': 409,
  'USER_NOT_FOUND': 404,
  'USER_EMAIL_EXISTS': 409,
  'USER_PHONE_EXISTS': 409,
  'USER_INVALID_PASSWORD': 400,
  
  // Debt errors
  'DEBT_NOT_FOUND': 404,
  'DEBT_PERMISSION_DENIED': 403,
  'DEBT_INVALID_TRANSITION': 400,
  'DEBT_PENDING_LIMIT': 429,
  'DEBT_DUPLICATE_WARNING': 409,
  'DEBT_ALREADY_CONFIRMED': 409,
  'DEBT_CANNOT_CANCEL': 400,
  
  // Storage errors
  'STORAGE_FILE_NOT_FOUND': 404,
  'STORAGE_FILE_TOO_LARGE': 413,
  'STORAGE_INVALID_TYPE': 400,
  'STORAGE_QUOTA_EXCEEDED': 429,
  
  // Import/Export errors
  'IMPORT_INVALID_FORMAT': 400,
  'IMPORT_PROCESSING_FAILED': 422,
  'IMPORT_LIMIT_EXCEEDED': 429,
  
  // General errors
  'VALIDATION_ERROR': 400,
  'NOT_FOUND': 404,
  'PERMISSION_DENIED': 403,
  'RATE_LIMITED': 429,
  'DB_ERROR': 503,
  'INTERNAL_ERROR': 500,
};

/**
 * @logicType http
 * Map error code to HTTP status. Defaults to 500 for unknown codes.
 */
export function getHttpStatusForErrorCode(code: string): number {
  return ErrorCodeToHttpStatus[code] ?? 500;
}

/**
 * @logicType http
 * Standard result-to-response mapper used by all controllers.
 * Eliminates inline status code mapping in controllers.
 */
export function mapResultToResponse<T>(
  result: { data?: T; code?: string; error?: string },
  set: { status: number },
  options?: {
    successStatus?: number;
    mapper?: (data: T) => unknown;
  }
): { data?: unknown; error?: { code: string; message: string } } {
  // Success case
  if (result.data !== undefined) {
    set.status = options?.successStatus ?? 200;
    return { data: options?.mapper ? options.mapper(result.data) : result.data };
  }
  
  // Error case - use centralized mapping
  const statusCode = getHttpStatusForErrorCode(result.code ?? 'INTERNAL_ERROR');
  set.status = statusCode;
  
  return {
    error: {
      code: result.code ?? 'INTERNAL_ERROR',
      message: result.error ?? 'An error occurred'
    }
  };
}
```

#### 3.6.4 Error Handling Flow

```typescript
// app/Exceptions/DomainException.ts
/**
 * @logicType business
 * Base class for all domain-level exceptions.
 * These represent business rule violations, not system errors.
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly suggestedStatus: number; // HTTP status hint (not required)
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// app/Exceptions/DebtException.ts
/**
 * @logicType business
 * Debt-specific domain exceptions.
 */
export class DebtNotFoundException extends DomainException {
  readonly code = 'DEBT_NOT_FOUND';
  readonly suggestedStatus = 404;
  
  constructor(debtId: string) {
    super(`Debt ${debtId} not found`);
  }
}

export class InvalidDebtTransitionException extends DomainException {
  readonly code = 'DEBT_INVALID_TRANSITION';
  readonly suggestedStatus = 400;
  
  constructor(
    from: DebtStatus,
    to: DebtStatus,
    userId: string
  ) {
    super(`Cannot transition debt from ${from} to ${to}`);
  }
}

// lib/http/response.ts - Updated to use ErrorCodeMapper
/**
 * @logicType http
 * Global error handler using centralized ErrorCodeMapper.
 */
export function handleError(error: unknown): { status: number; body: unknown } {
  // Domain exceptions → use their code with centralized mapping
  if (error instanceof DomainException) {
    const status = getHttpStatusForErrorCode(error.code);
    return {
      status,
      body: { code: error.code, message: error.message }
    };
  }
  
  // Infrastructure errors
  if (error instanceof DatabaseException) {
    return {
      status: 503,
      body: { code: 'DB_ERROR', message: 'Service unavailable' }
    };
  }
  
  // Unknown errors
  logger.error('Unhandled error', { error });
  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  };
}
```

**Implementation Tasks:**

- [ ] Create `DomainException` base class (Owner: Backend Architect, Est: 1h)
- [ ] Refactor `app/Exceptions/` to use DomainException (Owner: Backend Engineer, Est: 4h)
- [ ] Create HTTP error handler mapping (Owner: Backend Engineer, Est: 2h)
- [ ] Update bootstrap.ts to use global error handler (Owner: Backend Engineer, Est: 1h)
- [ ] Add error-code-to-status mapping tests (Owner: QA Engineer, Est: 3h)

**Deliverable:** Unified exception handling with layer separation

---

## 4. Implementation Timeline

| Week | Phase | Focus | Deliverable |
|------|-------|-------|-------------|
| 1 | Phase 1 | Domain Model Enrichment | Rich Models with business logic |
| 2 | Phase 2 | Service Consolidation | 15 consolidated Services, zero Actions |
| 3 | Phase 3 | Controller Simplification | 7 thin controllers |
| 4 | Phase 4 | DI Cleanup | Auto-registration, ~20 manual registrations |
| 4-5 | Phase 5 | Request Layer | Complete Request DTOs |
| 5 | Phase 6 | Exception Handling | Unified error handling |
| 6 | Buffer | Testing & Documentation | Full test suite, updated docs |

---

## 5. Verification Checklist

### Code Quality Metrics

- [ ] Total DI registrations ≤ 25 (manual only)
- [ ] Total Service classes = 15 (consolidated)
- [ ] Total Action classes = 0 (deleted)
- [ ] Controller max dependencies = 2 (1-2 Services)
- [ ] Model business logic coverage = 100% (all rules in Models)
- [ ] All classes have JSDoc `@logicType` annotation

### Test Coverage

- [ ] Model unit tests (business logic) ≥ 90%
- [ ] Service integration tests ≥ 80%
- [ ] Controller contract tests (all endpoints) = 100%
- [ ] Error handling tests (all error codes) = 100%
- [ ] DI container resolution tests = 100%

### Performance

- [ ] Startup time < 3 seconds (DI registration)
- [ ] Request latency unchanged or improved
- [ ] Memory usage reduced (fewer class instances)

---

## 6. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Business logic lost in migration | Medium | High | Comprehensive tests before/after, snapshot comparisons |
| DI resolution failures | Low | High | Startup validation, smoke tests |
| Performance regression | Low | Medium | Benchmark before/after, load tests |
| Developer confusion | Medium | Medium | Documentation, JSDoc annotations, code reviews |
| Test breakage | High | Medium | Parallel test updates, CI validation |

---

## 7. Documentation Requirements

### Code Documentation

- [ ] JSDoc on every class with `@logicType` and `@description`
- [ ] README in `app/Models/` explaining rich domain pattern
- [ ] README in `app/Services/` explaining orchestration pattern
- [ ] Architecture Decision Record (ADR) for Action removal

### Developer Onboarding

- [ ] "Where to put logic" decision tree
- [ ] Migration guide (old Action pattern → new Service pattern)
- [ ] Testing guide (how to test Models vs Services)

---

## 8. Success Criteria

The refactor is complete when:

1. **Code Metrics:**
   - 95 Actions deleted, 15 Services remain
   - 114 DI registrations → 25 manual + auto-discovery
   - All business logic in Models (testable without mocks)

2. **Code Quality:**
   - All classes have `@logicType` annotation
   - Controllers max 2 dependencies
   - Zero inline business logic in Controllers/Services

3. **Tests:**
   - All existing tests pass
   - New Model unit tests added
   - Coverage maintained or improved

4. **Performance:**
   - Startup time ≤ 3 seconds
   - No latency regression

---

## Appendix A: File Deletion List

Files to delete (95 Actions):

```
app/Actions/
├── Auth/ (18 files)
├── Bank/ (7 files)
├── Data/ (10 files)
├── Debt/ (12 files)
├── Storage/ (9 files)
└── System/ (25 files)
```

---

## Appendix B: New File Creation List

Files to create:

```
app/
├── Models/
│   ├── BankAccount.ts
│   ├── File.ts
│   ├── Import.ts
│   └── DomainEvents/
│       ├── index.ts
│       ├── DebtCreatedEvent.ts
│       ├── DebtStatusChangedEvent.ts
│       ├── UserRegisteredEvent.ts
│       └── UserLoggedInEvent.ts
│
├── Services/ (consolidated)
│   ├── DebtService.ts (merge Command+Query+Status)
│   ├── AuthService.ts (expanded)
│   ├── UserService.ts (expanded)
│   ├── BankService.ts (merge BankAccount+Actions)
│   ├── StorageService.ts (merge File+Actions+S3Storage)
│   ├── ImportService.ts (merge Import+Actions)
│   └── SystemService.ts (merge Jobs+Actions)
│
├── Http/
│   ├── Requests/ (expanded)
│   │   ├── BankRequest.ts (new)
│   │   ├── SystemRequest.ts (new)
│   │   ├── ExportRequest.ts (new)
│   │   ├── NotificationRequest.ts (new)
│   │   └── PaginationRequest.ts (new)
│   │
│   └── Mappers/ (add to existing)
│       └── ErrorCodeMapper.ts (new)
│
└── EventHandlers/ (new folder)
    ├── DebtEventHandlers.ts
    ├── AuthEventHandlers.ts
    └── index.ts

lib/
├── di/
│   └── auto-register.ts
│
└── http/
    └── response.ts (update to use ErrorCodeMapper)
```

---

**End of Implementation Plan**
