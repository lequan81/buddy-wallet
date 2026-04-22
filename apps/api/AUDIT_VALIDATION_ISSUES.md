# Validation Issues Detail Report

**Category:** Validation Logic and Schema Issues  
**Total Issues:** 8 Major Issues  
**Libraries Affected:** Zod + Valibot (Mixed Usage)

---

## Executive Summary

The codebase currently uses **two different validation libraries** inconsistently:
- **Zod** in `app/Http/Requests/` (Request DTOs)
- **Valibot** in `lib/validation/` (Business logic validation)

Per the architecture plan, **Valibot should be the standard** throughout.

---

## 1. Mixed Validation Libraries (HIGH PRIORITY)

### 1.1 Zod Usage in Request DTOs
**Location:** `src/app/Http/Requests/`

| File | Library | Issue |
|------|---------|-------|
| `AuthRequest.ts` | Zod | Inconsistent with @repo/validation |
| `DebtRequest.ts` | Zod | Duplicate of Valibot schemas |
| `ImportRequest.ts` | Zod | Not using shared import schemas |
| `StorageRequest.ts` | Zod | Custom instead of shared |
| `UserRequest.ts` | Zod | Not aligned with @repo/types |

**Example from DebtRequest.ts:**
```typescript
import { z } from 'zod';  // ❌ Should be Valibot

export const CreateDebtRequest = z.object({
  debtorPhone: z.string().min(10, 'Invalid debtor phone number'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD)'),
  description: z.string().optional(),
  expiryOption: z.enum(['never', '7d', '30d', '90d']).default('never')
});
```

**Should Be:**
```typescript
import * as v from 'valibot';  // ✅
import { CreateDebtInputSchema } from '@repo/validation';  // ✅ Shared schema

export const CreateDebtRequest = CreateDebtInputSchema;  // Reuse shared
```

---

### 1.2 Valibot Usage in lib/validation
**Location:** `src/lib/validation/`

| File | Library | Status |
|------|---------|--------|
| `debt.ts` | Valibot | ✅ Correct |
| `import.ts` | Native + @repo/errors | ⚠️ Mixed |
| `phone.ts` | Valibot | ✅ Correct |
| `index.ts` | Re-exports | ✅ Correct |

---

## 2. Validation Logic Issues

### 2.1 Unsafe Error Access (MEDIUM)
**Location:** `src/lib/validation/debt.ts` (Lines 14-23)

```typescript
export function validateAmount(amount: number): ErrorResult | null {
  const result = v.safeParse(amountSchema, amount);
  if (!result.success) {
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: result.issues[0].message  // ❌ Unsafe direct access
    };
  }
  return null;
}
```

**Problems:**
1. `result.issues[0]` - No check if issues array exists
2. `result.issues[0].message` - Could throw if issues is empty
3. Returns `null` for success (inconsistent pattern)

**Safe Implementation:**
```typescript
export function validateAmount(amount: number): Result<void> {
  const result = v.safeParse(amountSchema, amount);
  if (!result.success) {
    const firstIssue = result.issues?.[0];
    return {
      code: GEN_ERRORS.INVALID_INPUT.code,
      error: firstIssue?.message || 'Invalid amount provided'
    };
  }
  return { data: undefined };
}
```

---

### 2.2 Inconsistent Return Types (HIGH)
**Location:** `src/lib/validation/debt.ts`

Three functions with three different patterns:

```typescript
// Pattern 1: Returns null on success
export function validateAmount(amount: number): ErrorResult | null;

// Pattern 2: Returns Result with data
export function validateCreateDebtInput(input: CreateDebtInput): 
  Result<{ amount: number; description: string; counterpartyPhone: string; direction: string }>;

// Pattern 3: Returns Result with nested data
export function validatePhones(counterpartyPhone: string, userPhone: string | null): 
  Result<{ counterparty: string; user: string | null }>;
```

**Standardize to:**
```typescript
// All validation functions return Result<T>
export function validateAmount(amount: number): Result<void>;
export function validateCreateDebtInput(input: CreateDebtInput): Result<ValidatedDebtInput>;
export function validatePhones(cpPhone: string, userPhone: string | null): Result<ValidatedPhones>;
```

---

### 2.3 Missing Type Safety in Validation Return
**Location:** `src/lib/validation/debt.ts` (Line 36)

```typescript
export function validateCreateDebtInput(input: CreateDebtInput): Result<...> {
  const result = v.safeParse(CreateDebtInputSchema, input);
  if (!result.success) {
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: result.issues[0].message
    };
  }
  // @ts-ignore - output usually matches if schema is correct  // ❌ BAD!
  return { data: result.output };
}
```

**Problems:**
1. `@ts-ignore` suppresses type checking
2. "usually matches" - not guaranteed
3. Type casting without validation

**Fix:**
```typescript
export function validateCreateDebtInput(input: CreateDebtInput): Result<ValidatedDebtInput> {
  const result = v.safeParse(CreateDebtInputSchema, input);
  if (!result.success) {
    return {
      code: GEN_ERRORS.VALIDATION.code,
      error: result.issues[0]?.message || 'Validation failed'
    };
  }
  // Valibot's output is typed correctly - no need for @ts-ignore
  return { data: result.output };
}
```

---

### 2.4 Import Validation Not Using Shared Schema (MEDIUM)
**Location:** `src/lib/validation/import.ts`

```typescript
// Uses manual validation instead of @repo/validation
import { GEN_ERRORS, apiResponse } from '@repo/errors';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_MIME_TYPES } from '@repo/config';

export async function validateImportUploadFile(file: File): Promise<ValidationFailure | null> {
  // Manual checks instead of schema validation
  if (file.size > MAX_IMPORT_FILE_SIZE) { ... }
  if (!ACCEPTED_IMPORT_MIME_TYPES.includes(file.type)) { ... }
  // ...
}
```

**Should Use:**
```typescript
import { ImportFileSchema } from '@repo/validation';  // Shared schema
import * as v from 'valibot';

export function validateImportUploadFile(file: File): Result<void> {
  const result = v.safeParse(ImportFileSchema, file);
  // ...
}
```

---

## 3. Schema Definition Issues

### 3.1 Debt Status Enum Mismatch (MEDIUM)
**Locations:** Multiple files

**In DebtRequest.ts (Zod):**
```typescript
export const UpdateDebtStatusRequest = z.object({
  status: z.enum(['confirmed', 'disputed', 'paid', 'cancelled']),  // 4 statuses
});

export const DebtQueryRequest = z.object({
  status: z.enum(['pending', 'confirmed', 'disputed', 'paid', 'cancelled']).optional(),  // 5 statuses
});
```

**In @repo/config:**
```typescript
// Likely defines different status values
export const DEBT_STATUS = ['pending', 'confirmed', 'disputed', 'paid', 'cancelled'];
```

**In app/Models/Debt.ts:**
```typescript
getPossibleTransitions(): DebtStatus[] {
  switch (this._status) {
    case 'pending': return ['confirmed', 'disputed', 'cancelled'];
    case 'confirmed': return ['paid'];
    case 'disputed': return ['confirmed', 'cancelled'];
    case 'paid': return [];
    case 'cancelled': return [];
  }
}
```

**Issue:** Status enums defined in multiple places can become inconsistent.

**Fix:** Single source of truth:
```typescript
// @repo/validation/schemas/debt.ts
export const DebtStatusSchema = v.picklist([
  'pending', 'confirmed', 'disputed', 'paid', 'cancelled'
]);

// Export TypeScript type
export type DebtStatus = v.InferOutput<typeof DebtStatusSchema>;
```

---

### 3.2 Phone Validation Duplication (LOW)
**Locations:**
- `src/lib/validation/phone.ts` (Valibot)
- `@repo/validation` (probably also has phone schema)

**Check for:**
- Different regex patterns
- Different normalization rules
- Different error messages

---

## 4. Architecture Plan Compliance

### Required by Architecture (Not Fully Implemented)

Per `ARCHITECTURE_REDESIGN_PLAN.md` Section 4:

> `packages/schemas` contains Zod/Valibot validation  
> Use in `app/Http/Requests/`

**Current State:**
- ✅ `@repo/validation` package exists (replaces `packages/schemas`)
- ❌ `app/Http/Requests/` uses Zod directly instead of `@repo/validation`
- ⚠️ `lib/validation/` uses Valibot correctly

**Required Structure:**
```
packages/validation/        ✅ Exists
  ├── src/
  │   ├── schemas/
  │   │   ├── debt.ts       ✅ Has CreateDebtInputSchema
  │   │   ├── user.ts       ✅ Likely exists
  │   │   └── import.ts     ✅ Likely exists
  │   └── index.ts

apps/api/
  └── src/
      └── app/
          └── Http/
              └── Requests/
                  ├── DebtRequest.ts    ❌ Should use @repo/validation
                  ├── AuthRequest.ts    ❌ Should use @repo/validation
                  └── ...
```

---

## 5. Fix Recommendations

### 5.1 Standardize on Valibot (Priority: HIGH)

1. **Update all Request DTOs to use Valibot:**
```typescript
// DebtRequest.ts - BEFORE
import { z } from 'zod';
export const CreateDebtRequest = z.object({...});

// AFTER
import * as v from 'valibot';
import { CreateDebtInputSchema } from '@repo/validation';
export const CreateDebtRequest = CreateDebtInputSchema;
```

2. **Remove Zod dependency from apps/api:**
```bash
# In apps/api directory
bun remove zod  # If @repo/validation handles everything
```

### 5.2 Fix Validation Return Types (Priority: HIGH)

Standardize all validation functions:
```typescript
// Define consistent return type
type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; code: string; error: string };

// All validators use same pattern
export function validateX(input: unknown): ValidationResult<T>;
```

### 5.3 Remove @ts-ignore Comments (Priority: MEDIUM)

Search and fix:
```bash
grep -r "@ts-ignore" --include="*.ts" src/lib/validation/
```

Each `@ts-ignore` indicates a type safety gap.

---

## 6. Validation Testing Gaps

### Missing Test Coverage

No dedicated validation tests found in `tests/` directory for:
- Phone number edge cases
- Debt amount boundaries
- Import file type detection
- Schema transformation errors

**Recommended Tests:**
```typescript
// tests/validation/debt.test.ts
describe('validateAmount', () => {
  it('should reject negative amounts', () => {
    const result = validateAmount(-100);
    expect(result.success).toBe(false);
  });
  
  it('should reject zero amount', () => {
    const result = validateAmount(0);
    expect(result.success).toBe(false);
  });
  
  it('should accept positive amounts', () => {
    const result = validateAmount(1000);
    expect(result.success).toBe(true);
  });
  
  it('should handle very large amounts', () => {
    const result = validateAmount(1000000000);
    expect(result.success).toBe(true);
  });
});
```

---

## Summary Table

| Issue | Severity | Files Affected | Effort |
|-------|----------|----------------|--------|
| Mixed Zod/Valibot | High | 5 files | 2-3 hours |
| @ts-ignore usage | Medium | 1 file | 30 min |
| Inconsistent return types | High | 3 functions | 1 hour |
| Missing shared schema usage | Medium | 2 files | 1 hour |
| Unsafe error access | Medium | 2 functions | 30 min |
| Schema duplication | Low | 3 areas | 2 hours |
| Missing validation tests | Medium | New files | 3 hours |

---

**End of Validation Issues Report**
