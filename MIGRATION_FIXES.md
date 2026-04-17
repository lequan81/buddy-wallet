# Migration Fix Reference - Code Changes Needed

## 1. IMMEDIATE FIXES (TODAY)

### Fix 1: ImportController.ts Line 14
**File:** `apps/api/src/app/Http/Controllers/ImportController.ts`

```typescript
// ❌ CURRENT (BROKEN)
import { validateImportUploadFile } from '@/services/import-export/import.validators';

// ✅ FIXED
import { validateImportUploadFile } from '@/app/Services/import-export/import.validators';
```

---

### Fix 2: DebtService.ts Line 11
**File:** `apps/api/src/app/Services/DebtService.ts`

**Option A: TEMPORARY (until models created)**
```typescript
// ❌ CURRENT
import { debtStateMachine } from '@/states';

// ✅ TEMPORARY - Comment out
// import { debtStateMachine } from '@/states'; // TODO: Replace with Debt domain model (April 20)
```

Then find where `debtStateMachine` is used and comment out those lines too:
```typescript
// Example around line 95:
// const nextStatus = debtStateMachine.getNextState(currentStatus, transitionType);
```

**Option B: PROPER (create Debt model)**

First, create the Debt model:
```typescript
// File: src/app/Models/Debt.ts
import type { DebtStatus } from '@repo/config';

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

  // Business logic methods replacing state machine
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  canBeConfirmedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  canBeDisputedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  canBePaidBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'confirmed';
  }

  cancel(): Debt {
    if (!this.canBeCancelledBy(this.creditorId)) {
      throw new Error('Debt cannot be cancelled');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'cancelled',
      this.createdAt,
      this.description
    );
  }

  confirm(): Debt {
    if (!this.canBeConfirmedBy(this.debtorId)) {
      throw new Error('Debt cannot be confirmed');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'confirmed',
      this.createdAt,
      this.description
    );
  }

  dispute(): Debt {
    if (!this.canBeDisputedBy(this.debtorId)) {
      throw new Error('Debt cannot be disputed');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'disputed',
      this.createdAt,
      this.description
    );
  }

  markAsPaid(): Debt {
    if (!this.canBePaidBy(this.debtorId)) {
      throw new Error('Debt cannot be marked as paid');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'paid',
      this.createdAt,
      this.description
    );
  }

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

Then update DebtService.ts:
```typescript
// ❌ OLD
import { debtStateMachine } from '@/states';

// ✅ NEW
import { Debt } from '@/app/Models/Debt';

// Replace usage:
// OLD: const nextStatus = debtStateMachine.getNextState(status, 'cancel');
// NEW: if (!debt.canBeCancelledBy(userId)) throw new Error('...');
```

---

### Fix 3: Delete Duplicate Debt Service Files

**Files to delete:**
- `src/app/Services/debt/debt.service.ts` (duplicate of DebtService.ts)
- `src/app/Services/debt/debt.utils.ts`
- `src/app/Services/debt/debt.validators.ts`
- `src/app/Services/debt/index.ts`
- `src/app/Services/debt/` (directory)

**Command:**
```bash
rm -rf src/app/Services/debt/
```

Or if those imports are still needed, fix them first:
```typescript
// In src/app/Services/debt/debt.service.ts, if keeping temporarily:

// ❌ WRONG
import { PushService } from '@/services/notification/push.service';
import { ActivityService } from '@/services/activity/activity.service';

// ✅ CORRECT
import { PushService } from '@/app/Services/PushService';
import { ActivityService } from '@/app/Services/ActivityService';
```

---

## 2. TYPE SAFETY FIXES (HIGH PRIORITY)

### Files with `any` types - Controllers (35 instances)

**BankController.ts** - Example Fix
```typescript
// ❌ Current - 8 `any` assertions
.post(
  '/',
  async ({ body, user, set }) => {
    const result = await this.bankAccountService.createBankAccount(body as any);
    //                                                               ^^^^^^
  }
)

// ✅ Fixed - Create request type
import { CreateBankAccountSchema } from '@repo/schema';

.post(
  '/',
  { body: CreateBankAccountSchema }, // Elysia validates automatically
  async ({ body, user, set }) => {
    const result = await this.bankAccountService.createBankAccount(body);
    // body is now typed as z.infer<typeof CreateBankAccountSchema>
  }
)
```

**DebtController.ts** - Example Fix
```typescript
// ❌ Current - Line 37
const status = (query.status as any) || undefined;

// ✅ Fixed - Properly typed
const status = query.status as DebtStatus | undefined;
// Assuming query already typed by Elysia schema

// OR if using request schema:
const statusSchema = z.enum(['pending', 'confirmed', 'disputed', 'paid', 'cancelled']).optional();
.get(
  '/',
  { query: z.object({ status: statusSchema }) },
  async ({ query }) => {
    // query.status is properly typed now
  }
)
```

---

### Services with `any` types (20 instances)

**ImportService.ts** - Example
```typescript
// ❌ Current - loose typing
async previewImport(data: any): Promise<any> {
  const rows = data.map((row: any) => ({
    // ...
  }));
}

// ✅ Fixed - proper types
import { PreviewImportSchema } from '@repo/schema';

async previewImport(data: z.infer<typeof PreviewImportSchema>): Promise<PreviewResult[]> {
  const rows = data.map((row) => ({
    // row is now properly typed
  }));
}
```

---

## 3. NESTED FOLDER CLEANUP

### Files to Delete:

```bash
# These are duplicates/old structure - delete entire directories
rm -rf src/app/Services/activity/
rm -rf src/app/Services/auth/          # Keep auth services in root
rm -rf src/app/Services/notification/  # notification/index.ts only
rm -rf src/app/Services/email/         # email/index.ts only  
rm -rf src/app/Services/user/          # user/index.ts only
rm -rf src/app/Services/system/        # system/index.ts only
rm -rf src/app/Services/bank/          # bank/index.ts only

# Keep but clean up:
# src/app/Services/import-export/ - has validators
# src/app/Services/storage/ - has interface contract
```

### Files to Keep:

These nested files are actually needed - don't delete:
```
src/app/Services/import-export/
├── import.validators.ts         ✅ KEEP - used by ImportController
├── import-logger.service.ts     ✅ KEEP - separate concern
└── index.ts

src/app/Services/storage/
├── Contracts/
│   └── StorageServiceInterface.ts  ✅ KEEP - interface
└── storage.service.ts           ⚠️ CHECK - might be duplicate
```

---

## 4. IMPORT PATH AUDIT

### Search for broken imports:
```bash
# Find any remaining @/services/ imports (should be @/app/Services/)
grep -r "from '@/services" src/app --include="*.ts"

# Find any remaining @/utils/ imports that moved to @/lib/
grep -r "from '@/utils" src/app --include="*.ts"

# Find any @/states imports (should be removed)
grep -r "from '@/states" src/app --include="*.ts"

# Find any @/repositories/ imports (should be @/app/Repositories/)
grep -r "from '@/repositories" src/app --include="*.ts"
```

### Common replacements:
```
@/utils/password.utils      → @/lib/security/password
@/utils/crypto.utils        → @/lib/security/crypto
@/utils/ip.utils            → @/lib/security/ip/*
@/utils/phone.utils         → @/lib/validation/phone
@/utils/                     → @/lib/
@/core/error/error-factory  → @/lib/result
@/services/                  → @/app/Services/
@/repositories/              → @/app/Repositories/
@/states                     → @/app/Models/Debt.ts (when created)
```

---

## 5. GIT CLEANUP COMMANDS

### Stage all the fixes:
```bash
cd apps/api

# Fix ImportController
git add src/app/Http/Controllers/ImportController.ts

# Fix DebtService (or create model)
git add src/app/Services/DebtService.ts

# Delete duplicate nested services
git rm -r src/app/Services/debt/
git rm -r src/app/Services/activity/
git rm -r src/app/Services/auth/
# ... etc

# Create new Debt model
git add src/app/Models/Debt.ts

# Commit
git commit -m "fix: migrate remaining services, fix broken imports, remove duplicates"
```

### Verify no broken imports:
```bash
bun typecheck
# Should have 0 TS errors after fixes
```

---

## 6. DECORATOR USAGE (CURRENTLY UNUSED)

These decorators are created but not used yet. They're ready for Phase 2:

```typescript
// src/lib/decorators/ - Already created:
├── cacheable.ts       ✅ Ready to use with @Cacheable({ key: 'users', ttl: 3600 })
├── circuit-breaker.ts ✅ Ready to use with @CircuitBreaker({ failureThreshold: 5, ... })
├── on-event.ts        ✅ Ready to use with @OnEvent('debt.cancelled')
├── retryable.ts       ✅ Ready to use with @Retryable({ maxAttempts: 3 })
├── timed.ts           ✅ Ready to use with @Timed(5000)
└── transactional.ts   ✅ Ready to use with @Transactional()
```

**Example usage** (TODO for future):
```typescript
@injectable()
export class VietQRService {
  @Retryable({ maxAttempts: 3 })
  @Timed(10000)
  @CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000 })
  async getQRCode(iban: string): Promise<QRCodeData> {
    // Auto-retries up to 3 times
    // Times out after 10 seconds
    // Opens circuit after 5 failures
  }
}
```

---

## 7. VALIDATION PATTERNS (TO STANDARDIZE)

### Current pattern (needs replacement):
```typescript
// ❌ WRONG - No compile-time validation
.post('/debts', 
  async ({ body }) => {
    const { amount, debtorId } = body as any;
    // No guarantee these fields exist
  }
)
```

### New pattern (type-safe):
```typescript
// ✅ CORRECT - Full compile-time validation
import { CreateDebtSchema } from '@repo/schemas';

.post('/debts',
  { body: CreateDebtSchema },
  async ({ body }) => {
    const { amount, debtorId } = body;
    // TypeScript knows these fields exist and are validated
  }
)
```

---

## 8. CHECKLIST FOR EACH FILE

### When fixing a service/controller:

- [ ] Remove all `as any` type assertions
- [ ] Add proper Zod/Valibot schema validation
- [ ] Update imports from old paths (@/services/ → @/app/Services/, etc.)
- [ ] Remove references to deleted files (@/states, @/utils, etc.)
- [ ] Add @injectable() decorator if missing
- [ ] Verify all dependencies are in AppServiceProvider
- [ ] Run `bun typecheck` - 0 errors required

---

## TIMELINE

| Phase | Task | Est. Time |
|-------|------|-----------|
| 1 | Fix 3 critical imports | 15 min |
| 1 | Commit changes | 5 min |
| 2 | Create Debt model OR comment out imports | 30 min |
| 2 | Delete duplicate files | 10 min |
| 2 | Test: bun typecheck | 5 min |
| 3 | Add Request DTOs (15+ files) | 2-3 hours |
| 3 | Replace `any` assertions (92 instances) | 2-3 hours |
| 4 | Migrate plugins (optional) | 2-4 hours |
| **TOTAL** | | **5-7 hours** |

