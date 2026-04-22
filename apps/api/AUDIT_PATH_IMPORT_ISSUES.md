# Path Import Issues Detail Report

**Category:** Import Path Mismatches  
**Total Files Affected:** 6+ files  
**Impact:** Build/Test Failures

---

## Summary of Path Alias Problems

| Alias | Configured Path | Actual Path | Status |
|-------|-----------------|-------------|--------|
| `@configs` | `./src/configs` | `./src/config/` | ❌ Mismatch |
| `@domain` | `./src/domain` | (none) | ❌ Missing |
| `@shared` | `./src/shared` | (none) | ❌ Missing |
| `@modules` | `./src/modules` | (none) | ❌ Missing |
| `@utils` | `./src/lib` | `./src/lib/` | ⚠️ Confusing |
| `@services/*` | `./src/app/Services/*` | Exists | ⚠️ Not per architecture |
| `@controllers/*` | `./src/app/Http/Controllers/*` | Exists | ⚠️ Not per architecture |

---

## Detailed Issue Analysis

### 1. @configs → Non-existent Directory (CRITICAL)

**TsConfig Entry:**
```json
"@configs": ["./src/configs"],
"@configs/*": ["./src/configs/*"]
```

**Actual Directory Structure:**
```
src/
├── config/          ✅ Correct (singular)
│   ├── app.ts
│   ├── auth.ts
│   ├── cache.ts
│   ├── database.ts
│   ├── index.ts
│   └── services.ts
└── configs/         ❌ Doesn't exist (would be plural)
```

**Affected Files:**

#### File: `tests/auth.test.ts` (Line 2)
```typescript
// WRONG:
import { configs } from '@configs';

// ERROR: Cannot find module '@configs' or its corresponding type declarations
```

**Fix:**
```typescript
// CORRECT:
import { configs } from '@/config';
// OR:
import { configs } from '@config/index';
```

---

### 2. Legacy Path Aliases Still in TsConfig (MEDIUM)

**Unused/Invalid Aliases:**

```json
{
  "compilerOptions": {
    "paths": {
      "@domain": ["./src/domain"],
      "@domain/*": ["./src/domain/*"],
      "@shared": ["./src/shared"],
      "@shared/*": ["./src/shared/*"],
      "@modules": ["./src/modules"],
      "@modules/*": ["./src/modules/*"]
    }
  }
}
```

**Directories That Don't Exist:**
- `src/domain/` - Not part of new architecture
- `src/shared/` - Not part of new architecture  
- `src/modules/` - Not part of new architecture

**Recommendation:** Remove these aliases from tsconfig.json to prevent confusion.

---

### 3. @services Path Alias Inconsistency (HIGH)

**TsConfig Entry:**
```json
"@services": ["./src/app/Services"],
"@services/*": ["./src/app/Services/*"]
```

**Architecture Plan Says:**
> Use `@/app/Services/*` pattern, not `@services/*`

**Affected Test Files:**

#### File: `tests/services/email-verification.service.test.ts` (Line 7)
```typescript
// WRONG (uses old pattern):
import { EmailVerificationService } from '@services/email';

// ERROR: Module '@services/email' not found
```

#### File: `tests/email.test.ts` (Line 10)
```typescript
// WRONG:
import { EmailService as EmailServiceClass } from '@services/EmailService';

// ERROR: Cannot find module
```

**Correct Pattern:**
```typescript
// CORRECT (per architecture):
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
import { EmailService } from '@/app/Services/EmailService';
```

**Note:** The `@services` alias technically works but violates the architecture convention of using `@/app/Services` for consistency with the Laravel-style structure.

---

### 4. @utils Path Alias Confusion (MEDIUM)

**TsConfig Entry:**
```json
"@utils": ["./src/lib"],
"@utils/*": ["./src/lib/*"]
```

**Problem:** The alias name suggests `utils/` but points to `lib/`

**Affected File:**

#### File: `src/app/Http/Controllers/SystemController.ts` (Line 3)
```typescript
import { traceStore } from '@utils/trace-store';
```

**Expected File:** `src/lib/trace-store.ts` (or `src/lib/trace-store/index.ts`)

**Status:** Unknown if this file exists

**Recommendation:** Either:
1. Rename alias to `@lib` to match directory name
2. Or keep `@utils` but ensure all files referenced exist

---

### 5. @configs vs @config Inconsistency (MEDIUM)

**In AppServiceProvider.ts:**
```typescript
// Uses @repo/config (correct - from shared package)
import { STORAGE_CONFIG } from '@repo/config';
```

**In bootstrap.ts:**
```typescript
// Uses @/config (correct - local config)
import { configs, validateRuntimeEnv } from '@/config';
```

**In tests/auth.test.ts:**
```typescript
// Uses @configs (WRONG)
import { configs } from '@configs';
```

**Confusion Points:**
- `@repo/config` = shared package from monorepo
- `@/config` = local api config
- `@configs` = broken alias (should be removed)

---

### 6. Import Path Inconsistency in Services

**DebtService.ts uses mixed patterns:**
```typescript
// From shared packages (correct):
import { MAX_PENDING_DEBTS } from '@repo/config';
import type { DebtStatus } from '@repo/types';
import { BE_ERRORS } from '@repo/errors';

// From local lib using @lib alias:
import { validateAmount } from '@lib/validation/debt';
import { toDebtDetails } from '@lib/helpers/debt';

// From local app using relative path:
import type { DebtRepositoryInterface } from '../Repositories/Contracts/DebtRepositoryInterface';
import { Debt } from '../Models/Debt';
```

**Should Be:**
```typescript
// Consistent @/ prefix for local imports:
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { Debt } from '@/app/Models/Debt';
import { validateAmount } from '@/lib/validation/debt';
```

---

## Complete Fix Guide

### Step 1: Fix tsconfig.json

Remove or fix invalid aliases:

```json
{
  "compilerOptions": {
    "paths": {
      // Keep these (correct):
      "@/*": ["./src/*"],
      "@app/*": ["./src/app/*"],
      "@lib/*": ["./src/lib/*"],
      "@config/*": ["./src/config/*"],
      
      // REMOVE these (invalid):
      // "@configs": ["./src/configs"],
      // "@configs/*": ["./src/configs/*"],
      // "@domain": ["./src/domain"],
      // "@shared": ["./src/shared"],
      // "@modules": ["./src/modules"],
      
      // Optionally remove these (not per architecture):
      // "@services": ["./src/app/Services"],
      // "@controllers": ["./src/app/Http/Controllers"],
      
      // Keep @repo/* (shared packages):
      "@repo/*": ["../../packages/*/src"]
    }
  }
}
```

### Step 2: Fix Test Files

#### tests/auth.test.ts
```typescript
// BEFORE:
import { configs } from '@configs';

// AFTER:
import { configs } from '@/config';
```

#### tests/services/email-verification.service.test.ts
```typescript
// BEFORE:
import { EmailVerificationService } from '@services/email';

// AFTER:
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';
```

#### tests/email.test.ts
```typescript
// BEFORE:
import { EmailService as EmailServiceClass } from '@services/EmailService';

// AFTER:
import { EmailService } from '@/app/Services/EmailService';
// Or if you need aliasing:
import { EmailService as EmailServiceClass } from '@/app/Services/EmailService';
```

### Step 3: Fix Controllers with Wrong Paths

Search for these patterns and fix:
```bash
# Find wrong imports
grep -r "from '@utils/" src/
grep -r "from '@configs'" src/ tests/
grep -r "from '@services/" tests/

# Replace with correct patterns
```

---

## Path Alias Best Practices

Per the architecture plan, use these patterns:

| What You're Importing | Correct Alias | Example |
|----------------------|---------------|---------|
| Shared package | `@repo/*` | `import { db } from '@repo/db'` |
| Local config | `@/config` | `import { configs } from '@/config'` |
| Local service | `@/app/Services/*` | `import { AuthService } from '@/app/Services/AuthService'` |
| Local controller | `@/app/Http/Controllers/*` | `import { AuthController } from '@/app/Http/Controllers/AuthController'` |
| Local lib utility | `@/lib/*` | `import { apiSuccess } from '@/lib/http'` |
| Local model | `@/app/Models/*` | `import { Debt } from '@/app/Models/Debt'` |
| Local repository | `@/app/Repositories/*` | `import { UserRepository } from '@/app/Repositories/Database/UserRepository'` |
| Local types | `@/types/*` | `import type { ElysiaContext } from '@/types/elysia'` |

---

## Files to Check

Run these searches to find all incorrect imports:

```bash
# Find all @configs usage
grep -r "from ['\"]@configs" --include="*.ts" .

# Find all @services usage in tests
grep -r "from ['\"]@services" --include="*.ts" tests/

# Find all @utils usage
grep -r "from ['\"]@utils" --include="*.ts" src/

# Find all @domain, @shared, @modules usage
grep -r "from ['\"]@domain\|from ['\"]@shared\|from ['\"]@modules" --include="*.ts" .
```

---

## Migration Script (Conceptual)

```typescript
// This is a conceptual guide, not executable code

const replacements = [
  { from: /^@configs/, to: '@/config' },
  { from: /^@services/, to: '@/app/Services' },
  { from: /^@controllers/, to: '@/app/Http/Controllers' },
  { from: /^@utils/, to: '@/lib' },
  // Remove @domain, @shared, @modules usage entirely
];

// Apply to all .ts files in src/ and tests/
```

---

**End of Path Import Issues Report**
